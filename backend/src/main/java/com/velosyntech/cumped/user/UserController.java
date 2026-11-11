package com.velosyntech.cumped.user;

import com.velosyntech.cumped.auth.AuthService;
import com.velosyntech.cumped.auth.TokenService;
import com.velosyntech.cumped.common.ApiException;
import com.velosyntech.cumped.common.AuditService;
import com.velosyntech.cumped.common.CurrentUser;
import com.velosyntech.cumped.common.Texts;
import com.velosyntech.cumped.config.UserStatusCache;
import com.velosyntech.cumped.listing.ListingDtos;
import com.velosyntech.cumped.listing.ListingQueries;
import com.velosyntech.cumped.velo.ScamDetector;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.*;

@RestController
@RequestMapping("/api")
public class UserController {
    public record Update(@Pattern(regexp = "^[A-Za-z0-9_.]{3,20}$") String username,
                        User.DisplayMode displayMode,
                        @Size(max = 400) String bio,
                        @Size(max = 80) String city,
                        @Pattern(regexp = "^[A-Z]{2}$") String country,
                        @Pattern(regexp = "^[a-z]{2}$") String locale) {}

    public record BusinessUpdate(@jakarta.validation.constraints.NotNull User.AccountType accountType,
                                 @Size(max = 120) String name, @Size(max = 40) String regNo, @Size(max = 30) String vat,
                                 @Size(max = 250) String address, @jakarta.validation.constraints.Email @Size(max = 254) String email,
                                 @Pattern(regexp = "^\\+?[0-9 ()-]{6,30}$") String phone) {}

    public record ListingStat(UUID id, String title, String status, int views, int favorites, int messages, long offers) {}
    public record Stats(int totalViews, int totalFavorites, int totalMessages, long totalOffers, long soldCount,
                        List<Map<String, Object>> viewsByDay, List<ListingStat> listings) {}

    private final UserRepository users;
    private final QuotaService quota;
    private final ListingQueries queries;
    private final AuditService audit;
    private final JdbcClient jdbc;
    private final TokenService tokens;
    private final UserStatusCache statusCache;
    private final ScamDetector scam;
    private final BlockService blocks;
    private final com.velosyntech.cumped.media.MediaService media;
    private final com.velosyntech.cumped.media.ListingImageRepository images;
    private final SellerStatsService sellerStats;

    public UserController(UserRepository users, QuotaService quota, ListingQueries queries, AuditService audit,
                          JdbcClient jdbc, TokenService tokens, UserStatusCache statusCache, ScamDetector scam,
                          BlockService blocks, com.velosyntech.cumped.media.MediaService media,
                          com.velosyntech.cumped.media.ListingImageRepository images, SellerStatsService sellerStats) {
        this.sellerStats = sellerStats;
        this.users = users;
        this.quota = quota;
        this.queries = queries;
        this.audit = audit;
        this.jdbc = jdbc;
        this.tokens = tokens;
        this.statusCache = statusCache;
        this.scam = scam;
        this.blocks = blocks;
        this.media = media;
        this.images = images;
    }

    /**
     * Cont de persoană fizică sau de firmă. Firmele trebuie să-și declare datele (DSA art. 30),
     * iar cumpărătorii văd că au de-a face cu un profesionist (drepturile de consumator se aplică).
     */
    @GetMapping("/users/{id}/stats")
    SellerStatsService.Stats stats(@PathVariable UUID id) {
        users.findById(id).filter(u -> !u.isSuspended()).orElseThrow(ApiException::notFound);
        return sellerStats.of(id);
    }

    @PatchMapping("/me/business")
    @Transactional
    UserDtos.Me updateBusiness(@Valid @RequestBody BusinessUpdate r) {
        User u = users.findById(CurrentUser.id()).orElseThrow(ApiException::notFound);
        if (r.accountType() == User.AccountType.BUSINESS) {
            if (blank(r.name()) || blank(r.regNo()) || blank(r.vat()) || blank(r.address()) || blank(r.email()))
                throw ApiException.badRequest("BUSINESS_DETAILS_REQUIRED");
            u.setBusinessName(Texts.clean(r.name()));
            u.setBusinessRegNo(Texts.clean(r.regNo()));
            u.setBusinessVat(Texts.clean(r.vat()));
            u.setBusinessAddress(Texts.clean(r.address()));
            u.setBusinessEmail(Texts.clean(r.email()).toLowerCase(Locale.ROOT));
            u.setBusinessPhone(Texts.clean(r.phone()));
        }
        u.setAccountType(r.accountType());
        users.save(u);
        audit.log(u.getId(), "ACCOUNT_TYPE_" + r.accountType().name(), null);
        return UserDtos.toMe(u, quota.quotaFor(u));
    }

    /** Re-acceptarea termenilor după o actualizare a lor. */
    @PostMapping("/me/accept-terms")
    @Transactional
    UserDtos.Me acceptTerms() {
        User u = users.findById(CurrentUser.id()).orElseThrow(ApiException::notFound);
        u.acceptTerms(com.velosyntech.cumped.auth.AuthService.TERMS_VERSION);
        users.save(u);
        return UserDtos.toMe(u, quota.quotaFor(u));
    }

    @PostMapping("/users/{id}/block")
    void block(@PathVariable UUID id) {
        users.findById(id).orElseThrow(ApiException::notFound);
        blocks.block(CurrentUser.id(), id);
        audit.log(CurrentUser.id(), "USER_BLOCKED", id.toString());
    }

    @DeleteMapping("/users/{id}/block")
    void unblock(@PathVariable UUID id) { blocks.unblock(CurrentUser.id(), id); }

    @GetMapping("/me/blocks")
    List<UserDtos.PublicUser> myBlocks() {
        List<UUID> ids = jdbc.sql("SELECT blocked_id FROM user_blocks WHERE blocker_id = ? ORDER BY created_at DESC")
                .param(CurrentUser.id()).query(UUID.class).list();
        return users.findAllById(ids).stream().map(UserDtos::toPublic).toList();
    }

    private static boolean blank(String s) { return s == null || s.isBlank(); }

    @GetMapping("/me")
    UserDtos.Me me() {
        User u = users.findById(CurrentUser.id()).orElseThrow(ApiException::notFound);
        return UserDtos.toMe(u, quota.quotaFor(u));
    }

    @PatchMapping("/me")
    @Transactional
    UserDtos.Me update(@Valid @RequestBody Update r) {
        User u = users.findById(CurrentUser.id()).orElseThrow(ApiException::notFound);
        if (r.username() != null && !r.username().equalsIgnoreCase(u.getUsername())) {
            String name = AuthService.normalizeUsername(r.username());
            if (users.existsByUsernameIgnoreCase(name)) throw ApiException.conflict("USERNAME_TAKEN");
            u.setUsername(name);
        }
        if (r.displayMode() != null) {
            if (r.displayMode() == User.DisplayMode.REAL_NAME && !u.isIdVerified()) throw ApiException.badRequest("VERIFICATION_REQUIRED");
            u.setDisplayMode(r.displayMode());
        }
        if (r.bio() != null) {
            String bio = Texts.clean(r.bio());
            if (scam.containsLink(bio)) throw ApiException.badRequest("LINKS_NOT_ALLOWED");
            u.setBio(bio.isEmpty() ? null : bio);
        }
        if (r.city() != null) u.setCity(Texts.clean(r.city()));
        if (r.country() != null) u.setCountry(r.country());
        if (r.locale() != null) u.setLocale(r.locale());
        users.save(u);
        return UserDtos.toMe(u, quota.quotaFor(u));
    }

    @GetMapping("/users/{id}")
    UserDtos.PublicUser publicProfile(@PathVariable UUID id) {
        User u = users.findById(id).filter(x -> !x.isSuspended()).orElseThrow(ApiException::notFound);
        return UserDtos.toPublic(u);
    }

    @GetMapping("/users/{id}/listings")
    List<ListingDtos.Card> userListings(@PathVariable UUID id) {
        users.findById(id).filter(x -> !x.isSuspended()).orElseThrow(ApiException::notFound);
        return queries.bySeller(id, CurrentUser.idOptional().orElse(null), false);
    }

    /**
     * Numele real de pe document: vizibil doar pentru utilizatori logați și verificați la rândul lor.
     * Fiecare dezvăluire e înregistrată în audit și limitată ca număr (anti-scraping).
     */
    @GetMapping("/users/{id}/real-name")
    UserDtos.RealName realName(@PathVariable UUID id) {
        UUID me = CurrentUser.id();
        User viewer = users.findById(me).orElseThrow(ApiException::notFound);
        if (!viewer.isIdVerified()) throw new ApiException(HttpStatus.FORBIDDEN, "VERIFICATION_REQUIRED");
        User target = users.findById(id).filter(x -> !x.isSuspended()).orElseThrow(ApiException::notFound);
        if (!target.isIdVerified()) throw ApiException.notFound();
        audit.log(me, "REAL_NAME_REVEAL", id.toString());
        return new UserDtos.RealName(target.legalFullName());
    }

    @GetMapping("/me/stats")
    Stats stats() {
        UUID me = CurrentUser.id();
        List<ListingStat> rows = jdbc.sql("""
                SELECT l.id, l.title, l.status, l.view_count, l.fav_count, l.msg_count,
                       (SELECT count(*) FROM offers o WHERE o.listing_id = l.id) AS offers
                FROM listings l WHERE l.seller_id = ? AND l.status <> 'DELETED' ORDER BY l.created_at DESC""")
                .param(me)
                .query((rs, i) -> new ListingStat(rs.getObject(1, UUID.class), rs.getString(2), rs.getString(3),
                        rs.getInt(4), rs.getInt(5), rs.getInt(6), rs.getLong(7))).list();
        Map<LocalDate, Integer> byDay = new LinkedHashMap<>();
        LocalDate today = LocalDate.now(ZoneOffset.UTC);
        for (int i = 13; i >= 0; i--) byDay.put(today.minusDays(i), 0);
        jdbc.sql("""
                SELECT v.day, sum(v.views) FROM listing_views_daily v JOIN listings l ON l.id = v.listing_id
                WHERE l.seller_id = ? AND v.day >= ? GROUP BY v.day""")
                .params(me, today.minusDays(13))
                .query((rs, i) -> Map.entry(rs.getDate(1).toLocalDate(), rs.getInt(2))).list()
                .forEach(e -> byDay.put(e.getKey(), e.getValue()));
        List<Map<String, Object>> days = byDay.entrySet().stream()
                .map(e -> Map.<String, Object>of("day", e.getKey().toString(), "views", e.getValue())).toList();
        return new Stats(rows.stream().mapToInt(ListingStat::views).sum(), rows.stream().mapToInt(ListingStat::favorites).sum(),
                rows.stream().mapToInt(ListingStat::messages).sum(), rows.stream().mapToLong(ListingStat::offers).sum(),
                rows.stream().filter(r -> "SOLD".equals(r.status())).count(), days, rows);
    }

    /** GDPR: exportul datelor proprii. */
    @GetMapping("/me/export")
    Map<String, Object> export() {
        UUID me = CurrentUser.id();
        User u = users.findById(me).orElseThrow(ApiException::notFound);
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("profile", UserDtos.toMe(u, quota.quotaFor(u)));
        out.put("listings", queries.bySeller(me, me, true));
        out.put("favorites", queries.favorites(me));
        out.put("messagesSent", jdbc.sql("SELECT body, created_at FROM messages WHERE sender_id = ? ORDER BY created_at")
                .param(me).query((rs, i) -> Map.of("body", rs.getString(1), "at", rs.getTimestamp(2).toInstant())).list());
        audit.log(me, "DATA_EXPORT", null);
        return out;
    }

    /** GDPR: ștergerea contului. Datele personale sunt eliminate; anunțurile sunt scoase. */
    @DeleteMapping("/me")
    @Transactional
    void deleteAccount() {
        UUID me = CurrentUser.id();
        User u = users.findById(me).orElseThrow(ApiException::notFound);
        // Anunțurile rămân doar ca rânduri goale (pentru ofertele/conversațiile celorlalți), fără text și fără poze.
        jdbc.sql("UPDATE listings SET status = 'DELETED', description = '', attributes = '', min_price_cents = NULL WHERE seller_id = ?").param(me).update();
        images.findByOwnerId(me).forEach(media::delete);
        jdbc.sql("DELETE FROM favorites WHERE user_id = ?").param(me).update();
        jdbc.sql("DELETE FROM saved_searches WHERE user_id = ?").param(me).update();
        jdbc.sql("DELETE FROM notifications WHERE user_id = ?").param(me).update();
        jdbc.sql("DELETE FROM velo_sessions WHERE user_id = ?").param(me).update();
        jdbc.sql("DELETE FROM user_blocks WHERE blocker_id = ? OR blocked_id = ?").params(me, me).update();
        String anon = "deleted_" + Texts.randomCode(8).toLowerCase(Locale.ROOT);
        u.setEmail(anon + "@deleted.invalid");
        u.setUsername(anon);
        u.setPasswordHash(null);
        u.setLegalFirstName(null);
        u.setLegalLastName(null);
        u.setPhoneHash(null);
        u.setPhoneLast2(null);
        u.setGoogleSub(null);
        u.setAppleSub(null);
        u.setBio(null);
        u.setCity(null);
        u.setAccountType(User.AccountType.PRIVATE);
        u.setBusinessName(null); u.setBusinessRegNo(null); u.setBusinessVat(null);
        u.setBusinessAddress(null); u.setBusinessEmail(null); u.setBusinessPhone(null);
        u.setSuspended(true);
        u.setSuspendedReason("DELETED");
        u.bumpTokenVersion();
        users.save(u);
        tokens.revokeAll(me);
        statusCache.evict(me);
        audit.log(me, "ACCOUNT_DELETED", null);
    }
}
