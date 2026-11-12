package com.velosyntech.cumped.order;

import com.velosyntech.cumped.common.ApiException;
import com.velosyntech.cumped.common.AuditService;
import com.velosyntech.cumped.common.Fx;
import com.velosyntech.cumped.common.FieldCrypto;
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
    public record Evidence(String serialNumber, Integer parcelWeightGrams, List<String> shipProof, String disputeDetails,
                           List<String> disputeEvidence, String disputeSerial, boolean serialMismatch, String sellerResponse,
                           List<String> sellerEvidence, Instant disputedAt, Instant respondBy, Instant returnBy, String returnCarrier,
                           String returnTracking, Instant returnShippedAt, String resolution) {}
    public record View(UUID id, String code, String role, ListingDtos.Card listing, UserDtos.PublicUser counterpart,
                       long itemCents, long shippingCents, long feeCents, long totalCents, String currency, String delivery,
                       Address shipTo, String carrier, String trackingCode, String status, String disputeReason, String refundReason,
                       Instant createdAt, Instant paidAt, Instant shipBy, Instant shippedAt, Instant autoReleaseAt,
                       Instant completedAt, Instant refundedAt, boolean canShip, boolean canConfirm, boolean canDispute,
                       boolean canCancel, UUID conversationId, boolean simulated, Evidence evidence, boolean proofRequired,
                       boolean canRespond, boolean canReturnShip, boolean canReturnConfirm) {}
    /** Pentru echipă: disputa plus istoricul cumpărătorului (nu se arată părților). */
    public record AdminDispute(View order, int buyerDisputes90d, int buyerLost12m, int sellerLost12m) {}

    private record Row(UUID id, String code, UUID listingId, UUID buyerId, UUID sellerId, long item, long shipping, long fee, long total,
                       String currency, String delivery, Address addr, String carrier, String tracking, String status, String disputeReason,
                       String refundReason, Instant createdAt, Instant paidAt, Instant shipBy, Instant shippedAt, Instant autoRelease,
                       Instant completedAt, Instant refundedAt, String serial, Integer weight, String disputeDetails, String disputeSerial,
                       Instant disputedAt, String sellerResponse, Instant respondedAt, Instant returnBy, String returnCarrier,
                       String returnTracking, Instant returnShippedAt, String resolution, String resolvedAgainst) {}

    /** Peste această valoare (echivalent 300 €), vânzătorul trebuie să fotografieze coletul la expediere. */
    public static final long PROOF_REQUIRED_EUR_CENTS = 30_000;
    public static final Duration RESPOND_WINDOW = Duration.ofHours(72);
    public static final Duration RETURN_WINDOW = Duration.ofDays(7);
    public static final Duration RETURN_CONFIRM_WINDOW = Duration.ofDays(14);
    public static final Duration ADDRESS_RETENTION = Duration.ofDays(90);
    private static final Set<String> NEEDS_PHOTOS = Set.of("NOT_AS_DESCRIBED", "DAMAGED", "COUNTERFEIT", "OTHER");

    private final JdbcClient jdbc;
    private final ListingRepository listings;
    private final ListingQueries queries;
    private final UserRepository users;
    private final NotificationService notifications;
    private final BlockService blocks;
    private final VeloService velo;
    private final AuditService audit;
    private final AppProperties props;
    private final com.velosyntech.cumped.media.MediaSigner signer;

    public OrderService(JdbcClient jdbc, ListingRepository listings, ListingQueries queries, UserRepository users,
                        NotificationService notifications, BlockService blocks, VeloService velo, AuditService audit, AppProperties props,
                        com.velosyntech.cumped.media.MediaSigner signer) {
        this.signer = signer;
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
        int open = jdbc.sql("SELECT count(*) FROM orders WHERE listing_id = ? AND buyer_id = ? AND status IN ('PAID','SHIPPED','DISPUTED','RETURN_REQUESTED')")
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
                // adresa și telefonul se păstrează criptate (AES-256-GCM)
                .param("n", a == null ? null : FieldCrypto.encrypt(a.name())).param("a", a == null ? null : FieldCrypto.encrypt(a.address()))
                .param("c", a == null ? null : FieldCrypto.encrypt(a.city())).param("p", a == null ? null : FieldCrypto.encrypt(a.postcode()))
                .param("co", a == null ? null : a.country()).param("ph", a == null ? null : FieldCrypto.encrypt(a.phone()))
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

    /**
     * Expediere / predare. Vânzătorul poate (iar peste 300 € trebuie) să atașeze poze cu produsul împachetat și eticheta,
     * seria / IMEI-ul și greutatea coletului: dovezi care îl protejează dacă cumpărătorul spune că a primit altceva.
     */
    @Transactional
    public View ship(UUID me, UUID id, String carrier, String tracking, String serialNumber, Integer weightGrams, List<UUID> proofImageIds) {
        Row o = load(id);
        if (!o.sellerId().equals(me)) throw ApiException.notFound();
        if (!"PAID".equals(o.status())) throw ApiException.conflict("INVALID_STATE");
        String c = null, t = null;
        Duration check = CHECK_PICKUP;
        List<UUID> proofs = proofImageIds == null ? List.of() : proofImageIds;
        if (proofs.size() > 6) throw ApiException.badRequest("VALIDATION");
        if ("COURIER".equals(o.delivery())) {
            c = carrier == null ? "" : carrier.trim().toUpperCase(Locale.ROOT);
            t = tracking == null ? "" : tracking.trim().replaceAll("[^A-Za-z0-9-]", "");
            if (!CARRIERS.contains(c) || t.length() < 5 || t.length() > 40) throw ApiException.badRequest("TRACKING_REQUIRED");
            if (proofRequired(o) && proofs.size() < 2) throw ApiException.badRequest("SHIP_PROOF_REQUIRED");
            Listing l = listings.findById(o.listingId()).orElseThrow(ApiException::notFound);
            check = Objects.equals(o.addr().country(), l.getCountry()) ? CHECK_DOMESTIC : CHECK_ABROAD;
        }
        String serial = cleanSerial(serialNumber);
        Integer weight = weightGrams == null ? null : Math.max(1, Math.min(weightGrams, 100_000));
        attachEvidence(me, id, proofs, "SHIP_PROOF");
        Instant now = Instant.now();
        jdbc.sql("""
                UPDATE orders SET status = 'SHIPPED', carrier = ?, tracking_code = ?, shipped_at = ?, auto_release_at = ?,
                  serial_number = ?, parcel_weight_g = ?, updated_at = now() WHERE id = ?""")
                .params(c, t, Timestamp.from(now), Timestamp.from(now.plus(check)), serial, weight, id).update();
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

    /**
     * Reclamația cumpărătorului. Ca să nu fie crezut „pe cuvânt” (vânzătorul e protejat):
     *  - pentru orice motiv în afară de „nu am primit” sunt obligatorii cel puțin 2 poze cu produsul primit;
     *  - dacă vânzătorul a înregistrat seria / IMEI-ul, cumpărătorul trebuie să scrie seria de pe produsul primit;
     *  - vânzătorul are 72 de ore să răspundă cu propriile dovezi; decide un om din echipă;
     *  - banii se returnează doar după ce produsul ajunge înapoi la vânzător (dacă echipa cere returnarea).
     */
    @Transactional
    public View dispute(UUID me, UUID id, String reason, String details, List<UUID> evidenceImageIds, String reportedSerial) {
        Row o = load(id);
        if (!o.buyerId().equals(me)) throw ApiException.notFound();
        if (!canDispute(o)) throw ApiException.conflict("INVALID_STATE");
        if (!DISPUTE_REASONS.contains(reason)) throw ApiException.badRequest("VALIDATION");
        String text = details == null ? "" : Texts.clean(details.trim());
        if (text.length() < 10 || text.length() > 2000) throw ApiException.badRequest("DETAILS_REQUIRED");
        List<UUID> photos = evidenceImageIds == null ? List.of() : evidenceImageIds;
        if (photos.size() > 8) throw ApiException.badRequest("VALIDATION");
        if (NEEDS_PHOTOS.contains(reason) && photos.size() < 2) throw ApiException.badRequest("EVIDENCE_REQUIRED");
        String serial = cleanSerial(reportedSerial);
        if (o.serial() != null && Set.of("NOT_AS_DESCRIBED", "COUNTERFEIT").contains(reason) && serial == null) throw ApiException.badRequest("SERIAL_REQUIRED");
        attachEvidence(me, id, photos, "DISPUTE");
        jdbc.sql("""
                UPDATE orders SET status = 'DISPUTED', dispute_reason = ?, dispute_details = ?, dispute_serial = ?, disputed_at = now(),
                  auto_release_at = NULL, updated_at = now() WHERE id = ?""")
                .params(reason, text, serial, id).update();
        // Istoricul cumpărătorului: multe reclamații în puțin timp = semnal de abuz pentru echipă.
        int recent = jdbc.sql("SELECT count(*) FROM orders WHERE buyer_id = ? AND disputed_at > now() - interval '90 days'").param(me).query(Integer.class).single();
        int lost = jdbc.sql("SELECT count(*) FROM orders WHERE buyer_id = ? AND resolved_against = 'BUYER' AND updated_at > now() - interval '365 days'").param(me).query(Integer.class).single();
        boolean mismatch = o.serial() != null && serial != null && !o.serial().equals(serial);
        String flags = (recent >= 3 ? " [ATENȚIE: " + recent + " reclamații în 90 de zile]" : "") + (lost > 0 ? " [" + lost + " dispute pierdute în 12 luni]" : "")
                + (mismatch ? " [Seria raportată diferă de cea înregistrată la expediere]" : "");
        if (recent >= 3) audit.log(me, "DISPUTE_ABUSE_FLAG", o.code());
        velo.openReport(me, "ORDER", id, reason, "Comanda " + o.code() + " (" + o.total() / 100.0 + " " + o.currency() + "): " + text + flags);
        event(conv(o), me, "DISPUTED", o.item(), o.currency());
        notifications.notify(o.sellerId(), "ORDER_DISPUTED", Map.of("title", title(o), "code", o.code()), "/orders/" + id);
        audit.log(me, "ORDER_DISPUTED", o.code());
        return view(me, id);
    }

    /** Răspunsul vânzătorului la o reclamație: explicație și dovezi proprii, în 72 de ore. */
    @Transactional
    public View respond(UUID me, UUID id, String statement, List<UUID> evidenceImageIds) {
        Row o = load(id);
        if (!o.sellerId().equals(me)) throw ApiException.notFound();
        if (!"DISPUTED".equals(o.status()) || o.respondedAt() != null) throw ApiException.conflict("INVALID_STATE");
        String text = statement == null ? "" : Texts.clean(statement.trim());
        if (text.length() < 10 || text.length() > 2000) throw ApiException.badRequest("DETAILS_REQUIRED");
        List<UUID> photos = evidenceImageIds == null ? List.of() : evidenceImageIds;
        if (photos.size() > 8) throw ApiException.badRequest("VALIDATION");
        attachEvidence(me, id, photos, "SELLER_RESPONSE");
        jdbc.sql("UPDATE orders SET seller_response = ?, responded_at = now(), updated_at = now() WHERE id = ?").params(text, id).update();
        notifications.notify(o.buyerId(), "ORDER_SELLER_RESPONDED", Map.of("title", title(o)), "/orders/" + id);
        audit.log(me, "ORDER_SELLER_RESPONDED", o.code());
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

    /**
     * Decizia echipei într-o dispută:
     *  RETURN  – cumpărătorul trimite produsul înapoi (cu AWB) în 7 zile; banii se returnează după ce vânzătorul îl primește;
     *  REFUND  – rambursare fără returnare (ex. coletul nu a ajuns niciodată, confirmat de curier);
     *  RELEASE – reclamația nu e susținută de dovezi: vânzătorul primește banii.
     */
    @Transactional
    public void resolve(UUID admin, UUID id, String outcome) {
        Row o = load(id);
        if (!"DISPUTED".equals(o.status())) throw ApiException.conflict("INVALID_STATE");
        switch (outcome == null ? "" : outcome) {
            case "RETURN" -> {
                jdbc.sql("UPDATE orders SET status = 'RETURN_REQUESTED', return_by = ?, resolution = 'RETURN', updated_at = now() WHERE id = ?")
                        .params(Timestamp.from(Instant.now().plus(RETURN_WINDOW)), id).update();
                event(conv(o), admin, "RETURN_REQUESTED", o.item(), o.currency());
                notifications.notify(o.buyerId(), "ORDER_RETURN_REQUESTED", Map.of("title", title(o)), "/orders/" + id);
                notifications.notify(o.sellerId(), "ORDER_RETURN_REQUESTED", Map.of("title", title(o)), "/orders/" + id);
            }
            case "REFUND" -> { setResolution(id, "REFUND", "SELLER"); refund(o, admin, "DISPUTE_REFUND"); }
            case "RELEASE" -> { setResolution(id, "RELEASE", "BUYER"); complete(o, admin, "ORDER_RELEASED"); }
            default -> throw ApiException.badRequest("VALIDATION");
        }
        audit.log(admin, "ORDER_RESOLVED", o.code() + " " + outcome);
    }

    /** Cumpărătorul trimite produsul înapoi, cu AWB. */
    @Transactional
    public View returnShip(UUID me, UUID id, String carrier, String tracking) {
        Row o = load(id);
        if (!o.buyerId().equals(me)) throw ApiException.notFound();
        if (!"RETURN_REQUESTED".equals(o.status()) || o.returnShippedAt() != null) throw ApiException.conflict("INVALID_STATE");
        String c = carrier == null ? "" : carrier.trim().toUpperCase(Locale.ROOT);
        String t = tracking == null ? "" : tracking.trim().replaceAll("[^A-Za-z0-9-]", "");
        if (!CARRIERS.contains(c) || t.length() < 5 || t.length() > 40) throw ApiException.badRequest("TRACKING_REQUIRED");
        jdbc.sql("UPDATE orders SET return_carrier = ?, return_tracking = ?, return_shipped_at = now(), updated_at = now() WHERE id = ?")
                .params(c, t, id).update();
        notifications.notify(o.sellerId(), "ORDER_RETURN_SHIPPED", Map.of("title", title(o), "carrier", c, "tracking", t), "/orders/" + id);
        return view(me, id);
    }

    /**
     * Vânzătorul confirmă că a primit produsul înapoi. Dacă e în aceeași stare: rambursare.
     * Dacă a primit altceva sau produsul e deteriorat: disputa revine la echipă (cu nota vânzătorului).
     */
    @Transactional
    public View returnReceived(UUID me, UUID id, boolean sameCondition, String note) {
        Row o = load(id);
        if (!o.sellerId().equals(me)) throw ApiException.notFound();
        if (!"RETURN_REQUESTED".equals(o.status()) || o.returnShippedAt() == null) throw ApiException.conflict("INVALID_STATE");
        if (sameCondition) {
            setResolution(id, "RETURN_REFUND", "SELLER");
            refund(o, me, "RETURNED");
        } else {
            String text = note == null ? "" : Texts.clean(note.trim());
            if (text.length() < 10) throw ApiException.badRequest("DETAILS_REQUIRED");
            String prev = o.sellerResponse() == null ? "" : o.sellerResponse() + "\n";
            jdbc.sql("UPDATE orders SET status = 'DISPUTED', resolution = NULL, seller_response = ?, updated_at = now() WHERE id = ?")
                    .params(clip(prev + "La returnare: " + text, 2000), id).update();
            velo.openReport(me, "ORDER", id, "OTHER", "Comanda " + o.code() + ": vânzătorul spune că produsul returnat nu e cel trimis sau e deteriorat. " + text);
        }
        return view(me, id);
    }

    /** Eliberări, rambursări automate și ștergerea adreselor vechi. */
    @Scheduled(fixedDelay = 600_000, initialDelay = 60_000)
    @Transactional
    public void housekeeping() {
        for (Row o : rows("WHERE status = 'SHIPPED' AND auto_release_at < now()")) complete(o, null, "ORDER_AUTO_COMPLETED");
        for (Row o : rows("WHERE status = 'PAID' AND ship_by < ?", Timestamp.from(Instant.now().minus(REFUND_GRACE)))) refund(o, null, "NOT_SHIPPED_IN_TIME");
        // Cumpărătorul n-a trimis produsul înapoi la timp: reclamația cade, vânzătorul e plătit.
        for (Row o : rows("WHERE status = 'RETURN_REQUESTED' AND return_shipped_at IS NULL AND return_by < now()")) {
            setResolution(o.id(), "RETURN_NOT_SENT", "BUYER");
            complete(o, null, "ORDER_RELEASED");
        }
        // Produsul a fost trimis înapoi, dar vânzătorul nu reacționează în 14 zile: rambursăm.
        for (Row o : rows("WHERE status = 'RETURN_REQUESTED' AND return_shipped_at < ?", Timestamp.from(Instant.now().minus(RETURN_CONFIRM_WINDOW)))) {
            setResolution(o.id(), "RETURN_REFUND", "SELLER");
            refund(o, null, "RETURNED");
        }
        // Minimizarea datelor (GDPR): adresa și telefonul dispar la 90 de zile după încheierea comenzii.
        jdbc.sql("""
                UPDATE orders SET ship_name = NULL, ship_address = NULL, ship_city = NULL, ship_postcode = NULL, ship_phone = NULL
                WHERE status IN ('COMPLETED', 'REFUNDED') AND ship_address IS NOT NULL AND coalesce(completed_at, refunded_at) < ?""")
                .param(Timestamp.from(Instant.now().minus(ADDRESS_RETENTION))).update();
    }

    private void setResolution(UUID id, String resolution, String against) {
        jdbc.sql("UPDATE orders SET resolution = ?, resolved_against = ? WHERE id = ?").params(resolution, against, id).update();
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

    /** Pentru panoul de administrare: disputele deschise, cu istoricul ambelor părți. */
    public List<AdminDispute> disputed(UUID admin) {
        return rows("WHERE status IN ('DISPUTED', 'RETURN_REQUESTED') ORDER BY updated_at").stream().map(o -> new AdminDispute(toView(o.buyerId(), o),
                jdbc.sql("SELECT count(*) FROM orders WHERE buyer_id = ? AND disputed_at > now() - interval '90 days'").param(o.buyerId()).query(Integer.class).single(),
                jdbc.sql("SELECT count(*) FROM orders WHERE buyer_id = ? AND resolved_against = 'BUYER' AND updated_at > now() - interval '365 days'").param(o.buyerId()).query(Integer.class).single(),
                jdbc.sql("SELECT count(*) FROM orders WHERE seller_id = ? AND resolved_against = 'SELLER' AND updated_at > now() - interval '365 days'").param(o.sellerId()).query(Integer.class).single()))
                .toList();
    }

    private boolean proofRequired(Row o) { return "COURIER".equals(o.delivery()) && o.item() >= Fx.fromEurCents(PROOF_REQUIRED_EUR_CENTS, o.currency()); }

    /** Curier: reclamație doar după expediere (înainte se anulează); predare personală: și înainte de confirmare. */
    private static boolean canDispute(Row o) {
        return "SHIPPED".equals(o.status()) || ("PAID".equals(o.status()) && "PICKUP".equals(o.delivery()));
    }

    private View toView(UUID me, Row o) {
        boolean seller = o.sellerId().equals(me);
        UUID other = seller ? o.buyerId() : o.sellerId();
        ListingDtos.Card card = queries.byIds(List.of(o.listingId()), me).stream().findFirst().orElse(null);
        UserDtos.PublicUser cp = users.findById(other).map(UserDtos::toPublic).orElse(null);
        boolean late = "PAID".equals(o.status()) && o.shipBy() != null && o.shipBy().isBefore(Instant.now());
        UUID conv = jdbc.sql("SELECT id FROM conversations WHERE listing_id = ? AND buyer_id = ?").params(o.listingId(), o.buyerId())
                .query(UUID.class).optional().orElse(null);
        Evidence ev = new Evidence(o.serial(), o.weight(), evidenceUrls(o.id(), "SHIP_PROOF"), o.disputeDetails(), evidenceUrls(o.id(), "DISPUTE"),
                o.disputeSerial(), o.serial() != null && o.disputeSerial() != null && !o.serial().equals(o.disputeSerial()),
                o.sellerResponse(), evidenceUrls(o.id(), "SELLER_RESPONSE"), o.disputedAt(),
                o.disputedAt() == null ? null : o.disputedAt().plus(RESPOND_WINDOW), o.returnBy(), o.returnCarrier(), o.returnTracking(),
                o.returnShippedAt(), o.resolution());
        return new View(o.id(), o.code(), seller ? "SELLER" : "BUYER", card, cp, o.item(), o.shipping(), o.fee(), o.total(), o.currency(),
                o.delivery(), "COURIER".equals(o.delivery()) && o.addr().address() != null ? o.addr() : null, o.carrier(), o.tracking(), o.status(), o.disputeReason(),
                o.refundReason(), o.createdAt(), o.paidAt(), o.shipBy(), o.shippedAt(), o.autoRelease(), o.completedAt(), o.refundedAt(),
                seller && "PAID".equals(o.status()),
                !seller && Set.of("PAID", "SHIPPED").contains(o.status()),
                !seller && canDispute(o),
                "PAID".equals(o.status()) && (seller || late), conv, props.devMode(), ev, proofRequired(o),
                seller && "DISPUTED".equals(o.status()) && o.respondedAt() == null,
                !seller && "RETURN_REQUESTED".equals(o.status()) && o.returnShippedAt() == null,
                seller && "RETURN_REQUESTED".equals(o.status()) && o.returnShippedAt() != null);
    }

    /** Pozele-dovadă: nu sunt publice, se văd doar prin link semnat, valabil 2 ore. */
    private List<String> evidenceUrls(UUID orderId, String role) {
        return jdbc.sql("SELECT id FROM listing_images WHERE order_id = ? AND evidence_role = ? ORDER BY created_at").params(orderId, role)
                .query(UUID.class).list().stream().map(signer::url).toList();
    }

    /** Leagă poze încărcate de utilizator de comandă, ca dovezi (doar poze proprii, neatașate încă nicăieri). */
    private void attachEvidence(UUID owner, UUID orderId, List<UUID> ids, String role) {
        for (UUID img : new LinkedHashSet<>(ids)) {
            int n = jdbc.sql("""
                    UPDATE listing_images SET purpose = 'EVIDENCE', order_id = ?, evidence_role = ?
                    WHERE id = ? AND owner_id = ? AND listing_id IS NULL AND purpose = 'LISTING' AND order_id IS NULL""")
                    .params(orderId, role, img, owner).update();
            if (n == 0) throw ApiException.badRequest("INVALID_IMAGE");
        }
    }

    private static String cleanSerial(String s) {
        if (s == null) return null;
        String v = s.toUpperCase(Locale.ROOT).replaceAll("[^A-Z0-9]", "");
        if (v.isEmpty()) return null;
        if (v.length() < 4 || v.length() > 40) throw ApiException.badRequest("INVALID_SERIAL");
        return v;
    }

    private static String clip(String s, int max) { return s.length() > max ? s.substring(0, max) : s; }

    private Row load(UUID id) {
        return rows("WHERE id = ?", id).stream().findFirst().orElseThrow(ApiException::notFound);
    }

    /** Clauza WHERE e mereu o constantă din această clasă; valorile vin doar ca parametri. */
    private List<Row> rows(String where, Object... params) {
        return jdbc.sql("""
                SELECT id, code, listing_id, buyer_id, seller_id, item_cents, shipping_cents, fee_cents, total_cents, currency, delivery,
                  ship_name, ship_address, ship_city, ship_postcode, ship_country, ship_phone, carrier, tracking_code, status, dispute_reason,
                  refund_reason, created_at, paid_at, ship_by, shipped_at, auto_release_at, completed_at, refunded_at,
                  serial_number, parcel_weight_g, dispute_details, dispute_serial, disputed_at, seller_response, responded_at,
                  return_by, return_carrier, return_tracking, return_shipped_at, resolution, resolved_against FROM orders
                """ + " " + where)
                .params(params).query(this::row).list();
    }

    private Row row(ResultSet rs, int i) throws SQLException {
        return new Row(rs.getObject(1, UUID.class), rs.getString(2), rs.getObject(3, UUID.class), rs.getObject(4, UUID.class),
                rs.getObject(5, UUID.class), rs.getLong(6), rs.getLong(7), rs.getLong(8), rs.getLong(9), rs.getString(10), rs.getString(11),
                new Address(FieldCrypto.decrypt(rs.getString(12)), FieldCrypto.decrypt(rs.getString(13)), FieldCrypto.decrypt(rs.getString(14)),
                        FieldCrypto.decrypt(rs.getString(15)), rs.getString(16), FieldCrypto.decrypt(rs.getString(17))),
                rs.getString(18), rs.getString(19), rs.getString(20), rs.getString(21), rs.getString(22),
                ts(rs, 23), ts(rs, 24), ts(rs, 25), ts(rs, 26), ts(rs, 27), ts(rs, 28), ts(rs, 29),
                rs.getString(30), (Integer) rs.getObject(31), rs.getString(32), rs.getString(33), ts(rs, 34), rs.getString(35), ts(rs, 36),
                ts(rs, 37), rs.getString(38), rs.getString(39), ts(rs, 40), rs.getString(41), rs.getString(42));
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
