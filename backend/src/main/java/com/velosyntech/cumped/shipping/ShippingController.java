package com.velosyntech.cumped.shipping;

import com.velosyntech.cumped.common.ApiException;
import com.velosyntech.cumped.listing.Listing;
import com.velosyntech.cumped.listing.ListingRepository;
import org.springframework.web.bind.annotation.*;

import java.util.Locale;
import java.util.Set;
import java.util.UUID;

/**
 * Estimare de cost de livrare pe zone și greutate, până la integrarea cu un agregator de curieri (Shippo/EasyPost).
 * Valorile sunt orientative și afișate ca „estimare”.
 */
@RestController
@RequestMapping("/api/shipping")
public class ShippingController {
    public record Estimate(boolean available, String zone, long minCents, long maxCents, String currency, int minDays, int maxDays) {}

    private static final Set<String> EU = Set.of("AT", "BE", "BG", "HR", "CY", "CZ", "DK", "EE", "FI", "FR", "DE", "GR",
            "HU", "IE", "IT", "LV", "LT", "LU", "MT", "NL", "PL", "PT", "RO", "SK", "SI", "ES", "SE");
    private static final Set<String> EUROPE = Set.of("GB", "CH", "NO", "IS", "MD", "UA", "RS", "BA", "ME", "MK", "AL", "TR");

    private final ListingRepository listings;

    public ShippingController(ListingRepository listings) { this.listings = listings; }

    @GetMapping("/estimate")
    Estimate estimate(@RequestParam UUID listingId, @RequestParam String to) {
        String dest = to.trim().toUpperCase(Locale.ROOT);
        if (!dest.matches("^[A-Z]{2}$")) throw ApiException.badRequest("INVALID_COUNTRY");
        Listing l = listings.findById(listingId).filter(Listing::isPubliclyVisible).orElseThrow(ApiException::notFound);
        if (!l.shipsTo(dest)) return new Estimate(false, null, 0, 0, "EUR", 0, 0);
        double kg = Math.max(0.5, l.getWeightGrams() / 1000.0);
        String zone;
        double base, perKg;
        int dMin, dMax;
        if (dest.equals(l.getCountry())) { zone = "DOMESTIC"; base = 3.5; perKg = 0.6; dMin = 1; dMax = 3; }
        else if (EU.contains(dest) && EU.contains(l.getCountry())) { zone = "EU"; base = 11; perKg = 2.2; dMin = 3; dMax = 7; }
        else if ((EU.contains(dest) || EUROPE.contains(dest)) && (EU.contains(l.getCountry()) || EUROPE.contains(l.getCountry()))) {
            zone = "EUROPE"; base = 17; perKg = 3.5; dMin = 4; dMax = 10;
        } else { zone = "WORLD"; base = 26; perKg = 6; dMin = 6; dMax = 18; }
        long cost = Math.round((base + perKg * kg) * 100);
        return new Estimate(true, zone, Math.round(cost * 0.85), Math.round(cost * 1.2), "EUR", dMin, dMax);
    }
}
