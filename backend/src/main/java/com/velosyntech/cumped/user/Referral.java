package com.velosyntech.cumped.user;

import jakarta.persistence.*;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "referrals")
public class Referral {
    @Id private UUID inviteeId;
    private UUID inviterId;
    private boolean qualified;
    private Instant createdAt = Instant.now();

    protected Referral() {}
    public Referral(UUID inviteeId, UUID inviterId) { this.inviteeId = inviteeId; this.inviterId = inviterId; }

    public UUID getInviteeId() { return inviteeId; }
    public UUID getInviterId() { return inviterId; }
    public boolean isQualified() { return qualified; }
    public void setQualified(boolean qualified) { this.qualified = qualified; }
}
