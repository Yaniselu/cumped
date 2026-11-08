package com.velosyntech.cumped.offer;

import com.velosyntech.cumped.common.ApiException;
import com.velosyntech.cumped.common.Texts;
import com.velosyntech.cumped.listing.Listing;
import com.velosyntech.cumped.listing.ListingQueries;
import com.velosyntech.cumped.listing.ListingRepository;
import com.velosyntech.cumped.listing.ListingDtos;
import com.velosyntech.cumped.notification.NotificationService;
import com.velosyntech.cumped.user.User;
import com.velosyntech.cumped.user.UserDtos;
import com.velosyntech.cumped.user.UserRepository;
import com.velosyntech.cumped.velo.ScamDetector;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.*;

/** Oferte de preț și propuneri de schimb (îți dau produsul meu în schimbul produsului tău). */
@Service
public class OfferService {
    public record Offer(UUID id, String kind, Long amountCents, String currency, String message, String status,
                        Instant createdAt, ListingDtos.Card listing, ListingDtos.Card swapListing,
                        UserDtos.PublicUser counterpart) {}

    private final JdbcClient jdbc;
    private final ListingRepository listings;
    private final ListingQueries queries;
    private final UserRepository users;
    private final NotificationService notifications;
    private final ScamDetector scam;

    public OfferService(JdbcClient jdbc, ListingRepository listings, ListingQueries queries, UserRepository users,
                        NotificationService notifications, ScamDetector scam) {
        this.jdbc = jdbc;
        this.listings = listings;
        this.queries = queries;
        this.users = users;
        this.notifications = notifications;
        this.scam = scam;
    }

    @Transactional
    public UUID create(UUID buyerId, UUID listingId, String kind, Long amountCents, UUID swapListingId, String message) {
        Listing l = listings.findById(listingId).orElseThrow(ApiException::notFound);
        if (l.getStatus() != Listing.Status.ACTIVE) throw ApiException.conflict("LISTING_NOT_AVAILABLE");
        if (l.getSellerId().equals(buyerId)) throw ApiException.badRequest("CANNOT_OFFER_OWN");
        User buyer = users.findById(buyerId).orElseThrow(ApiException::notFound);
        if (buyer.isSuspended()) throw new ApiException(HttpStatus.FORBIDDEN, "ACCOUNT_SUSPENDED");
        String msg = Texts.clean(message);
        if (msg != null && msg.length() > 400) throw ApiException.badRequest("VALIDATION");
        if (msg != null && scam.analyze(msg).blocked()) throw new ApiException(HttpStatus.UNPROCESSABLE_CONTENT, "MESSAGE_BLOCKED");
        if (msg != null) msg = scam.analyze(msg).sanitized();
        int pending = jdbc.sql("SELECT count(*) FROM offers WHERE listing_id = ? AND buyer_id = ? AND status = 'PENDING'")
                .params(listingId, buyerId).query(Integer.class).single();
        if (pending > 0) throw ApiException.conflict("OFFER_ALREADY_PENDING");

        switch (kind) {
            case "PRICE" -> {
                if (!l.isAcceptsOffers()) throw ApiException.badRequest("OFFERS_DISABLED");
                if (amountCents == null || amountCents <= 0 || amountCents >= l.getPriceCents()) throw ApiException.badRequest("INVALID_AMOUNT");
                if (amountCents < l.getPriceCents() * 0.3) throw ApiException.badRequest("OFFER_TOO_LOW");
                swapListingId = null;
            }
            case "SWAP" -> {
                if (!l.isAcceptsSwap()) throw ApiException.badRequest("SWAP_DISABLED");
                Listing mine = listings.findById(swapListingId == null ? new UUID(0, 0) : swapListingId)
                        .orElseThrow(() -> ApiException.badRequest("INVALID_SWAP_LISTING"));
                if (!mine.getSellerId().equals(buyerId) || mine.getStatus() != Listing.Status.ACTIVE)
                    throw ApiException.badRequest("INVALID_SWAP_LISTING");
                if (amountCents != null && amountCents < 0) throw ApiException.badRequest("INVALID_AMOUNT");
            }
            default -> throw ApiException.badRequest("INVALID_KIND");
        }
        UUID id = UUID.randomUUID();
        jdbc.sql("INSERT INTO offers(id, listing_id, buyer_id, kind, amount_cents, swap_listing_id, message) VALUES (?, ?, ?, ?, ?, ?, ?)")
                .params(id, listingId, buyerId, kind, amountCents, swapListingId, msg).update();
        notifications.notify(l.getSellerId(), "SWAP".equals(kind) ? "SWAP_RECEIVED" : "OFFER_RECEIVED",
                Map.of("title", l.getTitle(), "amount", amountCents == null ? 0 : amountCents, "currency", l.getCurrency()),
                "/offers");
        return id;
    }

    @Transactional
    public void decide(UUID me, UUID offerId, String action) {
        record Row(UUID listingId, UUID buyerId, String status) {}
        Row o = jdbc.sql("SELECT listing_id, buyer_id, status FROM offers WHERE id = ?").param(offerId)
                .query((rs, i) -> new Row(rs.getObject(1, UUID.class), rs.getObject(2, UUID.class), rs.getString(3)))
                .optional().orElseThrow(ApiException::notFound);
        Listing l = listings.findById(o.listingId()).orElseThrow(ApiException::notFound);
        if (!"PENDING".equals(o.status())) throw ApiException.conflict("OFFER_NOT_PENDING");
        String newStatus;
        switch (action) {
            case "accept", "decline" -> {
                if (!l.getSellerId().equals(me)) throw ApiException.notFound();
                newStatus = "accept".equals(action) ? "ACCEPTED" : "DECLINED";
                notifications.notify(o.buyerId(), "accept".equals(action) ? "OFFER_ACCEPTED" : "OFFER_DECLINED",
                        Map.of("title", l.getTitle()), "/listing/" + l.getId());
            }
            case "withdraw" -> {
                if (!o.buyerId().equals(me)) throw ApiException.notFound();
                newStatus = "WITHDRAWN";
            }
            default -> throw ApiException.badRequest("UNKNOWN_ACTION");
        }
        jdbc.sql("UPDATE offers SET status = ?, decided_at = now() WHERE id = ?").params(newStatus, offerId).update();
    }

    @Transactional(readOnly = true)
    public List<Offer> received(UUID me) {
        return load("SELECT o.id FROM offers o JOIN listings l ON l.id = o.listing_id WHERE l.seller_id = ? ORDER BY o.created_at DESC LIMIT 100", me, true);
    }

    @Transactional(readOnly = true)
    public List<Offer> sent(UUID me) {
        return load("SELECT o.id FROM offers o WHERE o.buyer_id = ? ORDER BY o.created_at DESC LIMIT 100", me, false);
    }

    private List<Offer> load(String idSql, UUID me, boolean received) {
        List<UUID> ids = jdbc.sql(idSql).param(me).query(UUID.class).list();
        List<Offer> out = new ArrayList<>();
        for (UUID id : ids) {
            record Row(UUID listingId, UUID buyerId, String kind, Long amount, UUID swapId, String message, String status, Instant at) {}
            Row r = jdbc.sql("SELECT listing_id, buyer_id, kind, amount_cents, swap_listing_id, message, status, created_at FROM offers WHERE id = ?")
                    .param(id).query((rs, i) -> new Row(rs.getObject(1, UUID.class), rs.getObject(2, UUID.class), rs.getString(3),
                            (Long) rs.getObject(4), rs.getObject(5, UUID.class), rs.getString(6), rs.getString(7),
                            rs.getTimestamp(8).toInstant())).single();
            List<ListingDtos.Card> cards = queries.byIds(r.swapId() == null ? List.of(r.listingId()) : List.of(r.listingId(), r.swapId()), me);
            ListingDtos.Card main = cards.stream().filter(c -> c.id().equals(r.listingId())).findFirst().orElse(null);
            ListingDtos.Card swap = r.swapId() == null ? null : cards.stream().filter(c -> c.id().equals(r.swapId())).findFirst().orElse(null);
            UUID counterpartId = received ? r.buyerId() : listings.findById(r.listingId()).map(Listing::getSellerId).orElse(null);
            UserDtos.PublicUser cp = counterpartId == null ? null : users.findById(counterpartId).map(UserDtos::toPublic).orElse(null);
            out.add(new Offer(id, r.kind(), r.amount(), main == null ? null : main.currency(), r.message(), r.status(), r.at(), main, swap, cp));
        }
        return out;
    }
}
