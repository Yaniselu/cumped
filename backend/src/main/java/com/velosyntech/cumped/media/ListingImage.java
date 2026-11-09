package com.velosyntech.cumped.media;

import jakarta.persistence.*;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "listing_images")
public class ListingImage {
    @Id private UUID id = UUID.randomUUID();
    private UUID listingId;
    private UUID ownerId;
    private int position;
    private String storageKey;
    private String contentType;
    private Instant createdAt = Instant.now();

    protected ListingImage() {}

    public ListingImage(UUID ownerId, String storageKey, String contentType) {
        this.ownerId = ownerId;
        this.storageKey = storageKey;
        this.contentType = contentType;
    }

    public UUID getId() { return id; }
    public UUID getListingId() { return listingId; }
    public void setListingId(UUID listingId) { this.listingId = listingId; }
    public UUID getOwnerId() { return ownerId; }
    public int getPosition() { return position; }
    public void setPosition(int position) { this.position = position; }
    public String getStorageKey() { return storageKey; }
    public String getContentType() { return contentType; }
    public Instant getCreatedAt() { return createdAt; }

    /** Pozele demo sunt servite de frontend; restul trec prin API. */
    public String url() { return url(id, storageKey); }
    public String thumbUrl() { return thumbUrl(id, storageKey); }

    public static String url(UUID id, String storageKey) {
        if (storageKey.startsWith("demo:")) return "assets/demo/" + storageKey.substring(5);
        return "/api/media/" + id;
    }

    /** Miniatura (600px) pentru carduri și liste: de 4–6 ori mai mică decât imaginea întreagă. */
    public static String thumbUrl(UUID id, String storageKey) {
        if (storageKey.startsWith("demo:")) return "assets/demo/" + storageKey.substring(5).replace(".jpg", "-thumb.jpg");
        return "/api/media/" + id + "?size=thumb";
    }
}
