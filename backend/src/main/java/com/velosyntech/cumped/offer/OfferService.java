package com.velosyntech.cumped.offer;

import com.velosyntech.cumped.common.ApiException;
import com.velosyntech.cumped.common.Texts;
import com.velosyntech.cumped.listing.Listing;
import com.velosyntech.cumped.listing.ListingDtos;
import com.velosyntech.cumped.listing.ListingQueries;
import com.velosyntech.cumped.listing.ListingRepository;
import com.velosyntech.cumped.moderation.ContentPolicy;
import com.velosyntech.cumped.notification.NotificationService;
import com.velosyntech.cumped.user.BlockService;
import com.velosyntech.cumped.user.User;
import com.velosyntech.cumped.user.UserDtos;
import com.velosyntech.cumped.user.UserRepository;
import com.velosyntech.cumped.velo.ScamDetector;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.sql.Timestamp;
import java.time.Duration;
import java.time.Instant;
import java.util.*;

/**
 * Negociere între cumpărător și vânzător, pe „fire”:
 *  - cumpărătorul face o ofertă de preț sau de schimb;
 *  - cel care primește oferta o poate accepta, refuza sau poate face o contraofertă;
 *  - cine a făcut oferta o poate retrage cât timp e în așteptare;
 *  - fiecare ofertă expiră după 48h; maxim 6 runde pe fir;
 *  - ofertele sub prețul minim stabilit în privat de vânzător sunt refuzate automat.
 * Fiecare pas apare și în conversația din chat.
 */
@Service
public class OfferService {
    public static final int MAX_ROUNDS = 6;
    public static final Duration TTL = Duration.ofHours(48);

    public record Step(UUID id, String proposer, String kind, Long amountCents, ListingDtos.Card swapListing,
                       String message, String status, int round, Instant createdAt, Instant expiresAt) {}
    public record Negotiation(UUID threadId, String myRole, ListingDtos.Card listing, UserDtos.PublicUser counterpart,
                              Step current, boolean myTurn, boolean canCounter, List<Step> history, UUID conversationId) {}

    private record Row(UUID id, UUID listingId, UUID buyerId, String kind, Long amount, UUID swapId, String message,
                       String status, String proposer, int round, Instant createdAt, Instant expiresAt, UUID threadId) {}

    private static final String ROW_SQL = "SELECT id, listing_id, buyer_id, kind, amount_cents, swap_listing_id, message, status, proposer, round, created_at, expires_at, thread_id FROM offers";

    private final JdbcClient jdbc;
    private final ListingRepository listings;
    private final ListingQueries queries;
    private final UserRepository users;
    private final NotificationService notifications;
    private final ScamDetector scam;
    private final ContentPolicy policy;
    private final BlockService blocks;

    public OfferService(JdbcClient jdbc, ListingRepository listings, ListingQueries queries, UserRepository users,
                        NotificationService notifications, ScamDetector scam, ContentPolicy policy, BlockService blocks) {
        this.jdbc = jdbc;
        this.listings = listings;
        this.queries = queries;
        this.users = users;
        this.notifications = notifications;
        this.scam = scam;
        this.policy = policy;
        this.blocks = blocks;
    }

    // ---------- acțiuni ----------

    @Transactional
    public UUID create(UUID buyerId, UUID listingId, String kind, Long amountCents, UUID swapListingId, String message) {
        Listing l = listings.findById(listingId).orElseThrow(ApiException::notFound);
        if (l.getStatus() != Listing.Status.ACTIVE) throw ApiException.conflict("LISTING_NOT_AVAILABLE");
        if (l.getSellerId().equals(buyerId)) throw ApiException.badRequest("CANNOT_OFFER_OWN");
        requireActive(buyerId);
        blocks.requireNotBlocked(buyerId, l.getSellerId());
        String msg = cleanMessage(message);
        int open = jdbc.sql("SELECT count(*) FROM offers WHERE listing_id = ? AND buyer_id = ? AND status = 'PENDING'")
                .params(listingId, buyerId).query(Integer.class).single();
        if (open > 0) throw ApiException.conflict("OFFER_ALREADY_PENDING");

        switch (kind) {
            case "PRICE" -> {
                if (!l.isAcceptsOffers() || !l.isNegotiable()) throw ApiException.badRequest("OFFERS_DISABLED");
                validatePrice(l, amountCents);
                swapListingId = null;
            }
            case "SWAP" -> {
                if (!l.isAcceptsSwap()) throw ApiException.badRequest("SWAP_DISABLED");
                Listing mine = listings.findById(swapListingId == null ? new UUID(0, 0) : swapListingId)
                        .orElseThrow(() -> ApiException.badRequest("INVALID_SWAP_LISTING"));
                if (!mine.getSellerId().equals(buyerId) || mine.getStatus() != Listing.Status.ACTIVE)
                    throw ApiException.badRequest("INVALID_SWAP_LISTING");
                if (amountCents != null && (amountCents < 0 || amountCents > l.getPriceCents())) throw ApiException.badRequest("INVALID_AMOUNT");
            }
            default -> throw ApiException.badRequest("INVALID_KIND");
        }
        UUID id = UUID.randomUUID();
        insert(id, id, null, listingId, buyerId, kind, amountCents, swapListingId, msg, "BUYER", 1);
        UUID conv = ensureConversation(l, buyerId);
        systemMessage(conv, buyerId, "NEW", amountCents, l.getCurrency(), kind);

        // Sub minimul privat al vânzătorului: refuz automat, fără să dezvăluim minimul.
        if ("PRICE".equals(kind) && l.getMinPriceCents() != null && amountCents < l.getMinPriceCents()) {
            setStatus(id, "DECLINED");
            systemMessage(conv, l.getSellerId(), "AUTO_DECLINED", amountCents, l.getCurrency(), kind);
            notifications.notify(buyerId, "OFFER_AUTO_DECLINED", Map.of("title", l.getTitle()), "/offers");
            return id;
        }
        notifications.notify(l.getSellerId(), "SWAP".equals(kind) ? "SWAP_RECEIVED" : "OFFER_RECEIVED",
                Map.of("title", l.getTitle(), "amount", amountCents == null ? 0 : amountCents, "currency", l.getCurrency()), "/offers");
        return id;
    }

    @Transactional
    public void respond(UUID me, UUID offerId, String action, Long counterAmount, String counterMessage) {
        Row o = load(offerId);
        Listing l = listings.findById(o.listingId()).orElseThrow(ApiException::notFound);
        boolean iAmSeller = l.getSellerId().equals(me), iAmBuyer = o.buyerId().equals(me);
        if (!iAmSeller && !iAmBuyer) throw ApiException.notFound();
        if (!"PENDING".equals(o.status())) throw ApiException.conflict("OFFER_NOT_PENDING");
        if (o.expiresAt().isBefore(Instant.now())) { setStatus(o.id(), "EXPIRED"); throw ApiException.conflict("OFFER_EXPIRED"); }
        String myRole = iAmSeller ? "SELLER" : "BUYER";
        boolean iProposed = myRole.equals(o.proposer());
        UUID other = iAmSeller ? o.buyerId() : l.getSellerId();
        UUID conv = ensureConversation(l, o.buyerId());

        switch (action) {
            case "withdraw" -> {
                if (!iProposed) throw ApiException.forbidden();
                setStatus(o.id(), "WITHDRAWN");
                systemMessage(conv, me, "WITHDRAWN", o.amount(), l.getCurrency(), o.kind());
            }
            case "accept", "decline" -> {
                if (iProposed) throw ApiException.forbidden();
                boolean accept = "accept".equals(action);
                if (accept && l.getStatus() != Listing.Status.ACTIVE) throw ApiException.conflict("LISTING_NOT_AVAILABLE");
                setStatus(o.id(), accept ? "ACCEPTED" : "DECLINED");
                systemMessage(conv, me, accept ? "ACCEPTED" : "DECLINED", o.amount(), l.getCurrency(), o.kind());
                notifications.notify(other, accept ? "OFFER_ACCEPTED" : "OFFER_DECLINED",
                        Map.of("title", l.getTitle(), "amount", o.amount() == null ? 0 : o.amount(), "currency", l.getCurrency()),
                        "/listing/" + l.getId());
            }
            case "counter" -> {
                if (iProposed) throw ApiException.forbidden();
                if (o.round() >= MAX_ROUNDS) throw ApiException.conflict("MAX_ROUNDS");
                if (!l.isNegotiable()) throw ApiException.badRequest("OFFERS_DISABLED");
                blocks.requireNotBlocked(me, other);
                validatePrice(l, counterAmount);
                if ("SELLER".equals(myRole) && o.amount() != null && "PRICE".equals(o.kind()) && counterAmount <= o.amount())
                    throw ApiException.badRequest("COUNTER_MUST_BE_HIGHER");
                if ("BUYER".equals(myRole) && o.amount() != null && "PRICE".equals(o.kind()) && counterAmount >= o.amount())
                    throw ApiException.badRequest("COUNTER_MUST_BE_LOWER");
                String msg = cleanMessage(counterMessage);
                setStatus(o.id(), "COUNTERED");
                UUID id = UUID.randomUUID();
                insert(id, o.threadId(), o.id(), l.getId(), o.buyerId(), "PRICE", counterAmount,
                        null, msg, myRole, o.round() + 1);
                systemMessage(conv, me, "COUNTER", counterAmount, l.getCurrency(), "PRICE");
                notifications.notify(other, "OFFER_COUNTERED",
                        Map.of("title", l.getTitle(), "amount", counterAmount, "currency", l.getCurrency()), "/offers");
            }
            default -> throw ApiException.badRequest("UNKNOWN_ACTION");
        }
    }

    @Scheduled(cron = "0 */10 * * * *")
    @Transactional
    public void expire() {
        jdbc.sql("UPDATE offers SET status = 'EXPIRED', decided_at = now() WHERE status = 'PENDING' AND expires_at < now()").update();
    }

    // ---------- citire ----------

    @Transactional(readOnly = true)
    public List<Negotiation> list(UUID me) {
        List<UUID> threads = jdbc.sql("""
                SELECT o.thread_id FROM offers o JOIN listings l ON l.id = o.listing_id
                WHERE o.buyer_id = :me OR l.seller_id = :me
                GROUP BY o.thread_id ORDER BY max(o.created_at) DESC LIMIT 100""")
                .param("me", me).query(UUID.class).list();
        List<Negotiation> out = new ArrayList<>();
        for (UUID t : threads) out.add(thread(me, t));
        return out;
    }

    @Transactional(readOnly = true)
    public Negotiation thread(UUID me, UUID threadId) {
        List<Row> rows = jdbc.sql(ROW_SQL + " WHERE thread_id = ? ORDER BY round ASC, created_at ASC").param(threadId).query(this::row).list();
        if (rows.isEmpty()) throw ApiException.notFound();
        Row last = rows.get(rows.size() - 1);
        Listing l = listings.findById(last.listingId()).orElseThrow(ApiException::notFound);
        boolean seller = l.getSellerId().equals(me);
        if (!seller && !last.buyerId().equals(me)) throw ApiException.notFound();
        String myRole = seller ? "SELLER" : "BUYER";
        UUID otherId = seller ? last.buyerId() : l.getSellerId();
        UserDtos.PublicUser cp = users.findById(otherId).map(UserDtos::toPublic).orElse(null);

        Set<UUID> cardIds = new LinkedHashSet<>();
        cardIds.add(l.getId());
        rows.stream().map(Row::swapId).filter(Objects::nonNull).forEach(cardIds::add);
        Map<UUID, ListingDtos.Card> cards = new HashMap<>();
        queries.byIds(cardIds, me).forEach(c -> cards.put(c.id(), c));

        List<Step> steps = rows.stream().map(r -> new Step(r.id(), r.proposer(), r.kind(), r.amount(),
                r.swapId() == null ? null : cards.get(r.swapId()), r.message(), effectiveStatus(r), r.round(), r.createdAt(), r.expiresAt())).toList();
        Step current = steps.get(steps.size() - 1);
        boolean pending = "PENDING".equals(current.status());
        boolean myTurn = pending && !myRole.equals(current.proposer());
        UUID conv = jdbc.sql("SELECT id FROM conversations WHERE listing_id = ? AND buyer_id = ?").params(l.getId(), last.buyerId())
                .query(UUID.class).optional().orElse(null);
        return new Negotiation(threadId, myRole, cards.get(l.getId()), cp, current, myTurn,
                myTurn && current.round() < MAX_ROUNDS && l.isNegotiable(), steps, conv);
    }

    /** Numărul de oferte la care trebuie să răspund eu (pentru insigne). */
    public int awaitingMe(UUID me) {
        return jdbc.sql("""
                SELECT count(*) FROM offers o JOIN listings l ON l.id = o.listing_id
                WHERE o.status = 'PENDING' AND o.expires_at > now()
                  AND ((o.proposer = 'BUYER' AND l.seller_id = :me) OR (o.proposer = 'SELLER' AND o.buyer_id = :me))""")
                .param("me", me).query(Integer.class).single();
    }

    // ---------- intern ----------

    private void validatePrice(Listing l, Long amount) {
        if (amount == null || amount <= 0 || amount > l.getPriceCents()) throw ApiException.badRequest("INVALID_AMOUNT");
        if (amount < l.getPriceCents() * 0.3) throw ApiException.badRequest("OFFER_TOO_LOW");
    }

    private String cleanMessage(String message) {
        String msg = Texts.clean(message);
        if (msg == null || msg.isEmpty()) return null;
        if (msg.length() > 400) throw ApiException.badRequest("VALIDATION");
        if (scam.analyze(msg).blocked()) throw new ApiException(HttpStatus.UNPROCESSABLE_CONTENT, "MESSAGE_BLOCKED");
        if (policy.offensive(msg)) throw new ApiException(HttpStatus.UNPROCESSABLE_CONTENT, "OFFENSIVE_CONTENT");
        return scam.analyze(msg).sanitized();
    }

    private void insert(UUID id, UUID threadId, UUID parentId, UUID listingId, UUID buyerId, String kind, Long amount,
                        UUID swapId, String msg, String proposer, int round) {
        jdbc.sql("""
                INSERT INTO offers(id, thread_id, parent_id, listing_id, buyer_id, kind, amount_cents, swap_listing_id, message, proposer, round, expires_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""")
                .params(id, threadId, parentId, listingId, buyerId, kind, amount, swapId, msg, proposer, round,
                        Timestamp.from(Instant.now().plus(TTL)))
                .update();
    }

    private void setStatus(UUID id, String status) {
        jdbc.sql("UPDATE offers SET status = ?, decided_at = now() WHERE id = ?").params(status, id).update();
    }

    private UUID ensureConversation(Listing l, UUID buyerId) {
        return jdbc.sql("SELECT id FROM conversations WHERE listing_id = ? AND buyer_id = ?").params(l.getId(), buyerId)
                .query(UUID.class).optional().orElseGet(() -> {
                    UUID id = UUID.randomUUID();
                    jdbc.sql("INSERT INTO conversations(id, listing_id, buyer_id, seller_id) VALUES (?, ?, ?, ?)")
                            .params(id, l.getId(), buyerId, l.getSellerId()).update();
                    return id;
                });
    }

    /** Mesaj de sistem în chat; aplicația îl afișează tradus ca o bulă specială de ofertă. */
    private void systemMessage(UUID conv, UUID sender, String event, Long amount, String currency, String kind) {
        String body = "[[offer:" + event + ":" + (amount == null ? 0 : amount) + ":" + currency + ":" + kind + "]]";
        Instant now = Instant.now();
        jdbc.sql("INSERT INTO messages(id, conversation_id, sender_id, body, created_at) VALUES (?, ?, ?, ?, ?)")
                .params(UUID.randomUUID(), conv, sender, body, Timestamp.from(now)).update();
        jdbc.sql("UPDATE conversations SET last_message_at = ? WHERE id = ?").params(Timestamp.from(now), conv).update();
    }

    private void requireActive(UUID userId) {
        User u = users.findById(userId).orElseThrow(ApiException::notFound);
        if (u.isSuspended()) throw new ApiException(HttpStatus.FORBIDDEN, "ACCOUNT_SUSPENDED");
    }

    private Row load(UUID id) {
        return jdbc.sql(ROW_SQL + " WHERE id = ?").param(id).query(this::row).optional().orElseThrow(ApiException::notFound);
    }

    private static String effectiveStatus(Row r) {
        return "PENDING".equals(r.status()) && r.expiresAt().isBefore(Instant.now()) ? "EXPIRED" : r.status();
    }

    private Row row(java.sql.ResultSet rs, int i) throws java.sql.SQLException {
        return new Row(rs.getObject("id", UUID.class), rs.getObject("listing_id", UUID.class), rs.getObject("buyer_id", UUID.class),
                rs.getString("kind"), (Long) rs.getObject("amount_cents"), rs.getObject("swap_listing_id", UUID.class),
                rs.getString("message"), rs.getString("status"), rs.getString("proposer"), rs.getInt("round"),
                rs.getTimestamp("created_at").toInstant(), rs.getTimestamp("expires_at").toInstant(), rs.getObject("thread_id", UUID.class));
    }
}
