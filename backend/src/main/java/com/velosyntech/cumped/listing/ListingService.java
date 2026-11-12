package com.velosyntech.cumped.listing;

import com.velosyntech.cumped.common.ApiException;
import com.velosyntech.cumped.common.Texts;
import com.velosyntech.cumped.media.ListingImage;
import com.velosyntech.cumped.media.ListingImageRepository;
import com.velosyntech.cumped.notification.NotificationService;
import com.velosyntech.cumped.user.QuotaService;
import com.velosyntech.cumped.user.User;
import com.velosyntech.cumped.user.UserDtos;
import com.velosyntech.cumped.user.UserRepository;
import com.velosyntech.cumped.velo.ScamDetector;
import com.velosyntech.cumped.moderation.ContentPolicy;
import com.velosyntech.cumped.user.BlockService;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.core.type.TypeReference;
import tools.jackson.databind.json.JsonMapper;

import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;

@Service
public class ListingService {
    private static final Set<String> CURRENCIES = Set.of("RON", "EUR", "USD", "GBP", "PLN", "HUF", "BGN", "CZK",
            "CHF", "SEK", "NOK", "DKK", "TRY", "UAH", "MDL", "RSD", "CAD", "AUD");

    private final ListingRepository listings;
    private final ListingImageRepository images;
    private final UserRepository users;
    private final QuotaService quota;
    private final NotificationService notifications;
    private final ScamDetector scam;
    private final JdbcClient jdbc;
    private final JsonMapper json;
    private final ContentPolicy policy;
    private final BlockService blocks;
    private final com.velosyntech.cumped.user.SellerStatsService sellerStats;
    /** Deduplicare vizualizări: aceeași persoană nu crește contorul de mai multe ori pe oră. */
    private final Map<String, Long> recentViews = new ConcurrentHashMap<>();

    public ListingService(ListingRepository listings, ListingImageRepository images, UserRepository users,
                          QuotaService quota, NotificationService notifications, ScamDetector scam,
                          JdbcClient jdbc, JsonMapper json, ContentPolicy policy, BlockService blocks,
                          com.velosyntech.cumped.user.SellerStatsService sellerStats) {
        this.sellerStats = sellerStats;
        this.listings = listings;
        this.images = images;
        this.users = users;
        this.quota = quota;
        this.notifications = notifications;
        this.scam = scam;
        this.jdbc = jdbc;
        this.json = json;
        this.policy = policy;
        this.blocks = blocks;
    }

    @Transactional
    public Listing create(UUID sellerId, ListingDtos.Upsert r) {
        User seller = activeUser(sellerId);
        if (!quota.canPublish(seller)) throw new ApiException(HttpStatus.PAYMENT_REQUIRED, "QUOTA_EXCEEDED");
        Listing l = new Listing();
        l.setSellerId(sellerId);
        apply(l, r);
        listings.saveAndFlush(l);
        attachImages(l, sellerId, r.imageIds());
        recordPrice(l);
        notifySavedSearches(l);
        return l;
    }

    @Transactional
    public Listing update(UUID userId, UUID id, ListingDtos.Upsert r) {
        Listing l = owned(userId, id);
        if (l.getStatus() == Listing.Status.HIDDEN_BY_AI || l.getStatus() == Listing.Status.REMOVED)
            throw ApiException.forbidden();
        long oldPrice = l.getPriceCents();
        apply(l, r);
        l.touch();
        listings.save(l);
        if (r.imageIds() != null) attachImages(l, userId, r.imageIds());
        if (l.getPriceCents() != oldPrice) {
            recordPrice(l);
            if (l.getPriceCents() < oldPrice && l.getStatus() == Listing.Status.ACTIVE) notifyPriceDrop(l, oldPrice);
        }
        return l;
    }

    @Transactional
    public Listing changeStatus(UUID userId, UUID id, String action, UUID buyerId) {
        Listing l = owned(userId, id);
        switch (action) {
            case "pause" -> {
                if (l.getStatus() != Listing.Status.ACTIVE) throw ApiException.conflict("INVALID_STATE");
                l.setStatus(Listing.Status.PAUSED);
            }
            case "activate" -> {
                if (l.getStatus() == Listing.Status.PAUSED) {
                    l.setStatus(Listing.Status.ACTIVE);
                } else if (l.getStatus() == Listing.Status.EXPIRED) {
                    if (!quota.canPublish(activeUser(userId))) throw new ApiException(HttpStatus.PAYMENT_REQUIRED, "QUOTA_EXCEEDED");
                    l.setStatus(Listing.Status.ACTIVE);
                    l.setExpiresAt(Instant.now().plus(Listing.LIFETIME));
                } else throw ApiException.conflict("INVALID_STATE");
            }
            case "sold" -> {
                if (l.getStatus() != Listing.Status.ACTIVE && l.getStatus() != Listing.Status.PAUSED)
                    throw ApiException.conflict("INVALID_STATE");
                if (buyerId != null) {
                    boolean talked = jdbc.sql("SELECT count(*) FROM conversations WHERE listing_id = ? AND buyer_id = ?")
                            .params(id, buyerId).query(Integer.class).single() > 0;
                    if (!talked) throw ApiException.badRequest("BUYER_NOT_IN_CONVERSATIONS");
                    l.setSoldToId(buyerId);
                    notifications.notify(buyerId, "PURCHASE_CONFIRMED", Map.of("title", l.getTitle()), "/listing/" + id);
                }
                l.setStatus(Listing.Status.SOLD);
            }
            case "delete" -> l.setStatus(Listing.Status.DELETED);
            default -> throw ApiException.badRequest("UNKNOWN_ACTION");
        }
        l.touch();
        return listings.save(l);
    }

    @Transactional
    public ListingDtos.Detail detail(UUID id, UUID viewerId, String viewerKey) {
        Listing l = listings.findById(id).orElseThrow(ApiException::notFound);
        boolean owner = viewerId != null && viewerId.equals(l.getSellerId());
        boolean admin = viewerId != null && users.findById(viewerId).map(u -> u.getRole() == User.Role.ADMIN).orElse(false);
        User seller = users.findById(l.getSellerId()).orElseThrow(ApiException::notFound);
        if (!owner && !admin && (!l.isPubliclyVisible() || seller.isSuspended())) throw ApiException.notFound();

        if (!owner && countView(id, viewerKey)) {
            listings.incrementViews(id);
            jdbc.sql("INSERT INTO listing_views_daily(listing_id, day, views) VALUES (?, ?, 1) " +
                     "ON CONFLICT (listing_id, day) DO UPDATE SET views = listing_views_daily.views + 1")
                    .params(id, LocalDate.now(ZoneOffset.UTC)).update();
        }

        List<ListingDtos.Image> imgs = images.findByListingIdOrderByPositionAsc(id).stream()
                .map(i -> new ListingDtos.Image(i.getId(), i.url(), i.thumbUrl())).toList();
        List<ListingDtos.PricePoint> history = jdbc.sql("SELECT price_cents, changed_at FROM price_history WHERE listing_id = ? ORDER BY changed_at")
                .param(id).query((rs, i) -> new ListingDtos.PricePoint(rs.getLong(1), rs.getTimestamp(2).toInstant())).list();
        Long previous = history.stream()
                .filter(p -> p.at().isAfter(Instant.now().minusSeconds(30L * 86400)))
                .map(ListingDtos.PricePoint::priceCents).max(Long::compare)
                .filter(max -> max > l.getPriceCents()).orElse(null);
        boolean fav = viewerId != null && jdbc.sql("SELECT count(*) FROM favorites WHERE user_id = ? AND listing_id = ?")
                .params(viewerId, id).query(Integer.class).single() > 0;
        Long alert = viewerId == null || owner ? null : jdbc.sql("SELECT target_price_cents FROM favorites WHERE user_id = ? AND listing_id = ?")
                .params(viewerId, id).query(Long.class).optional().orElse(null);
        UUID conversationId = viewerId == null || owner ? null :
                jdbc.sql("SELECT id FROM conversations WHERE listing_id = ? AND buyer_id = ?")
                        .params(id, viewerId).query(UUID.class).optional().orElse(null);
        ListingDtos.OwnerStats stats = owner ? new ListingDtos.OwnerStats(l.getViewCount(), l.getFavCount(), l.getMsgCount(),
                jdbc.sql("SELECT count(*) FROM offers WHERE listing_id = ?").param(id).query(Long.class).single(),
                l.getExpiresAt()) : null;

        return new ListingDtos.Detail(l.getId(), l.getTitle(), l.getDescription(), l.getCategory().name(),
                l.getCondition().name(), l.getPriceCents(), l.getCurrency(), previous, l.getCountry(), l.getCity(),
                shipsToList(l), l.getWeightGrams(), l.isAcceptsOffers(), l.isAcceptsSwap(), readAttributes(l), imgs,
                l.getStatus().name(), l.isPromoted(), l.getCreatedAt(), UserDtos.toPublic(seller), fav, owner,
                conversationId, history, stats, l.getFavCount(), l.getViewCount(), l.isNegotiable(), l.getQuantity(),
                owner ? l.getMinPriceCents() : null, owner || admin ? l.getModerationReason() : null,
                viewerId != null && !owner && blocks.eitherBlocked(viewerId, l.getSellerId()), alert, sellerStats.of(l.getSellerId()));
    }

    /** Alertă la preț țintă: anunțul intră la favorite și primești notificare când prețul ajunge la (sau sub) țintă. */
    @Transactional
    public Long setPriceAlert(UUID userId, UUID listingId, Long targetCents) {
        Listing l = listings.findById(listingId).orElseThrow(ApiException::notFound);
        if (!l.isPubliclyVisible() || l.getSellerId().equals(userId)) throw ApiException.notFound();
        if (targetCents != null && (targetCents <= 0 || targetCents >= l.getPriceCents())) throw ApiException.badRequest("INVALID_AMOUNT");
        if (targetCents != null) toggleFavorite(userId, listingId, true);
        jdbc.sql("UPDATE favorites SET target_price_cents = ? WHERE user_id = ? AND listing_id = ?").params(targetCents, userId, listingId).update();
        return targetCents;
    }

    @Transactional
    public boolean toggleFavorite(UUID userId, UUID listingId, boolean add) {
        Listing l = listings.findById(listingId).orElseThrow(ApiException::notFound);
        if (!l.isPubliclyVisible()) throw ApiException.notFound();
        if (add) {
            int n = jdbc.sql("INSERT INTO favorites(user_id, listing_id) VALUES (?, ?) ON CONFLICT DO NOTHING")
                    .params(userId, listingId).update();
            if (n > 0) listings.addFavorites(listingId, 1);
        } else {
            int n = jdbc.sql("DELETE FROM favorites WHERE user_id = ? AND listing_id = ?").params(userId, listingId).update();
            if (n > 0) listings.addFavorites(listingId, -1);
        }
        return add;
    }

    @Scheduled(cron = "0 */15 * * * *")
    @Transactional
    public void expire() { listings.expireOld(Instant.now()); }

    // --- helpers ---

    private void apply(Listing l, ListingDtos.Upsert r) {
        String title = Texts.clean(r.title());
        String description = Texts.clean(r.description());
        if (title.length() < 5 || description.length() < 20) throw ApiException.badRequest("VALIDATION");
        if (scam.containsLink(title) || scam.containsLink(description)) throw ApiException.badRequest("LINKS_NOT_ALLOWED");
        ScamDetector.Result check = scam.analyze(title + "\n" + description);
        if (check.blocked()) throw ApiException.badRequest("SUSPICIOUS_CONTENT");
        String attrText = r.attributes() == null ? "" : String.join(" ", r.attributes().values());
        switch (policy.check(title + "\n" + description + "\n" + attrText)) {
            case PROHIBITED_ITEM -> throw ApiException.badRequest("PROHIBITED_ITEM");
            case OFFENSIVE_CONTENT -> throw ApiException.badRequest("OFFENSIVE_CONTENT");
            default -> { }
        }
        if (r.minPriceCents() != null && r.minPriceCents() > r.priceCents()) throw ApiException.badRequest("MIN_PRICE_TOO_HIGH");
        if (!CURRENCIES.contains(r.currency())) throw ApiException.badRequest("UNSUPPORTED_CURRENCY");
        l.setTitle(title);
        l.setDescription(description);
        l.setCategory(r.category());
        l.setCondition(r.condition());
        l.setPriceCents(r.priceCents());
        l.setCurrency(r.currency());
        l.setCountry(r.country());
        l.setCity(Texts.clean(r.city()));
        l.setShipsTo(r.shipsTo() == null ? "" : (r.shipsTo().contains("*") ? "*" : String.join(",", new LinkedHashSet<>(r.shipsTo()))));
        l.setWeightGrams(r.weightGrams() == null ? 1000 : r.weightGrams());
        l.setAcceptsOffers(r.acceptsOffers());
        l.setAcceptsSwap(r.acceptsSwap());
        l.setNegotiable(r.negotiable() == null || r.negotiable());
        l.setMinPriceCents(l.isNegotiable() ? r.minPriceCents() : null);
        l.setQuantity(r.quantity() == null ? 1 : r.quantity());
        Map<String, String> attrs = new LinkedHashMap<>();
        if (r.attributes() != null) r.attributes().forEach((k, v) -> {
            String ck = Texts.clean(k), cv = Texts.clean(v);
            if (ck != null && !ck.isEmpty() && cv != null && !cv.isEmpty() && !scam.containsLink(cv)) attrs.put(ck, cv);
        });
        l.setAttributes(attrs.isEmpty() ? "" : json.writeValueAsString(attrs));
    }

    private void attachImages(Listing l, UUID ownerId, List<UUID> imageIds) {
        if (imageIds == null) return;
        List<ListingImage> current = images.findByListingIdOrderByPositionAsc(l.getId());
        Set<UUID> wanted = new LinkedHashSet<>(imageIds);
        for (ListingImage img : current) {
            if (!wanted.contains(img.getId())) { img.setListingId(null); images.save(img); }
        }
        int pos = 0;
        for (UUID imgId : wanted) {
            ListingImage img = images.findById(imgId).orElseThrow(() -> ApiException.badRequest("INVALID_IMAGE"));
            if (!img.getOwnerId().equals(ownerId)) throw ApiException.forbidden();
            if (img.isEvidence()) throw ApiException.badRequest("INVALID_IMAGE");
            if (img.getListingId() != null && !img.getListingId().equals(l.getId())) throw ApiException.badRequest("INVALID_IMAGE");
            img.setListingId(l.getId());
            img.setPosition(pos++);
            images.save(img);
        }
    }

    private void recordPrice(Listing l) {
        jdbc.sql("INSERT INTO price_history(id, listing_id, price_cents) VALUES (?, ?, ?)")
                .params(UUID.randomUUID(), l.getId(), l.getPriceCents()).update();
    }

    private void notifyPriceDrop(Listing l, long oldPrice) {
        record Fan(UUID userId, Long target) {}
        List<Fan> fans = jdbc.sql("SELECT user_id, target_price_cents FROM favorites WHERE listing_id = ?").param(l.getId())
                .query((rs, i) -> new Fan(rs.getObject(1, UUID.class), (Long) rs.getObject(2))).list();
        for (Fan fan : fans) {
            boolean reached = fan.target() != null && l.getPriceCents() <= fan.target() && oldPrice > fan.target();
            notifications.notify(fan.userId(), reached ? "PRICE_TARGET_REACHED" : "PRICE_DROP", Map.of("title", l.getTitle(), "old", oldPrice,
                    "new", l.getPriceCents(), "currency", l.getCurrency()), "/listing/" + l.getId());
            if (reached) jdbc.sql("UPDATE favorites SET target_price_cents = NULL WHERE user_id = ? AND listing_id = ?").params(fan.userId(), l.getId()).update();
        }
    }

    private void notifySavedSearches(Listing l) {
        record Saved(UUID userId, String query) {}
        List<Saved> matches = jdbc.sql("""
                SELECT s.user_id, s.query FROM saved_searches s
                WHERE s.user_id <> ? AND (s.category IS NULL OR s.category = ?)
                  AND (s.max_price_cents IS NULL OR s.max_price_cents >= ?)
                  AND (s.country IS NULL OR s.country = ?)
                LIMIT 500""")
                .params(l.getSellerId(), l.getCategory().name(), l.getPriceCents(), l.getCountry())
                .query((rs, i) -> new Saved(rs.getObject(1, UUID.class), rs.getString(2))).list();
        String haystack = (l.getTitle() + " " + l.getDescription()).toLowerCase(Locale.ROOT);
        Set<UUID> notified = new HashSet<>();
        for (Saved s : matches) {
            if (notified.contains(s.userId())) continue;
            if (s.query() == null || Arrays.stream(s.query().toLowerCase(Locale.ROOT).split("\\s+"))
                    .filter(t -> t.length() > 1).allMatch(haystack::contains)) {
                notifications.notify(s.userId(), "SAVED_SEARCH_MATCH", Map.of("title", l.getTitle(),
                        "query", s.query() == null ? "" : s.query()), "/listing/" + l.getId());
                notified.add(s.userId());
            }
        }
    }

    private boolean countView(UUID id, String viewerKey) {
        long now = System.currentTimeMillis();
        String k = id + "|" + viewerKey;
        Long last = recentViews.get(k);
        if (last != null && now - last < 3_600_000) return false;
        if (recentViews.size() > 200_000) recentViews.clear();
        recentViews.put(k, now);
        return true;
    }

    public Listing owned(UUID userId, UUID id) {
        Listing l = listings.findById(id).orElseThrow(ApiException::notFound);
        if (!l.getSellerId().equals(userId) || l.getStatus() == Listing.Status.DELETED) throw ApiException.notFound();
        return l;
    }

    private User activeUser(UUID id) {
        User u = users.findById(id).orElseThrow(ApiException::notFound);
        if (u.isSuspended()) throw new ApiException(HttpStatus.FORBIDDEN, "ACCOUNT_SUSPENDED");
        return u;
    }

    public Map<String, String> readAttributes(Listing l) {
        if (l.getAttributes() == null || l.getAttributes().isEmpty()) return Map.of();
        return json.readValue(l.getAttributes(), new TypeReference<LinkedHashMap<String, String>>() {});
    }

    private static List<String> shipsToList(Listing l) {
        if (l.getShipsTo() == null || l.getShipsTo().isEmpty()) return List.of();
        return Arrays.asList(l.getShipsTo().split(","));
    }
}
