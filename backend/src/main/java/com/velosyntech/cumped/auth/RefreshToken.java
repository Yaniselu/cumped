package com.velosyntech.cumped.auth;

import jakarta.persistence.*;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "refresh_tokens")
public class RefreshToken {
    @Id private UUID id = UUID.randomUUID();
    private UUID userId;
    private String tokenHash;
    private UUID family;
    private Instant expiresAt;
    private Instant revokedAt;
    private Instant createdAt = Instant.now();

    protected RefreshToken() {}

    public RefreshToken(UUID userId, String tokenHash, UUID family, Instant expiresAt) {
        this.userId = userId;
        this.tokenHash = tokenHash;
        this.family = family;
        this.expiresAt = expiresAt;
    }

    public UUID getUserId() { return userId; }
    public UUID getFamily() { return family; }
    public Instant getExpiresAt() { return expiresAt; }
    public Instant getRevokedAt() { return revokedAt; }
    public void revoke() { if (revokedAt == null) revokedAt = Instant.now(); }
}
