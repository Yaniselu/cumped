package com.velosyntech.cumped.admin;

import com.velosyntech.cumped.common.ApiException;
import com.velosyntech.cumped.common.AuditService;
import com.velosyntech.cumped.common.CurrentUser;
import com.velosyntech.cumped.config.UserStatusCache;
import com.velosyntech.cumped.listing.Listing;
import com.velosyntech.cumped.listing.ListingRepository;
import com.velosyntech.cumped.notification.NotificationService;
import com.velosyntech.cumped.user.User;
import com.velosyntech.cumped.user.UserRepository;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.time.Instant;
import java.util.*;

/** Panoul de admin: tichete Velo, confirmarea/anularea acțiunilor automate, moderare. Doar rol ADMIN. */
@RestController
@RequestMapping("/api/admin")
public class AdminController {
    public record TicketRow(UUID id, String code, String category, String priority, int risk, String status,
                            String source, String autoAction, String autoActionState, String summary,
                            String reporter, String reportedUser, UUID relatedListingId, String relatedListingTitle,
                            Instant createdAt) {}
    public record TicketDetail(TicketRow ticket, String transcript) {}

    private final JdbcClient jdbc;
    private final ListingRepository listings;
    private final UserRepository users;
    private final NotificationService notifications;
    private final AuditService audit;
    private final UserStatusCache statusCache;

    public AdminController(JdbcClient jdbc, ListingRepository listings, UserRepository users,
                           NotificationService notifications, AuditService audit, UserStatusCache statusCache) {
        this.jdbc = jdbc;
        this.listings = listings;
        this.users = users;
        this.notifications = notifications;
        this.audit = audit;
        this.statusCache = statusCache;
    }

    private static final String TICKET_SELECT = """
            SELECT t.id, t.code, t.category, t.priority, t.risk_score, t.status, t.source, t.auto_action, t.auto_action_state,
                   t.summary, r.username AS reporter, u.username AS reported, t.related_listing_id, l.title, t.created_at, t.transcript
            FROM support_tickets t
            LEFT JOIN users r ON r.id = t.reporter_id
            LEFT JOIN users u ON u.id = t.related_user_id
            LEFT JOIN listings l ON l.id = t.related_listing_id
            """;

    @GetMapping("/overview")
    Map<String, Object> overview() {
        return Map.of(
                "users", count("SELECT count(*) FROM users"),
                "verifiedUsers", count("SELECT count(*) FROM users WHERE id_verified"),
                "activeListings", count("SELECT count(*) FROM listings WHERE status = 'ACTIVE'"),
                "openTickets", count("SELECT count(*) FROM support_tickets WHERE status = 'OPEN'"),
                "pendingAutoActions", count("SELECT count(*) FROM support_tickets WHERE auto_action_state = 'APPLIED'"),
                "blockedMessages24h", count("SELECT count(*) FROM audit_log WHERE action = 'MSG_BLOCKED' AND created_at > now() - interval '24 hours'"),
                "pendingEmails", count("SELECT count(*) FROM mail_outbox WHERE sent_at IS NULL"));
    }

    @GetMapping("/tickets")
    List<TicketRow> tickets(@RequestParam(defaultValue = "OPEN") String status) {
        if (!Set.of("OPEN", "RESOLVED", "ALL").contains(status)) throw ApiException.badRequest("INVALID_STATUS");
        String where = "ALL".equals(status) ? "" : " WHERE t.status = :status";
        var q = jdbc.sql(TICKET_SELECT + where + " ORDER BY CASE t.priority WHEN 'URGENT' THEN 0 WHEN 'HIGH' THEN 1 WHEN 'MEDIUM' THEN 2 ELSE 3 END, t.created_at DESC LIMIT 200");
        if (!"ALL".equals(status)) q = q.param("status", status);
        return q.query((rs, i) -> row(rs)).list();
    }

    @GetMapping("/tickets/{id}")
    TicketDetail ticket(@PathVariable UUID id) {
        audit.log(CurrentUser.id(), "ADMIN_VIEW_TICKET", id.toString());
        return jdbc.sql(TICKET_SELECT + " WHERE t.id = ?").param(id)
                .query((rs, i) -> new TicketDetail(row(rs), rs.getString("transcript")))
                .optional().orElseThrow(ApiException::notFound);
    }

    /** confirm = acțiunea Velo rămâne definitivă; revert = anulăm (anunțul revine / contul e reactivat). */
    @PostMapping("/tickets/{id}/{action}")
    @Transactional
    Map<String, Object> decide(@PathVariable UUID id, @PathVariable String action) {
        record T(String autoAction, String state, UUID listingId, UUID userId) {}
        T t = jdbc.sql("SELECT auto_action, auto_action_state, related_listing_id, related_user_id FROM support_tickets WHERE id = ?")
                .param(id).query((rs, i) -> new T(rs.getString(1), rs.getString(2), rs.getObject(3, UUID.class), rs.getObject(4, UUID.class)))
                .optional().orElseThrow(ApiException::notFound);
        UUID admin = CurrentUser.id();
        switch (action) {
            case "confirm" -> {
                if (!"APPLIED".equals(t.state())) throw ApiException.conflict("NO_PENDING_ACTION");
                if ("HIDE_LISTING".equals(t.autoAction()) && t.listingId() != null) {
                    listings.findById(t.listingId()).ifPresent(l -> {
                        l.setStatus(Listing.Status.REMOVED);
                        String reason = jdbc.sql("SELECT coalesce(reason, category) FROM support_tickets WHERE id = ?").param(id).query(String.class).single();
                        l.setModerationReason(reason);
                        listings.save(l);
                        // Expunerea motivelor (DSA art. 17): vânzătorul află de ce și poate contesta.
                        notifications.notify(l.getSellerId(), "LISTING_REMOVED", Map.of("title", l.getTitle(), "reason", reason), "/listing/" + l.getId());
                    });
                }
                setState(id, "CONFIRMED", "RESOLVED");
            }
            case "revert" -> {
                if (!"APPLIED".equals(t.state())) throw ApiException.conflict("NO_PENDING_ACTION");
                if ("HIDE_LISTING".equals(t.autoAction()) && t.listingId() != null) {
                    listings.findById(t.listingId()).filter(l -> l.getStatus() == Listing.Status.HIDDEN_BY_AI).ifPresent(l -> {
                        l.setStatus(Listing.Status.ACTIVE);
                        listings.save(l);
                        notifications.notify(l.getSellerId(), "LISTING_RESTORED", Map.of("title", l.getTitle()), "/listing/" + l.getId());
                    });
                }
                if ("SUSPEND_USER".equals(t.autoAction()) && t.userId() != null) unsuspend(t.userId());
                setState(id, "REVERTED", "OPEN");
            }
            case "resolve" -> jdbc.sql("UPDATE support_tickets SET status = 'RESOLVED', updated_at = now() WHERE id = ?").param(id).update();
            case "reopen" -> jdbc.sql("UPDATE support_tickets SET status = 'OPEN', updated_at = now() WHERE id = ?").param(id).update();
            default -> throw ApiException.badRequest("UNKNOWN_ACTION");
        }
        audit.log(admin, "ADMIN_TICKET_" + action.toUpperCase(Locale.ROOT), id.toString());
        return Map.of("ok", true);
    }

    @PostMapping("/users/{id}/suspend")
    @Transactional
    void suspend(@PathVariable UUID id) {
        User u = users.findById(id).orElseThrow(ApiException::notFound);
        if (u.getRole() == User.Role.ADMIN) throw ApiException.forbidden();
        u.setSuspended(true);
        u.setSuspendedReason("ADMIN");
        u.bumpTokenVersion();
        users.save(u);
        statusCache.evict(id);
        audit.log(CurrentUser.id(), "ADMIN_SUSPEND", id.toString());
    }

    @PostMapping("/users/{id}/unsuspend")
    @Transactional
    void unsuspendEndpoint(@PathVariable UUID id) {
        unsuspend(id);
        audit.log(CurrentUser.id(), "ADMIN_UNSUSPEND", id.toString());
    }

    private void unsuspend(UUID id) {
        users.findById(id).filter(u -> !"DELETED".equals(u.getSuspendedReason())).ifPresent(u -> {
            u.setSuspended(false);
            u.setSuspendedReason(null);
            users.save(u);
            statusCache.evict(id);
        });
    }

    private void setState(UUID id, String state, String status) {
        jdbc.sql("UPDATE support_tickets SET auto_action_state = ?, status = ?, updated_at = now() WHERE id = ?").params(state, status, id).update();
    }

    private int count(String sql) { return jdbc.sql(sql).query(Integer.class).single(); }

    private static TicketRow row(java.sql.ResultSet rs) throws java.sql.SQLException {
        return new TicketRow(rs.getObject("id", UUID.class), rs.getString("code"), rs.getString("category"),
                rs.getString("priority"), rs.getInt("risk_score"), rs.getString("status"), rs.getString("source"),
                rs.getString("auto_action"), rs.getString("auto_action_state"), rs.getString("summary"),
                rs.getString("reporter"), rs.getString("reported"), rs.getObject("related_listing_id", UUID.class),
                rs.getString("title"), rs.getTimestamp("created_at").toInstant());
    }
}
