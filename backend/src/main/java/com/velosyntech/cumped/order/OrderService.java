package com.velosyntech.cumped.order;

import com.velosyntech.cumped.common.ApiException;
import com.velosyntech.cumped.common.AuditService;
import com.velosyntech.cumped.common.Fx;
import com.velosyntech.cumped.common.Texts;
import com.velosyntech.cumped.config.AppProperties;
import com.velosyntech.cumped.listing.Listing;
import com.velosyntech.cumped.listing.ListingDtos;
import com.velosyntech.cumped.listing.ListingQueries;
import com.velosyntech.cumped.listing.ListingRepository;
import com.velosyntech.cumped.notification.NotificationService;
import com.velosyntech.cumped.shipping.ShippingController;
import com.velosyntech.cumped.user.BlockService;
import com.velosyntech.cumped.user.User;
import com.velosyntech.cumped.user.UserDtos;
import com.velosyntech.cumped.user.UserRepository;
import com.velosyntech.cumped.velo.VeloService;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Timestamp;
import java.time.Duration;
import java.time.Instant;
import java.util.*;

/**
 * Plata sigură (Protecția Cumped) — banii stau la noi până când cumpărătorul confirmă că a primit ce a comandat.
 *
 *   PAID ──(vânzătorul trimite / predă)──► SHIPPED ──(cumpărătorul confirmă sau trec zilele de verificare)──► COMPLETED
 *     │                                       │
 *     ├─ vânzătorul anulează / nu trimite ────┼──► REFUNDED (banii înapoi integral)
 *     └───────────── cumpărătorul are o problemă ──► DISPUTED ──(echipa decide)──► REFUNDED / COMPLETED
 *
 * Plata reală (Stripe Connect: încasare, păstrare, plată către vânzător) se conectează în {@link #charge}; până atunci,
 * în DEV_MODE plata e simulată, iar în producție fără procesator răspundem PAYMENTS_NOT_CONFIGURED.
 */
@Service
public class OrderService {
    public static final Duration SHIP_WINDOW = Duration.ofDays(4);
    public static final Duration PICKUP_WINDOW = Duration.ofDays(7);
    public static final Duration REFUND_GRACE = Duration.ofDays(2);
    public static final Duration CHECK_DOMESTIC = Duration.ofDays(5);
    public static final Duration CHECK_ABROAD = Duration.ofDays(12);
    public static final Duration CHECK_PICKUP = Duration.ofDays(2);
    private static final Set<String> CARRIERS = Set.of("FAN_COURIER", "SAMEDAY", "CARGUS", "DPD", "GLS", "POSTA_ROMANA", "DHL", "UPS", "FEDEX", "OTHER");
    private static final Set<String> DISPUTE_REASONS = Set.of("NOT_RECEIVED", "NOT_AS_DESCRIBED", "DAMAGED", "COUNTERFEIT", "OTHER");

    public record Address(String name, String address, String city, String postcode, String country, String phone) {}
    public record Quote(long itemCents, long shippingCents, long feeCents, long totalCents, String currency, boolean offerApplied,
                        boolean courierAvailable, int minDays, int maxDays) {}
    public record View(UUID id, String code, String role, ListingDtos.Card listing, UserDtos.PublicUser counterpart,
                       long itemCents, long shippingCents, long feeCents, long totalCents, String currency, String delivery,
                       Address shipTo, String carrier, String trackingCode, String status, String disputeReason, String refundReason,
                       Instant createdAt, Instant paidAt, Instant shipBy, Instant shippedAt, Instant autoReleaseAt,
                       Instant completedAt, Instant refundedAt, boolean canShip, boolean canConfirm, boolean canDispute,
                       boolean canCancel, UUID conversationId, boolean simulated) {}

    private record Row(UUID id, String code, UUID listingId, UUID buyerId, UUID sellerId, long item, long shipping, long fee, long total,
                       String currency, String delivery, Address addr, String carrier, String tracking, String status, String disputeReason,
                       String refundReason, Instant createdAt, Instant paidAt, Instant shipBy, Instant shippedAt, Instant autoRelease,
                       Instant completedAt, Instant refundedAt) {}

    private final JdbcClient jdbc;
    private final ListingRepository listings;
    private final ListingQueries queries;
    private final UserRepository users;
    private final NotificationService notifications;
    private final BlockService blocks;
    private final VeloService velo;
    private final AuditService audit;
    private final AppProperties props;

    public OrderService(JdbcClient jdbc, ListingRepository listings, ListingQueries queries, UserRepository users,
                        NotificationService notifications, BlockService blocks, VeloService velo, AuditService audit, AppProperties props) {
        this.jdbc = jdbc;
        this.listings = listings;
        this.queries = queries;
        this.users = users;
        this.notifications = notifications;
        this.blocks = blocks;
        this.velo = velo;
        this.audit = audit;
        this.props = props;
    }

    // ---------------- preț ----------------

    /** Comisionul protecției: 2,5% din produs, minim 0,50 €, maxim 20 € (în moneda anunțului), plătit de cumpărător. */
    public static long fee(long itemCents, String currency) {
        long min = Fx.fromEurCents(50, currency), max = Fx.fromEurCents(2000, currency);
        return Math.max(min, Math.min(max, Math.round(itemCents * 0.025)));
    }

    public Quote quote(UUID buyerId, UUID listingId, String delivery, String country) {
        Listing l = listings.findById(listingId).orElseThrow(ApiException::notFound);
        if (l.getStatus() != Listing.Status.ACTIVE) throw ApiException.conflict("LISTING_NOT_AVAILABLE");
        Long offer = acceptedOffer(l.getId(), buyerId);
        long item = offer != null ? offer : l.getPriceCents();
        String dest = country == null || country.isBlank() ? l.getCountry() : country.trim().toUpperCase(Locale.ROOT);
        ShippingController.Estimate est = dest.matches("^[A-Z]{2}$") ? ShippingController.compute(l, dest) : null;
        boolean courier = est != null && est.available();
        long ship = "COURIER".equals(delivery) && courier ? Fx.fromEurCents((est.minCents() + est.maxCents()) / 2, l.getCurrency()) : 0;
        long fee = fee(item, l.getCurrency());
        return new Quote(item, ship, fee, item + ship + fee, l.getCurrency(), offer != null, courier,
                courier ? est.minDays() : 0, courier ? est.maxDays() : 0);
    }

    // ---------------- creare + plată ----------------

    @Transactional
    public View create(UUID buyerId, UUID listingId, String delivery, Address addr) {
        Listing l = listings.findById(listingId).orElseThrow(ApiException::notFound);
        if (l.getSellerId().equals(buyerId)) throw ApiException.badRequest("CANNOT_BUY_OWN");
        if (l.getStatus() != Listing.Status.ACTIVE) throw ApiException.conflict("LISTING_NOT_AVAILABLE");
        blocks.requireNotBlocked(buyerId, l.getSellerId());
        User buyer = users.findById(buyerId).orElseThrow(ApiException::notFound);
        if (buyer.isSuspended()) throw new ApiException(HttpStatus.FORBIDDEN, "ACCOUNT_SUSPENDED");
        if (!Set.of("PICKUP", "COURIER").contains(delivery)) throw ApiException.badRequest("VALIDATION");
        int open = jdbc.sql("SELECT count(*) FROM orders WHERE listing_id = ? AND buyer_id = ? AND status IN ('PAID','SHIPPED','DISPUTED')")
                .params(l.getId(), buyerId).query(Integer.class).single();
        if (open > 0) throw ApiException.conflict("ORDER_EXISTS");

        Address a = null;
        if ("COURIER".equals(delivery)) {
            a = cleanAddress(addr);
            if (!l.shipsTo(a.country())) throw ApiException.badRequest("NOT_SHIPPING_THERE");
        }
        Quote q = quote(buyerId, listingId, delivery, a == null ? null : a.country());
        charge(buyerId, q.totalCents(), q.currency());

        UUID id = UUID.randomUUID();
        String code;
        do { code = "CMD-" + Texts.randomCode(6); }
        while (jdbc.sql("SELECT count(*) FROM orders WHERE code = ?").param(code).query(Integer.class).single() > 0);
        Instant now = Instant.now();
        Instant shipBy = now.plus("COURIER".equals(delivery) ? SHIP_WINDOW : PICKUP_WINDOW);
        UUID offerId = jdbc.sql("SELECT id FROM offers WHERE listing_id = ? AND buyer_id = ? AND status = 'ACCEPTED' AND kind = 'PRICE' ORDER BY created_at DESC LIMIT 1")
                .params(l.getId(), buyerId).query(UUID.class).optional().orElse(null);
        jdbc.sql("""
                INSERT INTO orders(id, code, listing_id, buyer_id, seller_id, offer_id, item_cents, shipping_cents, fee_cents, total_cents, currency,
                  delivery, ship_name, ship_address, ship_city, ship_postcode, ship_country, ship_phone, status, paid_at, ship_by)
                VALUES (:id, :code, :listing, :buyer, :seller, :offer, :item, :ship, :fee, :total, :cur, :delivery,
                  :n, :a, :c, :p, :co, :ph, 'PAID', :now, :shipBy)""")
                .param("id", id).param("code", code).param("listing", l.getId()).param("buyer", buyerId).param("seller", l.getSellerId())
                .param("offer", offerId).param("item", q.itemCents()).param("ship", q.shippingCents()).param("fee", q.feeCents())
                .param("total", q.totalCents()).param("cur", q.currency()).param("delivery", delivery)
                .param("n", a == null ? null : a.name()).param("a", a == null ? null : a.address()).param("c", a == null ? null : a.city())
                .param("p", a == null ? null : a.postcode()).param("co", a == null ? null : a.country()).param("ph", a == null ? null : a.phone())
                .param("now", Timestamp.from(now)).param("shipBy", Timestamp.from(shipBy)).update();

        // Produsul nu mai poate fi cumpărat de altcineva (sau scade stocul).
        if (l.getQuantity() > 1) l.setQuantity(l.getQuantity() - 1);
        else { l.setStatus(Listing.Status.SOLD); l.setSoldToId(buyerId); }
        listings.save(l);

        UUID conv = ensureConversation(l, buyerId);
        event(conv, buyerId, "PAID", q.itemCents(), q.currency());
        notifications.notify(l.getSellerId(), "ORDER_PAID", Map.of("title", l.getTitle(), "amount", q.itemCents(), "currency", q.currency(), "code", code), "/orders/" + id);
        audit.log(buyerId, "ORDER_PAID", code);
        return view(buyerId, id);
    }

    /** Punctul de integrare cu procesatorul de plăți. */
    private void charge(UUID buyerId, long totalCents, String currency) {
        if (!props.devMode()) throw new ApiException(HttpStatus.SERVICE_UNAVAILABLE, "PAYMENTS_NOT_CONFIGURED");
        audit.log(buyerId, "PAYMENT_SIMULATED", totalCents + " " + currency);
    }

    // ---------------- acțiuni ----------------

    @Transactional
    public View ship(UUID me, UUID id, String carrier, String tracking) {
        Row o = load(id);
        if (!o.sellerId().equals(me)) throw ApiException.notFound();
        if (!"PAID".equals(o.status())) throw ApiException.conflict("INVALID_STATE");
        String c = null, t = null;
        Duration check = CHECK_PICKUP;
        if ("COURIER".equals(o.delivery())) {
            c = carrier == null ? "" : carrier.trim().toUpperCase(Locale.ROOT);
            t = tracking == null ? "" : tracking.trim().replaceAll("[^A-Za-z0-9-]", "");
            if (!CARRIERS.contains(c) || t.length() < 5 || t.length() > 40) throw ApiException.badRequest("TRACKING_REQUIRED");
            Listing l = listings.findById(o.listingId()).orElseThrow(ApiException::notFound);
            check = Objects.equals(o.addr().country(), l.getCountry()) ? CHECK_DOMESTIC : CHECK_ABROAD;
        }
        Instant now = Instant.now();
        jdbc.sql("UPDATE orders SET status = 'SHIPPED', carrier = ?, tracking_code = ?, shipped_at = ?, auto_release_at = ?, updated_at = now() WHERE id = ?")
                .params(c, t, Timestamp.from(now), Timestamp.from(now.plus(check)), id).update();
        String title = title(o);
        event(conv(o), me, "COURIER".equals(o.delivery()) ? "SHIPPED" : "HANDED_OVER", o.item(), o.currency());
        notifications.notify(o.buyerId(), "COURIER".equals(o.delivery()) ? "ORDER_SHIPPED" : "ORDER_HANDED_OVER",
                Map.of("title", title, "carrier", c == null ? "" : c, "tracking", t == null ? "" : t, "days", check.toDays()), "/orders/" + id);
        return view(me, id);
    }

    @Transactional
    public View confirm(UUID me, UUID id) {
        Row o = load(id);
        if (!o.buyerId().equals(me)) throw ApiException.notFound();
        if (!Set.of("PAID", "SHIPPED").contains(o.status())) throw ApiException.conflict("INVALID_STATE");
        complete(o, me, "ORDER_COMPLETED");
        return view(me, id);
    }

    @Transactional
    public View dispute(UUID me, UUID id, String reason, String details) {
        Row o = load(id);
        if (!o.buyerId().equals(me)) throw ApiException.notFound();
        if (!Set.of("PAID", "SHIPPED").contains(o.status())) throw ApiException.conflict("INVALID_STATE");
        if (!DISPUTE_REASONS.contains(reason)) throw ApiException.badRequest("VALIDATION");
        String text = details == null ? "" : details.trim();
        if (text.length() < 10 || text.length() > 2000) throw ApiException.badRequest("DETAILS_REQUIRED");
        jdbc.sql("UPDATE orders SET status = 'DISPUTED', dispute_reason = ?, auto_release_at = NULL, updated_at = now() WHERE id = ?")
                .params(reason, id).update();
        // Tichet la echipă (Velo + contact@…): banii rămân blocați până la decizie.
        velo.openReport(me, "ORDER", id, reason, "Comanda " + o.code() + " (" + o.total() / 100.0 + " " + o.currency() + "): " + text);
        event(conv(o), me, "DISPUTED", o.item(), o.currency());
        notifications.notify(o.sellerId(), "ORDER_DISPUTED", Map.of("title", title(o), "code", o.code()), "/orders/" + id);
        audit.log(me, "ORDER_DISPUTED", o.code());
        return view(me, id);
    }

    /** Vânzătorul anulează înainte de expediere; cumpărătorul poate anula dacă vânzătorul n-a trimis la timp. */
    @Transactional
    public View cancel(UUID me, UUID id) {
        Row o = load(id);
        boolean seller = o.sellerId().equals(me), buyer = o.buyerId().equals(me);
        if (!seller && !buyer) throw ApiException.notFound();
        if (!"PAID".equals(o.status())) throw ApiException.conflict("INVALID_STATE");
        if (buyer && o.shipBy().isAfter(Instant.now())) throw ApiException.conflict("TOO_EARLY_TO_CANCEL");
        refund(o, me, seller ? "SELLER_CANCELLED" : "NOT_SHIPPED_IN_TIME");
        return view(me, id);
    }

    /** Decizia echipei într-o dispută. */
    @Transactional
    public void resolve(UUID admin, UUID id, String outcome) {
        Row o = load(id);
        if (!"DISPUTED".equals(o.status())) throw ApiException.conflict("INVALID_STATE");
        if ("REFUND".equals(outcome)) refund(o, admin, "DISPUTE_REFUND");
        else if ("RELEASE".equals(outcome)) complete(o, admin, "ORDER_RELEASED");
        else throw ApiException.badRequest("VALIDATION");
        audit.log(admin, "ORDER_RESOLVED", o.code() + " " + outcome);
    }

    /** Eliberări și rambursări automate. */
    @Scheduled(fixedDelay = 600_000, initialDelay = 60_000)
    @Transactional
    public void housekeeping() {
        for (Row o : rows("WHERE status = 'SHIPPED' AND auto_release_at < now()")) complete(o, null, "ORDER_AUTO_COMPLETED");
        for (Row o : rows("WHERE status = 'PAID' AND ship_by < ?", Timestamp.from(Instant.now().minus(REFUND_GRACE)))) refund(o, null, "NOT_SHIPPED_IN_TIME");
    }

    private void complete(Row o, UUID actor, String type) {
        jdbc.sql("UPDATE orders SET status = 'COMPLETED', completed_at = now(), auto_release_at = NULL, updated_at = now() WHERE id = ?").param(o.id()).update();
        event(conv(o), actor == null ? o.buyerId() : actor, "COMPLETED", o.item(), o.currency());
        Map<String, Object> p = Map.of("title", title(o), "amount", o.item(), "currency", o.currency(), "code", o.code());
        notifications.notify(o.sellerId(), "ORDER_COMPLETED", p, "/orders/" + o.id());
        if (!o.buyerId().equals(actor)) notifications.notify(o.buyerId(), type, p, "/orders/" + o.id());
        audit.log(actor, "ORDER_COMPLETED", o.code());
    }

    private void refund(Row o, UUID actor, String reason) {
        jdbc.sql("UPDATE orders SET status = 'REFUNDED', refund_reason = ?, refunded_at = now(), auto_release_at = NULL, updated_at = now() WHERE id = ?")
                .params(reason, o.id()).update();
        // Produsul redevine disponibil.
        listings.findById(o.listingId()).ifPresent(l -> {
            if (l.getStatus() == Listing.Status.SOLD && o.buyerId().equals(l.getSoldToId())) { l.setStatus(Listing.Status.ACTIVE); l.setSoldToId(null); }
            else if (l.getStatus() == Listing.Status.ACTIVE) l.setQuantity(l.getQuantity() + 1);
            listings.save(l);
        });
        event(conv(o), actor == null ? o.sellerId() : actor, "REFUNDED", o.total(), o.currency());
        Map<String, Object> p = Map.of("title", title(o), "amount", o.total(), "currency", o.currency(), "reason", reason);
        notifications.notify(o.buyerId(), "ORDER_REFUNDED", p, "/orders/" + o.id());
        notifications.notify(o.sellerId(), "ORDER_REFUNDED", p, "/orders/" + o.id());
        audit.log(actor, "ORDER_REFUNDED", o.code() + " " + reason);
    }

    // ---------------- citire ----------------

    public List<View> mine(UUID me) {
        List<View> out = new ArrayList<>();
        for (Row o : rows("WHERE buyer_id = ? OR seller_id = ? ORDER BY created_at DESC LIMIT 100", me, me)) out.add(toView(me, o));
        return out;
    }

    public View view(UUID me, UUID id) {
        Row o = load(id);
        if (!o.buyerId().equals(me) && !o.sellerId().equals(me)) throw ApiException.notFound();
        return toView(me, o);
    }

    /** Pentru panoul de administrare: disputele deschise. */
    public List<View> disputed(UUID admin) {
        return rows("WHERE status = 'DISPUTED' ORDER BY updated_at").stream().map(o -> toView(o.buyerId(), o)).toList();
    }

    /** Pentru recenzii: o comandă finalizată e o tranzacție confirmată. */
    public boolean completedBetween(UUID listingId, UUID buyerId) {
        return jdbc.sql("SELECT count(*) FROM orders WHERE listing_id = ? AND buyer_id = ? AND status = 'COMPLETED'")
                .params(listingId, buyerId).query(Integer.class).single() > 0;
    }

    private View toView(UUID me, Row o) {
        boolean seller = o.sellerId().equals(me);
        UUID other = seller ? o.buyerId() : o.sellerId();
        ListingDtos.Card card = queries.byIds(List.of(o.listingId()), me).stream().findFirst().orElse(null);
        UserDtos.PublicUser cp = users.findById(other).map(UserDtos::toPublic).orElse(null);
        boolean late = "PAID".equals(o.status()) && o.shipBy() != null && o.shipBy().isBefore(Instant.now());
        UUID conv = jdbc.sql("SELECT id FROM conversations WHERE listing_id = ? AND buyer_id = ?").params(o.listingId(), o.buyerId())
                .query(UUID.class).optional().orElse(null);
        return new View(o.id(), o.code(), seller ? "SELLER" : "BUYER", card, cp, o.item(), o.shipping(), o.fee(), o.total(), o.currency(),
                o.delivery(), "COURIER".equals(o.delivery()) ? o.addr() : null, o.carrier(), o.tracking(), o.status(), o.disputeReason(),
                o.refundReason(), o.createdAt(), o.paidAt(), o.shipBy(), o.shippedAt(), o.autoRelease(), o.completedAt(), o.refundedAt(),
                seller && "PAID".equals(o.status()),
                !seller && Set.of("PAID", "SHIPPED").contains(o.status()),
                !seller && Set.of("PAID", "SHIPPED").contains(o.status()),
                "PAID".equals(o.status()) && (seller || late), conv, props.devMode());
    }

    private Row load(UUID id) {
        return rows("WHERE id = ?", id).stream().findFirst().orElseThrow(ApiException::notFound);
    }

    /** Clauza WHERE e mereu o constantă din această clasă; valorile vin doar ca parametri. */
    private List<Row> rows(String where, Object... params) {
        return jdbc.sql("""
                SELECT id, code, listing_id, buyer_id, seller_id, item_cents, shipping_cents, fee_cents, total_cents, currency, delivery,
                  ship_name, ship_address, ship_city, ship_postcode, ship_country, ship_phone, carrier, tracking_code, status, dispute_reason,
                  refund_reason, created_at, paid_at, ship_by, shipped_at, auto_release_at, completed_at, refunded_at FROM orders
                """ + " " + where)
                .params(params).query(this::row).list();
    }

    private Row row(ResultSet rs, int i) throws SQLException {
        return new Row(rs.getObject(1, UUID.class), rs.getString(2), rs.getObject(3, UUID.class), rs.getObject(4, UUID.class),
                rs.getObject(5, UUID.class), rs.getLong(6), rs.getLong(7), rs.getLong(8), rs.getLong(9), rs.getString(10), rs.getString(11),
                new Address(rs.getString(12), rs.getString(13), rs.getString(14), rs.getString(15), rs.getString(16), rs.getString(17)),
                rs.getString(18), rs.getString(19), rs.getString(20), rs.getString(21), rs.getString(22),
                ts(rs, 23), ts(rs, 24), ts(rs, 25), ts(rs, 26), ts(rs, 27), ts(rs, 28), ts(rs, 29));
    }

    private static Instant ts(ResultSet rs, int i) throws SQLException { Timestamp t = rs.getTimestamp(i); return t == null ? null : t.toInstant(); }

    private Long acceptedOffer(UUID listingId, UUID buyerId) {
        return jdbc.sql("SELECT amount_cents FROM offers WHERE listing_id = ? AND buyer_id = ? AND status = 'ACCEPTED' AND kind = 'PRICE' AND amount_cents IS NOT NULL ORDER BY created_at DESC LIMIT 1")
                .params(listingId, buyerId).query(Long.class).optional().orElse(null);
    }

    private Address cleanAddress(Address a) {
        if (a == null) throw ApiException.badRequest("ADDRESS_REQUIRED");
        String name = Texts.clean(nz(a.name())), addr = Texts.clean(nz(a.address())), city = Texts.clean(nz(a.city()));
        String post = nz(a.postcode()).replaceAll("[^A-Za-z0-9 -]", ""), country = nz(a.country()).toUpperCase(Locale.ROOT);
        String phone = nz(a.phone()).replaceAll("[^0-9+ ()-]", "");
        if (name.length() < 3 || name.length() > 120 || addr.length() < 5 || addr.length() > 300 || city.length() < 2 || city.length() > 80
                || post.length() > 20 || !country.matches("^[A-Z]{2}$") || phone.replaceAll("\\D", "").length() < 6 || phone.length() > 30)
            throw ApiException.badRequest("ADDRESS_REQUIRED");
        return new Address(name, addr, city, post, country, phone);
    }

    private static String nz(String s) { return s == null ? "" : s.trim(); }

    private String title(Row o) { return listings.findById(o.listingId()).map(Listing::getTitle).orElse(""); }

    private UUID conv(Row o) { return ensureConversation(listings.findById(o.listingId()).orElseThrow(), o.buyerId()); }

    private UUID ensureConversation(Listing l, UUID buyerId) {
        return jdbc.sql("SELECT id FROM conversations WHERE listing_id = ? AND buyer_id = ?").params(l.getId(), buyerId)
                .query(UUID.class).optional().orElseGet(() -> {
                    UUID id = UUID.randomUUID();
                    jdbc.sql("INSERT INTO conversations(id, listing_id, buyer_id, seller_id) VALUES (?, ?, ?, ?)")
                            .params(id, l.getId(), buyerId, l.getSellerId()).update();
                    return id;
                });
    }

    /** Mesaj de sistem în chat, afișat de aplicație ca bulă de comandă. */
    private void event(UUID conv, UUID sender, String event, long amount, String currency) {
        Instant now = Instant.now();
        jdbc.sql("INSERT INTO messages(id, conversation_id, sender_id, body, created_at) VALUES (?, ?, ?, ?, ?)")
                .params(UUID.randomUUID(), conv, sender, "[[order:" + event + ":" + amount + ":" + currency + "]]", Timestamp.from(now)).update();
        jdbc.sql("UPDATE conversations SET last_message_at = ? WHERE id = ?").params(Timestamp.from(now), conv).update();
    }
}
