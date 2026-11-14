package com.velosyntech.cumped.chat;

import com.velosyntech.cumped.common.ApiException;
import com.velosyntech.cumped.common.AuditService;
import com.velosyntech.cumped.common.Texts;
import com.velosyntech.cumped.listing.Listing;
import com.velosyntech.cumped.listing.ListingRepository;
import com.velosyntech.cumped.media.ListingImage;
import com.velosyntech.cumped.notification.NotificationService;
import com.velosyntech.cumped.user.User;
import com.velosyntech.cumped.user.UserDtos;
import com.velosyntech.cumped.user.UserRepository;
import com.velosyntech.cumped.velo.ScamDetector;
import com.velosyntech.cumped.velo.SuspiciousActivityEvent;
import com.velosyntech.cumped.moderation.ContentPolicy;
import com.velosyntech.cumped.user.BlockService;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.*;

@Service
public class ChatService {
    public record ListingMini(UUID id, String title, long priceCents, String currency, String imageUrl, String status) {}
    public record Summary(UUID id, ListingMini listing, UserDtos.PublicUser other, String role, String lastMessage,
                          Instant lastAt, int unread, boolean blocked) {}
    public record Message(UUID id, boolean mine, String body, boolean flagged, String flagReason, Instant createdAt, boolean read) {}
    public record Thread(Summary conversation, List<Message> messages) {}
    public record Sent(Message message, List<String> warnings) {}

    private static final int BLOCKS_BEFORE_REPORT = 3;

    private final JdbcClient jdbc;
    private final ListingRepository listings;
    private final UserRepository users;
    private final ScamDetector scam;
    private final NotificationService notifications;
    private final AuditService audit;
    private final ApplicationEventPublisher events;
    private final ContentPolicy policy;
    private final BlockService blocks;
    private final com.velosyntech.cumped.notification.push.PushService push;

    public ChatService(JdbcClient jdbc, ListingRepository listings, UserRepository users, ScamDetector scam,
                       NotificationService notifications, AuditService audit, ApplicationEventPublisher events,
                       ContentPolicy policy, BlockService blocks, com.velosyntech.cumped.notification.push.PushService push) {
        this.push = push;
        this.jdbc = jdbc;
        this.listings = listings;
        this.users = users;
        this.scam = scam;
        this.notifications = notifications;
        this.audit = audit;
        this.events = events;
        this.policy = policy;
        this.blocks = blocks;
    }

    @Transactional
    public UUID start(UUID buyerId, UUID listingId, String body) {
        Listing l = listings.findById(listingId).orElseThrow(ApiException::notFound);
        if (l.getStatus() != Listing.Status.ACTIVE) throw ApiException.conflict("LISTING_NOT_AVAILABLE");
        if (l.getSellerId().equals(buyerId)) throw ApiException.badRequest("CANNOT_MESSAGE_SELF");
        requireActive(buyerId);
        blocks.requireNotBlocked(buyerId, l.getSellerId());
        Optional<UUID> existing = jdbc.sql("SELECT id FROM conversations WHERE listing_id = ? AND buyer_id = ?")
                .params(listingId, buyerId).query(UUID.class).optional();
        UUID id = existing.orElseGet(() -> {
            UUID nid = UUID.randomUUID();
            jdbc.sql("INSERT INTO conversations(id, listing_id, buyer_id, seller_id) VALUES (?, ?, ?, ?)")
                    .params(nid, listingId, buyerId, l.getSellerId()).update();
            listings.incrementMessages(listingId);
            notifications.notify(l.getSellerId(), "NEW_CONVERSATION", Map.of("title", l.getTitle()), "/chat/" + nid);
            return nid;
        });
        if (body != null && !body.isBlank()) send(buyerId, id, body);
        return id;
    }

    @Transactional(readOnly = true)
    public List<Summary> list(UUID me) {
        List<UUID> ids = jdbc.sql("SELECT id FROM conversations WHERE buyer_id = ? OR seller_id = ? ORDER BY last_message_at DESC LIMIT 200")
                .params(me, me).query(UUID.class).list();
        List<Summary> out = new ArrayList<>();
        for (UUID id : ids) out.add(summary(id, me));
        return out;
    }

    @Transactional
    public Thread thread(UUID me, UUID conversationId, Instant after) {
        Summary s = summary(conversationId, me);
        jdbc.sql("UPDATE messages SET read_at = now() WHERE conversation_id = ? AND sender_id <> ? AND read_at IS NULL")
                .params(conversationId, me).update();
        String sql = "SELECT id, sender_id, body, flagged, flag_reason, created_at, read_at FROM messages WHERE conversation_id = :c"
                + (after != null ? " AND created_at > :after" : "") + " ORDER BY created_at ASC LIMIT 500";
        var q = jdbc.sql(sql).param("c", conversationId);
        if (after != null) q = q.param("after", java.sql.Timestamp.from(after));
        List<Message> msgs = q.query((rs, i) -> new Message(rs.getObject(1, UUID.class),
                me.equals(rs.getObject(2, UUID.class)), rs.getString(3), rs.getBoolean(4), rs.getString(5),
                rs.getTimestamp(6).toInstant(), rs.getTimestamp(7) != null)).list();
        return new Thread(s, msgs);
    }

    @Transactional(noRollbackFor = ApiException.class)
    public Sent send(UUID me, UUID conversationId, String rawBody) {
        record Conv(UUID listingId, UUID buyerId, UUID sellerId) {}
        Conv c = jdbc.sql("SELECT listing_id, buyer_id, seller_id FROM conversations WHERE id = ?").param(conversationId)
                .query((rs, i) -> new Conv(rs.getObject(1, UUID.class), rs.getObject(2, UUID.class), rs.getObject(3, UUID.class)))
                .optional().orElseThrow(ApiException::notFound);
        if (!me.equals(c.buyerId()) && !me.equals(c.sellerId())) throw ApiException.notFound();
        requireActive(me);
        String body = Texts.clean(rawBody);
        if (body == null || body.isEmpty() || body.length() > 2000) throw ApiException.badRequest("VALIDATION");
        if (body.startsWith("[[")) throw ApiException.badRequest("VALIDATION"); // rezervat mesajelor de sistem (oferte)
        UUID otherParty = me.equals(c.buyerId()) ? c.sellerId() : c.buyerId();
        blocks.requireNotBlocked(me, otherParty);
        if (policy.offensive(body)) throw new ApiException(HttpStatus.UNPROCESSABLE_CONTENT, "OFFENSIVE_CONTENT");

        ScamDetector.Result check = scam.analyze(body);
        UUID other = me.equals(c.buyerId()) ? c.sellerId() : c.buyerId();
        if (check.blocked()) {
            audit.log(me, "MSG_BLOCKED", String.join(",", check.reasons()));
            int recent = jdbc.sql("SELECT count(*) FROM audit_log WHERE actor_id = ? AND action = 'MSG_BLOCKED' AND created_at > now() - interval '24 hours'")
                    .param(me).query(Integer.class).single();
            if (recent >= BLOCKS_BEFORE_REPORT) {
                events.publishEvent(new SuspiciousActivityEvent(me, c.listingId(), other, check.reasons(), check.sanitized()));
            }
            throw new ApiException(HttpStatus.UNPROCESSABLE_CONTENT, "MESSAGE_BLOCKED");
        }
        UUID id = UUID.randomUUID();
        Instant now = Instant.now();
        jdbc.sql("INSERT INTO messages(id, conversation_id, sender_id, body, flagged, flag_reason, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)")
                .params(id, conversationId, me, check.sanitized(), check.flagged(),
                        check.flagged() ? check.reasons().get(0) : null, java.sql.Timestamp.from(now))
                .update();
        jdbc.sql("UPDATE conversations SET last_message_at = ? WHERE id = ?").params(java.sql.Timestamp.from(now), conversationId).update();
        // alertă pe telefon / în browser: cine a scris și despre ce anunț (fără textul mesajului, pentru confidențialitate)
        String senderName = users.findById(me).map(com.velosyntech.cumped.user.UserDtos::displayName).orElse("");
        String listingTitle = listings.findById(c.listingId()).map(com.velosyntech.cumped.listing.Listing::getTitle).orElse("");
        push.send(other, "NEW_MESSAGE", java.util.Map.of("name", senderName, "title", listingTitle, "conversationId", conversationId), "/chat/" + conversationId);
        return new Sent(new Message(id, true, check.sanitized(), check.flagged(), check.flagged() ? check.reasons().get(0) : null, now, false),
                check.reasons());
    }

    private Summary summary(UUID conversationId, UUID me) {
        record Row(UUID listingId, UUID buyerId, UUID sellerId) {}
        Row r = jdbc.sql("SELECT listing_id, buyer_id, seller_id FROM conversations WHERE id = ?").param(conversationId)
                .query((rs, i) -> new Row(rs.getObject(1, UUID.class), rs.getObject(2, UUID.class), rs.getObject(3, UUID.class)))
                .optional().orElseThrow(ApiException::notFound);
        if (!me.equals(r.buyerId()) && !me.equals(r.sellerId())) throw ApiException.notFound();
        UUID otherId = me.equals(r.buyerId()) ? r.sellerId() : r.buyerId();
        User other = users.findById(otherId).orElseThrow(ApiException::notFound);
        ListingMini mini = jdbc.sql("""
                SELECT l.id, l.title, l.price_cents, l.currency, l.status, img.id AS img_id, img.storage_key
                FROM listings l LEFT JOIN LATERAL (SELECT id, storage_key FROM listing_images WHERE listing_id = l.id ORDER BY position LIMIT 1) img ON true
                WHERE l.id = ?""").param(r.listingId())
                .query((rs, i) -> new ListingMini(rs.getObject(1, UUID.class), rs.getString(2), rs.getLong(3), rs.getString(4),
                        rs.getObject("img_id", UUID.class) == null ? null : ListingImage.thumbUrl(rs.getObject("img_id", UUID.class), rs.getString("storage_key")),
                        rs.getString(5)))
                .single();
        record Last(String body, Instant at) {}
        Last last = jdbc.sql("SELECT body, created_at FROM messages WHERE conversation_id = ? ORDER BY created_at DESC LIMIT 1")
                .param(conversationId).query((rs, i) -> new Last(rs.getString(1), rs.getTimestamp(2).toInstant())).optional().orElse(null);
        int unread = jdbc.sql("SELECT count(*) FROM messages WHERE conversation_id = ? AND sender_id <> ? AND read_at IS NULL")
                .params(conversationId, me).query(Integer.class).single();
        return new Summary(conversationId, mini, UserDtos.toPublic(other), me.equals(r.buyerId()) ? "BUYER" : "SELLER",
                last == null ? null : last.body(), last == null ? null : last.at(), unread, blocks.eitherBlocked(me, otherId));
    }

    private void requireActive(UUID userId) {
        User u = users.findById(userId).orElseThrow(ApiException::notFound);
        if (u.isSuspended()) throw new ApiException(HttpStatus.FORBIDDEN, "ACCOUNT_SUSPENDED");
    }
}
