package com.velosyntech.cumped.user;

import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Service;

import java.sql.Timestamp;
import java.time.Duration;
import java.time.Instant;
import java.util.UUID;

/**
 * Semnale de încredere pentru vânzător, calculate din activitatea reală (nu declarate de el):
 * cât de repede răspunde, cât de des răspunde, câte vânzări a finalizat și cât de recent a fost activ.
 * Activitatea e arătată doar pe intervale (azi / săptămâna asta / luna asta), nu ora exactă.
 */
@Service
public class SellerStatsService {
    public record Stats(Integer responseMinutes, Integer responseRate, String lastActive, int completedSales) {}

    private final JdbcClient jdbc;

    public SellerStatsService(JdbcClient jdbc) { this.jdbc = jdbc; }

    public Stats of(UUID userId) {
        record Resp(Double median, long asked, long answered) {}
        Resp r = jdbc.sql("""
                WITH firsts AS (
                  SELECT c.id,
                    (SELECT min(m.created_at) FROM messages m WHERE m.conversation_id = c.id AND m.sender_id = c.buyer_id AND m.body NOT LIKE '[[%') AS asked_at,
                    c.seller_id
                  FROM conversations c WHERE c.seller_id = :u AND c.created_at > now() - interval '180 days'),
                replies AS (
                  SELECT f.id, f.asked_at,
                    (SELECT min(m.created_at) FROM messages m WHERE m.conversation_id = f.id AND m.sender_id = f.seller_id
                       AND m.created_at > f.asked_at AND m.body NOT LIKE '[[%') AS replied_at
                  FROM firsts f WHERE f.asked_at IS NOT NULL)
                SELECT percentile_cont(0.5) WITHIN GROUP (ORDER BY extract(epoch FROM (replied_at - asked_at)) / 60)
                         FILTER (WHERE replied_at IS NOT NULL),
                       count(*), count(replied_at)
                FROM replies""")
                .param("u", userId).query((rs, i) -> new Resp(rs.getObject(1) == null ? null : rs.getDouble(1), rs.getLong(2), rs.getLong(3))).single();
        // Sub 3 conversații statistica nu spune nimic: nu o afișăm.
        Integer minutes = r.asked() >= 3 && r.median() != null ? (int) Math.max(1, Math.round(r.median())) : null;
        Integer rate = r.asked() >= 3 ? (int) Math.round(100.0 * r.answered() / r.asked()) : null;

        Timestamp last = jdbc.sql("""
                SELECT greatest(
                  (SELECT max(created_at) FROM refresh_tokens WHERE user_id = :u),
                  (SELECT max(created_at) FROM messages WHERE sender_id = :u),
                  (SELECT max(updated_at) FROM listings WHERE seller_id = :u))""")
                .param("u", userId).query(Timestamp.class).optional().orElse(null);
        String active = "OLDER";
        if (last != null) {
            Duration ago = Duration.between(last.toInstant(), Instant.now());
            active = ago.toHours() < 24 ? "TODAY" : ago.toDays() < 7 ? "WEEK" : ago.toDays() < 30 ? "MONTH" : "OLDER";
        }
        int sales = jdbc.sql("""
                SELECT (SELECT count(*) FROM orders WHERE seller_id = :u AND status = 'COMPLETED')
                     + (SELECT count(*) FROM listings WHERE seller_id = :u AND status = 'SOLD' AND id NOT IN (SELECT listing_id FROM orders WHERE seller_id = :u))""")
                .param("u", userId).query(Integer.class).single();
        return new Stats(minutes, rate, active, sales);
    }
}
