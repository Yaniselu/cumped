package com.velosyntech.cumped.user;

import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.time.Instant;
import java.util.UUID;

/**
 * Câte anunțuri active poate avea un utilizator:
 *  - FREE: 2 active în același timp; 5 dacă a invitat 10 persoane care și-au verificat contul.
 *  - PLUS: 15, PRO/Business: 100.
 * Peste limită: anunț suplimentar plătit sau abonament.
 */
@Service
public class QuotaService {
    public static final int FREE_LIMIT = 2;
    public static final int FREE_REFERRAL_LIMIT = 5;
    public static final int REFERRALS_NEEDED = 10;
    public static final int PLUS_LIMIT = 15;
    public static final int PRO_LIMIT = 100;

    public record Quota(int active, int limit, long qualifiedReferrals, int referralsNeeded, Instant freeYearEndsAt) {}

    private final JdbcClient jdbc;
    private final ReferralRepository referrals;

    public QuotaService(JdbcClient jdbc, ReferralRepository referrals) {
        this.jdbc = jdbc;
        this.referrals = referrals;
    }

    public Quota quotaFor(User u) {
        int active = jdbc.sql("SELECT count(*) FROM listings WHERE seller_id = ? AND status IN ('ACTIVE','PAUSED','HIDDEN_BY_AI')")
                .param(u.getId()).query(Integer.class).single();
        long qualified = referrals.countByInviterIdAndQualifiedTrue(u.getId());
        int slots = jdbc.sql("SELECT count(*) FROM purchased_slots WHERE user_id = ? AND expires_at > now()")
                .param(u.getId()).query(Integer.class).single();
        return new Quota(active, limitFor(u, qualified) + slots, qualified, REFERRALS_NEEDED,
                u.getCreatedAt().plus(Duration.ofDays(365)));
    }

    public int limitFor(User u, long qualifiedReferrals) {
        return switch (u.effectivePlan()) {
            case PRO -> PRO_LIMIT;
            case PLUS -> PLUS_LIMIT;
            case FREE -> qualifiedReferrals >= REFERRALS_NEEDED ? FREE_REFERRAL_LIMIT : FREE_LIMIT;
        };
    }

    public boolean canPublish(User u) {
        Quota q = quotaFor(u);
        return q.active() < q.limit();
    }

    public void markReferralQualified(UUID inviteeId) {
        referrals.findById(inviteeId).ifPresent(r -> {
            if (!r.isQualified()) {
                r.setQualified(true);
                referrals.save(r);
            }
        });
    }
}
