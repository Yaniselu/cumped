package com.velosyntech.cumped.listing;

import jakarta.persistence.*;

import java.time.Duration;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "listings")
public class Listing {
    public enum Status { ACTIVE, PAUSED, SOLD, EXPIRED, HIDDEN_BY_AI, REMOVED, DELETED }
    public enum Condition { NEW, LIKE_NEW, GOOD, FAIR, FOR_PARTS }

    public static final Duration LIFETIME = Duration.ofDays(30);

    @Id private UUID id = UUID.randomUUID();
    private UUID sellerId;
    private String title;
    private String description;
    @Enumerated(EnumType.STRING) private Category category;
    @Enumerated(EnumType.STRING) @Column(name = "item_condition") private Condition condition;
    private long priceCents;
    private String currency;
    private String country;
    private String city;
    private String shipsTo = "";
    private int weightGrams = 1000;
    private boolean acceptsOffers = true;
    private boolean acceptsSwap;
    private String attributes = "";
    @Enumerated(EnumType.STRING) private Status status = Status.ACTIVE;
    private UUID soldToId;
    private Instant promotedUntil;
    private Instant bumpedAt;
    private int viewCount;
    private int favCount;
    private int msgCount;
    private Instant createdAt = Instant.now();
    private Instant updatedAt = Instant.now();
    private Instant expiresAt = Instant.now().plus(LIFETIME);

    public UUID getId() { return id; }
    public UUID getSellerId() { return sellerId; }
    public void setSellerId(UUID sellerId) { this.sellerId = sellerId; }
    public String getTitle() { return title; }
    public void setTitle(String title) { this.title = title; }
    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }
    public Category getCategory() { return category; }
    public void setCategory(Category category) { this.category = category; }
    public Condition getCondition() { return condition; }
    public void setCondition(Condition condition) { this.condition = condition; }
    public long getPriceCents() { return priceCents; }
    public void setPriceCents(long priceCents) { this.priceCents = priceCents; }
    public String getCurrency() { return currency; }
    public void setCurrency(String currency) { this.currency = currency; }
    public String getCountry() { return country; }
    public void setCountry(String country) { this.country = country; }
    public String getCity() { return city; }
    public void setCity(String city) { this.city = city; }
    public String getShipsTo() { return shipsTo; }
    public void setShipsTo(String shipsTo) { this.shipsTo = shipsTo; }
    public int getWeightGrams() { return weightGrams; }
    public void setWeightGrams(int weightGrams) { this.weightGrams = weightGrams; }
    public boolean isAcceptsOffers() { return acceptsOffers; }
    public void setAcceptsOffers(boolean acceptsOffers) { this.acceptsOffers = acceptsOffers; }
    public boolean isAcceptsSwap() { return acceptsSwap; }
    public void setAcceptsSwap(boolean acceptsSwap) { this.acceptsSwap = acceptsSwap; }
    public String getAttributes() { return attributes; }
    public void setAttributes(String attributes) { this.attributes = attributes; }
    public Status getStatus() { return status; }
    public void setStatus(Status status) { this.status = status; }
    public UUID getSoldToId() { return soldToId; }
    public void setSoldToId(UUID soldToId) { this.soldToId = soldToId; }
    public Instant getPromotedUntil() { return promotedUntil; }
    public void setPromotedUntil(Instant promotedUntil) { this.promotedUntil = promotedUntil; }
    public Instant getBumpedAt() { return bumpedAt; }
    public void setBumpedAt(Instant bumpedAt) { this.bumpedAt = bumpedAt; }
    public int getViewCount() { return viewCount; }
    public int getFavCount() { return favCount; }
    public int getMsgCount() { return msgCount; }
    public Instant getCreatedAt() { return createdAt; }
    public void setCreatedAt(Instant createdAt) { this.createdAt = createdAt; }
    public Instant getUpdatedAt() { return updatedAt; }
    public void touch() { this.updatedAt = Instant.now(); }
    public Instant getExpiresAt() { return expiresAt; }
    public void setExpiresAt(Instant expiresAt) { this.expiresAt = expiresAt; }

    public boolean isPromoted() { return promotedUntil != null && promotedUntil.isAfter(Instant.now()); }
    public boolean isPubliclyVisible() { return status == Status.ACTIVE || status == Status.SOLD; }
    public boolean countsTowardQuota() { return status == Status.ACTIVE || status == Status.PAUSED || status == Status.HIDDEN_BY_AI; }

    public boolean shipsTo(String countryCode) {
        if (countryCode == null) return false;
        if (countryCode.equalsIgnoreCase(country)) return true;
        if ("*".equals(shipsTo)) return true;
        for (String c : shipsTo.split(",")) if (c.trim().equalsIgnoreCase(countryCode)) return true;
        return false;
    }
}
