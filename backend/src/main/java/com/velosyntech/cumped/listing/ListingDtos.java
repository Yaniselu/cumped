package com.velosyntech.cumped.listing;

import com.velosyntech.cumped.user.UserDtos;
import jakarta.validation.constraints.*;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;

public final class ListingDtos {
    private ListingDtos() {}

    public record Card(UUID id, String title, long priceCents, String currency, Long previousPriceCents,
                       String city, String country, String imageUrl, String category, String condition,
                       boolean sellerVerified, boolean promoted, boolean acceptsSwap, boolean favorite,
                       String status, Instant createdAt, boolean sellerBusiness, boolean negotiable) {}

    public record Image(UUID id, String url, String thumbUrl) {}

    public record PricePoint(long priceCents, Instant at) {}

    public record OwnerStats(int views, int favorites, int messages, long offers, Instant expiresAt) {}

    public record Detail(UUID id, String title, String description, String category, String condition,
                         long priceCents, String currency, Long previousPriceCents, String country, String city,
                         List<String> shipsTo, int weightGrams, boolean acceptsOffers, boolean acceptsSwap,
                         Map<String, String> attributes, List<Image> images, String status, boolean promoted,
                         Instant createdAt, UserDtos.PublicUser seller, boolean favorite, boolean owner,
                         UUID conversationId, List<PricePoint> priceHistory, OwnerStats ownerStats,
                         int favorites, int views, boolean negotiable, int quantity, Long minPriceCents,
                         String moderationReason, boolean blocked) {}

    public record Upsert(
            @NotBlank @Size(min = 5, max = 90) String title,
            @NotBlank @Size(min = 20, max = 4000) String description,
            @NotNull Category category,
            @NotNull Listing.Condition condition,
            @PositiveOrZero @Max(100_000_000_00L) long priceCents,
            @NotBlank @Pattern(regexp = "^[A-Z]{3}$") String currency,
            @NotBlank @Pattern(regexp = "^[A-Z]{2}$") String country,
            @NotBlank @Size(max = 80) String city,
            @Size(max = 60) List<@Pattern(regexp = "^([A-Z]{2}|\\*)$") String> shipsTo,
            @Min(1) @Max(1_000_000) Integer weightGrams,
            boolean acceptsOffers,
            boolean acceptsSwap,
            @Size(max = 40) Map<@Size(max = 40) String, @Size(max = 120) String> attributes,
            @Size(max = 10) List<UUID> imageIds,
            Boolean negotiable,
            @PositiveOrZero Long minPriceCents,
            @Min(1) @Max(999) Integer quantity) {}

    public record PriceAnalysis(String verdict, Long medianCents, int comparables, String currency) {}

    public record Page<T>(List<T> items, int page, boolean hasMore) {}

    public record SearchParams(String q, Category category, Long minPrice, Long maxPrice, String country,
                               String city, List<Listing.Condition> conditions, Boolean swapOnly,
                               Boolean verifiedOnly, String shipsTo, String sort, int page, int size) {}
}
