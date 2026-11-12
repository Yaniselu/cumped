package com.velosyntech.cumped.media;

import org.springframework.data.jpa.repository.JpaRepository;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

public interface ListingImageRepository extends JpaRepository<ListingImage, UUID> {
    List<ListingImage> findByListingIdOrderByPositionAsc(UUID listingId);
    List<ListingImage> findByListingIdIsNullAndPurposeAndCreatedAtBefore(String purpose, Instant cutoff);
    List<ListingImage> findByOwnerId(UUID ownerId);
    long countByOwnerIdAndListingIdIsNullAndPurpose(UUID ownerId, String purpose);
}
