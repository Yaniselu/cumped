package com.velosyntech.cumped.billing;

import com.velosyntech.cumped.common.ApiException;
import com.velosyntech.cumped.common.AuditService;
import com.velosyntech.cumped.common.CurrentUser;
import com.velosyntech.cumped.config.AppProperties;
import com.velosyntech.cumped.listing.Listing;
import com.velosyntech.cumped.listing.ListingService;
import com.velosyntech.cumped.user.User;
import com.velosyntech.cumped.user.UserRepository;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

/**
 * Prețurile platformei. Plata reală se face prin Stripe (de configurat).
 * Până atunci, în DEV_MODE achizițiile sunt simulate ca să se poată testa fluxurile.
 */
@RestController
@RequestMapping("/api/billing")
public class BillingController {
    public record Product(String id, long priceCents, String currency, String period) {}
    public record Checkout(@NotBlank String product, UUID listingId) {}

    public static final List<Product> PRODUCTS = List.of(
            new Product("EXTRA_LISTING", 199, "EUR", "30_DAYS"),
            new Product("PLUS", 499, "EUR", "MONTH"),
            new Product("PRO", 1999, "EUR", "MONTH"),
            new Product("PROMOTE_7D", 299, "EUR", "7_DAYS"),
            new Product("BUMP", 99, "EUR", "ONCE"));

    /** Comisionul plății sigure: 2,5%, minim 0,50 €, maxim 20 €, plătit de cumpărător. */
    public static final Map<String, Object> PROTECTION_FEE = Map.of("percent", 2.5, "minCents", 50, "maxCents", 2000, "currency", "EUR");

    private final AppProperties props;
    private final UserRepository users;
    private final ListingService listings;
    private final JdbcClient jdbc;
    private final AuditService audit;
    private final com.velosyntech.cumped.user.QuotaService quota;

    public BillingController(AppProperties props, UserRepository users, ListingService listings, JdbcClient jdbc, AuditService audit,
                             com.velosyntech.cumped.user.QuotaService quota) {
        this.quota = quota;
        this.props = props;
        this.users = users;
        this.listings = listings;
        this.jdbc = jdbc;
        this.audit = audit;
    }

    @GetMapping("/plans")
    Map<String, Object> plans() {
        return Map.of("products", PRODUCTS, "protectionFee", PROTECTION_FEE, "paymentsEnabled", false, "simulated", props.devMode());
    }

    @PostMapping("/checkout")
    @Transactional
    Map<String, Object> checkout(@Valid @RequestBody Checkout r) {
        if (!props.devMode()) throw new ApiException(HttpStatus.SERVICE_UNAVAILABLE, "PAYMENTS_NOT_CONFIGURED");
        UUID me = CurrentUser.id();
        User u = users.findById(me).orElseThrow(ApiException::notFound);
        Instant now = Instant.now();
        switch (r.product()) {
            case "PLUS", "PRO" -> {
                u.setPlan(User.Plan.valueOf(r.product()));
                u.setPlanUntil(now.plus(Duration.ofDays(30)));
                users.save(u);
            }
            case "EXTRA_LISTING" -> jdbc.sql("INSERT INTO purchased_slots(id, user_id, expires_at) VALUES (?, ?, ?)")
                    .params(UUID.randomUUID(), me, java.sql.Timestamp.from(now.plus(Duration.ofDays(30)))).update();
            case "PROMOTE_7D", "BUMP" -> applyToListing(me, r.product(), r.listingId(), now);
            default -> throw ApiException.badRequest("UNKNOWN_PRODUCT");
        }
        audit.log(me, "PURCHASE_SIMULATED", r.product());
        return Map.of("ok", true, "simulated", true);
    }

    /** Folosește un credit gratuit câștigat din invitații (promovare 7 zile sau ridicare), fără plată. */
    @PostMapping("/redeem")
    @Transactional
    Map<String, Object> redeem(@Valid @RequestBody Checkout r) {
        if (!Set.of("PROMOTE_7D", "BUMP").contains(r.product())) throw ApiException.badRequest("UNKNOWN_PRODUCT");
        UUID me = CurrentUser.id();
        ownedActive(me, r.listingId());
        if (!quota.useCredit(me, r.product(), r.listingId())) throw ApiException.conflict("NO_CREDIT");
        applyToListing(me, r.product(), r.listingId(), Instant.now());
        audit.log(me, "CREDIT_USED", r.product());
        return Map.of("ok", true, "credits", quota.credits(me));
    }

    private void applyToListing(UUID me, String product, UUID listingId, Instant now) {
        Listing l = ownedActive(me, listingId);
        if ("PROMOTE_7D".equals(product)) {
            Instant from = l.isPromoted() ? l.getPromotedUntil() : now;
            jdbc.sql("UPDATE listings SET promoted_until = ? WHERE id = ?")
                    .params(java.sql.Timestamp.from(from.plus(Duration.ofDays(7))), l.getId()).update();
        } else {
            jdbc.sql("UPDATE listings SET bumped_at = now() WHERE id = ?").param(l.getId()).update();
        }
    }

    private Listing ownedActive(UUID me, UUID listingId) {
        if (listingId == null) throw ApiException.badRequest("LISTING_REQUIRED");
        Listing l = listings.owned(me, listingId);
        if (l.getStatus() != Listing.Status.ACTIVE) throw ApiException.conflict("INVALID_STATE");
        return l;
    }
}
