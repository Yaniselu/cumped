package com.velosyntech.cumped.listing;

import com.velosyntech.cumped.common.ApiException;
import com.velosyntech.cumped.common.CurrentUser;
import com.velosyntech.cumped.common.Texts;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

import java.util.*;

@RestController
@RequestMapping("/api")
public class ListingController {
    private final ListingService service;
    private final ListingQueries queries;
    private final ListingRepository listings;
    private final PriceAnalysisService prices;

    public ListingController(ListingService service, ListingQueries queries, ListingRepository listings,
                             PriceAnalysisService prices) {
        this.service = service;
        this.queries = queries;
        this.listings = listings;
        this.prices = prices;
    }

    @GetMapping("/categories")
    List<String> categories() { return Arrays.stream(Category.values()).map(Enum::name).toList(); }

    @GetMapping("/listings")
    ListingDtos.Page<ListingDtos.Card> search(
            @RequestParam(required = false) String q,
            @RequestParam(required = false) Category category,
            @RequestParam(required = false) Long minPrice,
            @RequestParam(required = false) Long maxPrice,
            @RequestParam(required = false) String country,
            @RequestParam(required = false) String city,
            @RequestParam(required = false) List<Listing.Condition> condition,
            @RequestParam(required = false) Boolean swap,
            @RequestParam(required = false) Boolean verified,
            @RequestParam(required = false) String shipsTo,
            @RequestParam(defaultValue = "newest") String sort,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        if (q != null && q.length() > 80) throw ApiException.badRequest("QUERY_TOO_LONG");
        if (!Set.of("newest", "price_asc", "price_desc", "relevance").contains(sort)) throw ApiException.badRequest("INVALID_SORT");
        return queries.search(new ListingDtos.SearchParams(Texts.clean(q), category, minPrice, maxPrice,
                code(country), Texts.clean(city), condition, swap, verified, code(shipsTo), sort, page, size),
                CurrentUser.idOptional().orElse(null));
    }

    @GetMapping("/listings/{id}")
    ListingDtos.Detail get(@PathVariable UUID id, HttpServletRequest req) {
        UUID viewer = CurrentUser.idOptional().orElse(null);
        String key = viewer != null ? viewer.toString() : Texts.sha256(req.getRemoteAddr() + "|" + req.getHeader("User-Agent"));
        return service.detail(id, viewer, key);
    }

    @GetMapping("/listings/{id}/similar")
    List<ListingDtos.Card> similar(@PathVariable UUID id) {
        Listing l = listings.findById(id).filter(Listing::isPubliclyVisible).orElseThrow(ApiException::notFound);
        return queries.similar(l, CurrentUser.idOptional().orElse(null));
    }

    @GetMapping("/listings/{id}/price-analysis")
    ListingDtos.PriceAnalysis priceAnalysis(@PathVariable UUID id) {
        Listing l = listings.findById(id).filter(Listing::isPubliclyVisible).orElseThrow(ApiException::notFound);
        return prices.analyze(l);
    }

    /** Estimare de preț pentru un anunț în lucru (înainte de publicare). */
    @PostMapping("/listings/price-check")
    ListingDtos.PriceAnalysis priceCheck(@RequestBody Map<String, Object> body) {
        try {
            String title = Texts.clean(String.valueOf(body.get("title")));
            Category cat = Category.valueOf(String.valueOf(body.get("category")));
            String currency = String.valueOf(body.get("currency"));
            long price = Long.parseLong(String.valueOf(body.get("priceCents")));
            if (title.length() > 90 || !currency.matches("^[A-Z]{3}$")) throw ApiException.badRequest("VALIDATION");
            return prices.analyze(null, title, cat, currency, price);
        } catch (IllegalArgumentException e) {
            throw ApiException.badRequest("VALIDATION");
        }
    }

    @PostMapping("/listings")
    @ResponseStatus(HttpStatus.CREATED)
    Map<String, Object> create(@Valid @RequestBody ListingDtos.Upsert r) {
        Listing l = service.create(CurrentUser.id(), r);
        return Map.of("id", l.getId());
    }

    @PutMapping("/listings/{id}")
    Map<String, Object> update(@PathVariable UUID id, @Valid @RequestBody ListingDtos.Upsert r) {
        Listing l = service.update(CurrentUser.id(), id, r);
        return Map.of("id", l.getId());
    }

    @PostMapping("/listings/{id}/status")
    Map<String, Object> status(@PathVariable UUID id, @RequestBody Map<String, String> body) {
        String action = body.get("action");
        UUID buyer = body.get("buyerId") == null ? null : UUID.fromString(body.get("buyerId"));
        Listing l = service.changeStatus(CurrentUser.id(), id, action == null ? "" : action, buyer);
        return Map.of("id", l.getId(), "status", l.getStatus().name());
    }

    @PostMapping("/listings/{id}/favorite")
    Map<String, Object> favorite(@PathVariable UUID id) {
        return Map.of("favorite", service.toggleFavorite(CurrentUser.id(), id, true));
    }

    public record PriceAlert(Long targetPriceCents) {}

    @PutMapping("/listings/{id}/price-alert")
    Map<String, Object> priceAlert(@PathVariable UUID id, @RequestBody PriceAlert r) {
        Long t = service.setPriceAlert(CurrentUser.id(), id, r.targetPriceCents());
        return java.util.Collections.singletonMap("targetPriceCents", t);
    }

    @DeleteMapping("/listings/{id}/price-alert")
    Map<String, Object> clearPriceAlert(@PathVariable UUID id) {
        service.setPriceAlert(CurrentUser.id(), id, null);
        return java.util.Collections.singletonMap("targetPriceCents", null);
    }

    @DeleteMapping("/listings/{id}/favorite")
    Map<String, Object> unfavorite(@PathVariable UUID id) {
        return Map.of("favorite", service.toggleFavorite(CurrentUser.id(), id, false));
    }

    @GetMapping("/me/listings")
    List<ListingDtos.Card> mine() {
        UUID me = CurrentUser.id();
        return queries.bySeller(me, me, true);
    }

    @GetMapping("/me/favorites")
    List<ListingDtos.Card> favorites() { return queries.favorites(CurrentUser.id()); }

    private static String code(String c) {
        if (c == null || c.isBlank()) return null;
        String v = c.trim().toUpperCase(Locale.ROOT);
        if (!v.matches("^[A-Z]{2}$")) throw ApiException.badRequest("INVALID_COUNTRY");
        return v;
    }
}
