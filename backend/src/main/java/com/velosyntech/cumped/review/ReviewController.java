package com.velosyntech.cumped.review;

import com.velosyntech.cumped.common.ApiException;
import com.velosyntech.cumped.common.CurrentUser;
import com.velosyntech.cumped.common.Texts;
import com.velosyntech.cumped.common.FieldCrypto;
import org.springframework.http.HttpStatus;
import java.time.Duration;
import com.velosyntech.cumped.listing.Listing;
import com.velosyntech.cumped.listing.ListingRepository;
import com.velosyntech.cumped.notification.NotificationService;
import com.velosyntech.cumped.user.User;
import com.velosyntech.cumped.user.UserRepository;
import com.velosyntech.cumped.velo.ScamDetector;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Recenzii doar pe cumpărări verificate: poți lăsa o recenzie DOAR pentru o comandă finalizată prin plata sigură,
 * în care ai fost cumpărătorul sau vânzătorul. O recenzie per comandă și per parte, în cel mult 30 de zile de la finalizare.
 * Comenzile rambursate sau în dispută nu pot fi evaluate. Așa nu există recenzii de la necunoscuți, de la concurență
 * sau „cumpărate” (cerință și în Directiva (UE) 2019/2161 privind informarea despre verificarea recenziilor).
 */
@RestController
@RequestMapping("/api")
public class ReviewController {
    public static final Duration REVIEW_WINDOW = Duration.ofDays(30);
    public record Create(@NotNull UUID orderId, @Min(1) @Max(5) int rating, @Size(max = 600) String comment) {}
    public record Review(UUID id, int rating, String comment, String reviewerName, boolean reviewerVerified, String listingTitle,
                         Instant createdAt, boolean verifiedPurchase, String reviewerRole) {}

    private final JdbcClient jdbc;
    private final UserRepository users;
    private final NotificationService notifications;
    private final ScamDetector scam;
    private final com.velosyntech.cumped.moderation.ContentPolicy policy;

    public ReviewController(JdbcClient jdbc, UserRepository users, NotificationService notifications, ScamDetector scam,
                            com.velosyntech.cumped.moderation.ContentPolicy policy) {
        this.jdbc = jdbc;
        this.users = users;
        this.notifications = notifications;
        this.scam = scam;
        this.policy = policy;
    }

    @PostMapping("/reviews")
    @Transactional
    Map<String, Object> create(@Valid @RequestBody Create r) {
        UUID me = CurrentUser.id();
        record O(UUID listingId, UUID buyerId, UUID sellerId, String status, Instant completedAt, String title) {}
        O o = jdbc.sql("""
                SELECT o.listing_id, o.buyer_id, o.seller_id, o.status, o.completed_at, l.title
                FROM orders o JOIN listings l ON l.id = o.listing_id WHERE o.id = ? AND (o.buyer_id = ? OR o.seller_id = ?)""")
                .params(r.orderId(), me, me)
                .query((rs, i) -> new O(rs.getObject(1, UUID.class), rs.getObject(2, UUID.class), rs.getObject(3, UUID.class),
                        rs.getString(4), rs.getTimestamp(5) == null ? null : rs.getTimestamp(5).toInstant(), rs.getString(6)))
                .optional().orElseThrow(ApiException::notFound);
        if (!"COMPLETED".equals(o.status())) throw new ApiException(HttpStatus.FORBIDDEN, "NO_TRANSACTION");
        if (o.completedAt() == null || o.completedAt().plus(REVIEW_WINDOW).isBefore(Instant.now())) throw ApiException.conflict("REVIEW_WINDOW_CLOSED");
        boolean iAmBuyer = me.equals(o.buyerId());
        UUID reviewee = iAmBuyer ? o.sellerId() : o.buyerId();
        String comment = Texts.clean(r.comment());
        if (comment != null && scam.containsLink(comment)) throw ApiException.badRequest("LINKS_NOT_ALLOWED");
        if (comment != null && policy.offensive(comment)) throw new ApiException(HttpStatus.UNPROCESSABLE_CONTENT, "OFFENSIVE_CONTENT");
        int n = jdbc.sql("""
                INSERT INTO reviews(id, reviewer_id, reviewee_id, listing_id, order_id, rating, comment) VALUES (?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT DO NOTHING""")
                .params(UUID.randomUUID(), me, reviewee, o.listingId(), r.orderId(), r.rating(), comment).update();
        if (n == 0) throw ApiException.conflict("ALREADY_REVIEWED");
        User target = users.findById(reviewee).orElseThrow(ApiException::notFound);
        target.setRatingSum(target.getRatingSum() + r.rating());
        target.setRatingCount(target.getRatingCount() + 1);
        users.save(target);
        notifications.notify(reviewee, "NEW_REVIEW", Map.of("rating", r.rating(), "title", o.title()), "/profile");
        return Map.of("ok", true);
    }

    /** Ce poate evalua utilizatorul la o comandă: folosit de aplicație ca să arate sau nu formularul. */
    @GetMapping("/orders/{id}/review-status")
    Map<String, Object> reviewStatus(@PathVariable UUID id) {
        UUID me = CurrentUser.id();
        int mine = jdbc.sql("SELECT count(*) FROM reviews WHERE order_id = ? AND reviewer_id = ?").params(id, me).query(Integer.class).single();
        return Map.of("reviewed", mine > 0);
    }

    @GetMapping("/users/{id}/reviews")
    List<Review> forUser(@PathVariable UUID id) {
        return jdbc.sql("""
                SELECT r.id, r.rating, r.comment, u.username, u.display_mode, u.legal_first_name, u.legal_last_name, u.id_verified, l.title, r.created_at,
                       r.order_id IS NOT NULL AS verified_purchase, CASE WHEN o.buyer_id = r.reviewer_id THEN 'BUYER' ELSE 'SELLER' END AS reviewer_role
                FROM reviews r JOIN users u ON u.id = r.reviewer_id JOIN listings l ON l.id = r.listing_id
                LEFT JOIN orders o ON o.id = r.order_id
                WHERE r.reviewee_id = ? ORDER BY r.created_at DESC LIMIT 50""")
                .param(id)
                .query((rs, i) -> {
                    boolean verified = rs.getBoolean("id_verified");
                    String first = FieldCrypto.decrypt(rs.getString("legal_first_name")), last = FieldCrypto.decrypt(rs.getString("legal_last_name"));
                    String name = "REAL_NAME".equals(rs.getString("display_mode")) && verified && first != null && last != null && !last.isEmpty()
                            ? first + " " + last.charAt(0) + "."
                            : rs.getString("username");
                    return new Review(rs.getObject("id", UUID.class), rs.getInt("rating"), rs.getString("comment"), name,
                            verified, rs.getString("title"), rs.getTimestamp("created_at").toInstant(),
                            rs.getBoolean("verified_purchase"), rs.getString("reviewer_role"));
                })
                .list();
    }

}
