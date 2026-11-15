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
    /** Prietenul invitat și-a primit bonusul (o ridicare gratuită) — o singură dată. */
    private boolean inviteeRewarded;
    private Instant createdAt = Instant.now();

    protected Referral() {}
    public Referral(UUID inviteeId, UUID inviterId) { this.inviteeId = inviteeId; this.inviterId = inviterId; }

    public UUID getInviteeId() { return inviteeId; }
    public UUID getInviterId() { return inviterId; }
    public boolean isQualified() { return qualified; }
    public void setQualified(boolean qualified) { this.qualified = qualified; }
    public boolean isInviteeRewarded() { return inviteeRewarded; }
    public void setInviteeRewarded(boolean inviteeRewarded) { this.inviteeRewarded = inviteeRewarded; }
}
