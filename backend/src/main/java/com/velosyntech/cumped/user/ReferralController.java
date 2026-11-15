package com.velosyntech.cumped.user;

import com.velosyntech.cumped.common.ApiException;
import com.velosyntech.cumped.common.CurrentUser;
import com.velosyntech.cumped.config.AppProperties;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Pagina „Invită prieteni”: codul și linkul tău, câți prieteni s-au înscris / verificat, cât mai ai până la
 * următoarea recompensă, recompensele câștigate și creditele gratuite nefolosite.
 * Prietenii apar doar cu username-ul public (fără email sau alte date).
 */
@RestController
@RequestMapping("/api/me")
public class ReferralController {
    public record Friend(String username, int avatarHue, boolean verified, Instant joinedAt) {}
    public record Reward(int milestone, Instant at) {}
    public record Overview(String code, String link, long registered, long verified, int perReward, int toNext, int nextMilestone,
                           boolean permanentBonus, int permanentLimit, int rewardSlotDays, int activeRewardSlots,
                           List<Friend> friends, List<Reward> rewards, Map<String, Integer> credits) {}

    private final UserRepository users;
    private final ReferralRepository referrals;
    private final QuotaService quota;
    private final JdbcClient jdbc;
    private final AppProperties props;

    public ReferralController(UserRepository users, ReferralRepository referrals, QuotaService quota, JdbcClient jdbc, AppProperties props) {
        this.users = users;
        this.referrals = referrals;
        this.quota = quota;
        this.jdbc = jdbc;
        this.props = props;
    }

    @GetMapping("/referrals")
    Overview overview() {
        UUID me = CurrentUser.id();
        User u = users.findById(me).orElseThrow(ApiException::notFound);
        long registered = referrals.countByInviterId(me);
        long verified = referrals.countByInviterIdAndQualifiedTrue(me);
        int per = QuotaService.REFERRALS_NEEDED;
        int next = (int) ((verified / per) + 1) * per;
        List<Friend> friends = jdbc.sql("""
                SELECT u.username, u.avatar_hue, r.qualified, r.created_at FROM referrals r JOIN users u ON u.id = r.invitee_id
                WHERE r.inviter_id = ? ORDER BY r.created_at DESC LIMIT 50""")
                .param(me).query((rs, i) -> new Friend(rs.getString(1), rs.getInt(2), rs.getBoolean(3), rs.getTimestamp(4).toInstant())).list();
        List<Reward> rewards = jdbc.sql("SELECT milestone, created_at FROM referral_rewards WHERE user_id = ? ORDER BY milestone")
                .param(me).query((rs, i) -> new Reward(rs.getInt(1), rs.getTimestamp(2).toInstant())).list();
        int slots = jdbc.sql("SELECT count(*) FROM purchased_slots WHERE user_id = ? AND source = 'REFERRAL' AND expires_at > now()")
                .param(me).query(Integer.class).single();
        return new Overview(u.getReferralCode(), props.publicUrl() + "/register?ref=" + u.getReferralCode(), registered, verified, per,
                (int) (next - verified), next, verified >= per, QuotaService.FREE_REFERRAL_LIMIT, QuotaService.REWARD_SLOT_DAYS, slots,
                friends, rewards, quota.credits(me));
    }
}
