package com.velosyntech.cumped.user;

import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.time.Instant;
import java.util.UUID;

/**
 * Câte anunțuri active poate avea un utilizator:
 *  - FREE: 2 active în același timp; 5 (pentru totdeauna) după primii 10 prieteni invitați care și-au verificat identitatea.
 *  - PLUS: 15, PRO/Business: 100.
 *  - plus locurile temporare: cumpărate (30 de zile) sau câștigate din invitații.
 *
 * Programul de invitații: la fiecare 10 prieteni cu identitatea verificată (sau conturi 16–17 ani aprobate de un părinte
 * verificat), invitatorul primește +1 anunț activ timp de 30 de zile și o promovare gratuită de 7 zile.
 * Prietenul invitat primește o „ridicare” gratuită când își verifică contul.
 * Doar verificarea identității contează (o persoană = un act), ca recompensele să nu poată fi obținute cu conturi false.
 */
@Service
public class QuotaService {
    public static final int FREE_LIMIT = 2;
    public static final int FREE_REFERRAL_LIMIT = 5;
    public static final int REFERRALS_NEEDED = 10;
    public static final int PLUS_LIMIT = 15;
    public static final int PRO_LIMIT = 100;
    public static final int REWARD_SLOT_DAYS = 30;
    public static final int CREDIT_DAYS = 90;

    public record Quota(int active, int limit, long qualifiedReferrals, int referralsNeeded, Instant freeYearEndsAt) {}

    private final JdbcClient jdbc;
    private final ReferralRepository referrals;
    private final com.velosyntech.cumped.notification.NotificationService notifications;

    public QuotaService(JdbcClient jdbc, ReferralRepository referrals, com.velosyntech.cumped.notification.NotificationService notifications) {
        this.jdbc = jdbc;
        this.referrals = referrals;
        this.notifications = notifications;
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
            if (r.isQualified()) return;
            r.setQualified(true);
            if (!r.isInviteeRewarded()) {
                r.setInviteeRewarded(true);
                grantCredit(inviteeId, "BUMP", "REFERRAL_FRIEND");
                notifications.notify(inviteeId, "REFERRAL_FRIEND_BONUS", java.util.Map.of(), "/my-listings");
            }
            referrals.save(r);
            long n = referrals.countByInviterIdAndQualifiedTrue(r.getInviterId());
            if (n > 0 && n % REFERRALS_NEEDED == 0) reward(r.getInviterId(), (int) n);
        });
    }

    /** O recompensă pe prag (10, 20, 30…); pragul se înregistrează o singură dată, chiar dacă se verifică doi prieteni deodată. */
    private void reward(UUID inviterId, int milestone) {
        int fresh = jdbc.sql("INSERT INTO referral_rewards(id, user_id, milestone) VALUES (?, ?, ?) ON CONFLICT (user_id, milestone) DO NOTHING")
                .params(UUID.randomUUID(), inviterId, milestone).update();
        if (fresh == 0) return;
        jdbc.sql("INSERT INTO purchased_slots(id, user_id, expires_at, source) VALUES (?, ?, ?, 'REFERRAL')")
                .params(UUID.randomUUID(), inviterId, java.sql.Timestamp.from(Instant.now().plus(Duration.ofDays(REWARD_SLOT_DAYS)))).update();
        grantCredit(inviterId, "PROMOTE_7D", "REFERRAL");
        notifications.notify(inviterId, "REFERRAL_REWARD", java.util.Map.of("count", milestone), "/invite");
    }

    public void grantCredit(UUID userId, String product, String source) {
        jdbc.sql("INSERT INTO user_credits(id, user_id, product, source, expires_at) VALUES (?, ?, ?, ?, ?)")
                .params(UUID.randomUUID(), userId, product, source, java.sql.Timestamp.from(Instant.now().plus(Duration.ofDays(CREDIT_DAYS)))).update();
    }

    /** Creditele gratuite încă nefolosite (ex. {PROMOTE_7D: 1, BUMP: 2}). */
    public java.util.Map<String, Integer> credits(UUID userId) {
        java.util.Map<String, Integer> out = new java.util.LinkedHashMap<>();
        jdbc.sql("SELECT product, count(*) FROM user_credits WHERE user_id = ? AND used_at IS NULL AND expires_at > now() GROUP BY product")
                .param(userId).query((rs, i) -> out.put(rs.getString(1), rs.getInt(2))).list();
        return out;
    }

    /** Folosește un credit (cel mai vechi); fals dacă nu există. */
    public boolean useCredit(UUID userId, String product, UUID listingId) {
        return jdbc.sql("""
                UPDATE user_credits SET used_at = now(), listing_id = ? WHERE id = (
                  SELECT id FROM user_credits WHERE user_id = ? AND product = ? AND used_at IS NULL AND expires_at > now()
                  ORDER BY expires_at LIMIT 1 FOR UPDATE SKIP LOCKED)""")
                .params(listingId, userId, product).update() == 1;
    }
}
