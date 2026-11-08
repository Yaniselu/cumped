package com.velosyntech.cumped.review;

import com.velosyntech.cumped.common.ApiException;
import com.velosyntech.cumped.common.CurrentUser;
import com.velosyntech.cumped.common.Texts;
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
 * Recenzii reale: poți lăsa recenzie doar dacă ai avut o tranzacție confirmată cu persoana respectivă
 * (anunț marcat vândut către tine sau ofertă acceptată). Fără recenzii false.
 */
@RestController
@RequestMapping("/api")
public class ReviewController {
    public record Create(@NotNull UUID listingId, UUID revieweeId, @Min(1) @Max(5) int rating, @Size(max = 600) String comment) {}
    public record Review(UUID id, int rating, String comment, String reviewerName, boolean reviewerVerified, String listingTitle, Instant createdAt) {}

    private final JdbcClient jdbc;
    private final ListingRepository listings;
    private final UserRepository users;
    private final NotificationService notifications;
    private final ScamDetector scam;

    public ReviewController(JdbcClient jdbc, ListingRepository listings, UserRepository users,
                            NotificationService notifications, ScamDetector scam) {
        this.jdbc = jdbc;
        this.listings = listings;
        this.users = users;
        this.notifications = notifications;
        this.scam = scam;
    }

    @PostMapping("/reviews")
    @Transactional
    Map<String, Object> create(@Valid @RequestBody Create r) {
        UUID me = CurrentUser.id();
        Listing l = listings.findById(r.listingId()).orElseThrow(ApiException::notFound);
        UUID reviewee;
        if (me.equals(l.getSellerId())) {
            if (r.revieweeId() == null || !isBuyer(l, r.revieweeId())) throw ApiException.forbidden();
            reviewee = r.revieweeId();
        } else {
            if (!isBuyer(l, me)) throw new ApiException(org.springframework.http.HttpStatus.FORBIDDEN, "NO_TRANSACTION");
            reviewee = l.getSellerId();
        }
        String comment = Texts.clean(r.comment());
        if (comment != null && scam.containsLink(comment)) throw ApiException.badRequest("LINKS_NOT_ALLOWED");
        int n = jdbc.sql("INSERT INTO reviews(id, reviewer_id, reviewee_id, listing_id, rating, comment) VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT DO NOTHING")
                .params(UUID.randomUUID(), me, reviewee, l.getId(), r.rating(), comment).update();
        if (n == 0) throw ApiException.conflict("ALREADY_REVIEWED");
        User target = users.findById(reviewee).orElseThrow(ApiException::notFound);
        target.setRatingSum(target.getRatingSum() + r.rating());
        target.setRatingCount(target.getRatingCount() + 1);
        users.save(target);
        notifications.notify(reviewee, "NEW_REVIEW", Map.of("rating", r.rating(), "title", l.getTitle()), "/profile");
        return Map.of("ok", true);
    }

    @GetMapping("/users/{id}/reviews")
    List<Review> forUser(@PathVariable UUID id) {
        return jdbc.sql("""
                SELECT r.id, r.rating, r.comment, u.username, u.display_mode, u.legal_first_name, u.legal_last_name, u.id_verified, l.title, r.created_at
                FROM reviews r JOIN users u ON u.id = r.reviewer_id JOIN listings l ON l.id = r.listing_id
                WHERE r.reviewee_id = ? ORDER BY r.created_at DESC LIMIT 50""")
                .param(id)
                .query((rs, i) -> {
                    boolean verified = rs.getBoolean("id_verified");
                    String name = "REAL_NAME".equals(rs.getString("display_mode")) && verified && rs.getString("legal_first_name") != null
                            ? rs.getString("legal_first_name") + " " + rs.getString("legal_last_name").charAt(0) + "."
                            : rs.getString("username");
                    return new Review(rs.getObject("id", UUID.class), rs.getInt("rating"), rs.getString("comment"), name,
                            verified, rs.getString("title"), rs.getTimestamp("created_at").toInstant());
                })
                .list();
    }

    private boolean isBuyer(Listing l, UUID userId) {
        if (userId.equals(l.getSoldToId())) return true;
        return jdbc.sql("SELECT count(*) FROM offers WHERE listing_id = ? AND buyer_id = ? AND status = 'ACCEPTED'")
                .params(l.getId(), userId).query(Integer.class).single() > 0;
    }
}
