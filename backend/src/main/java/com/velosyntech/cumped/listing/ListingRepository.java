package com.velosyntech.cumped.listing;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;

import java.time.Instant;
import java.util.Collection;
import java.util.List;
import java.util.UUID;

public interface ListingRepository extends JpaRepository<Listing, UUID> {
    List<Listing> findBySellerIdAndStatusInOrderByCreatedAtDesc(UUID sellerId, Collection<Listing.Status> statuses);

    @Modifying
    @Query("UPDATE Listing l SET l.status = com.velosyntech.cumped.listing.Listing.Status.EXPIRED " +
           "WHERE l.status = com.velosyntech.cumped.listing.Listing.Status.ACTIVE AND l.expiresAt < :now")
    int expireOld(Instant now);

    @Modifying
    @Query(value = "UPDATE listings SET view_count = view_count + 1 WHERE id = :id", nativeQuery = true)
    void incrementViews(UUID id);

    @Modifying
    @Query(value = "UPDATE listings SET fav_count = GREATEST(0, fav_count + :delta) WHERE id = :id", nativeQuery = true)
    void addFavorites(UUID id, int delta);

    @Modifying
    @Query(value = "UPDATE listings SET msg_count = msg_count + 1 WHERE id = :id", nativeQuery = true)
    void incrementMessages(UUID id);
}
