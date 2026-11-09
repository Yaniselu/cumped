package com.velosyntech.cumped.auth;

import com.velosyntech.cumped.common.ApiException;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.sql.Timestamp;
import java.time.Duration;
import java.time.Instant;
import java.util.HexFormat;

/**
 * Limitarea încercărilor de login, pe două chei:
 *  - pe email: 5 parole greșite în 15 minute → pauză 15 min; la repetare pauza se dublează (max. 24 h);
 *  - pe IP: 20 de eșecuri pe oră (indiferent de cont) → pauză 1 h, contra „credential stuffing”.
 * Se aplică identic și pentru emailuri care nu au cont, deci răspunsul nu dezvăluie ce conturi există.
 * Starea e în Postgres (nu în memorie): rezistă la reporniri și e comună tuturor instanțelor.
 */
@Component
public class LoginThrottle {
    static final int EMAIL_MAX = 5;
    static final Duration EMAIL_WINDOW = Duration.ofMinutes(15);
    static final Duration EMAIL_LOCK = Duration.ofMinutes(15);
    static final Duration EMAIL_LOCK_MAX = Duration.ofHours(24);
    static final int IP_MAX = 20;
    static final Duration IP_WINDOW = Duration.ofHours(1);
    static final Duration IP_LOCK = Duration.ofHours(1);

    private final JdbcClient jdbc;

    public LoginThrottle(JdbcClient jdbc) { this.jdbc = jdbc; }

    /** Aruncă 429 LOGIN_THROTTLED (cu Retry-After) dacă emailul sau IP-ul sunt în pauză. */
    public void check(String email, String ip) {
        Instant now = Instant.now();
        long wait = Math.max(remaining(emailKey(email), now), ip == null ? 0 : remaining(ipKey(ip), now));
        if (wait > 0) throw ApiException.tooManyRequests("LOGIN_THROTTLED", wait);
    }

    /** Înregistrează o parolă greșită; întoarce pauza aplicată acum (secunde) sau 0. */
    public long fail(String email, String ip) {
        long a = bump(emailKey(email), EMAIL_MAX, EMAIL_WINDOW, EMAIL_LOCK, true);
        long b = ip == null ? 0 : bump(ipKey(ip), IP_MAX, IP_WINDOW, IP_LOCK, false);
        return Math.max(a, b);
    }

    /** Login reușit: emailul pornește de la zero (IP-ul nu, ca să nu poată fi „spălat” cu un cont propriu). */
    public void success(String email) {
        jdbc.sql("DELETE FROM login_throttle WHERE k = ?").param(emailKey(email)).update();
    }

    private long remaining(String key, Instant now) {
        return jdbc.sql("SELECT locked_until FROM login_throttle WHERE k = ?").param(key).query(Timestamp.class).optional()
                .filter(t -> t != null && t.toInstant().isAfter(now))
                .map(t -> Duration.between(now, t.toInstant()).toSeconds() + 1).orElse(0L);
    }

    private long bump(String key, int max, Duration window, Duration baseLock, boolean progressive) {
        Instant now = Instant.now();
        // fereastra expirată → numărătoarea repornește; altfel +1
        jdbc.sql("""
                INSERT INTO login_throttle(k, failures, window_start, updated_at) VALUES (:k, 1, :now, :now)
                ON CONFLICT (k) DO UPDATE SET
                  failures = CASE WHEN login_throttle.window_start < :cutoff THEN 1 ELSE login_throttle.failures + 1 END,
                  window_start = CASE WHEN login_throttle.window_start < :cutoff THEN :now ELSE login_throttle.window_start END,
                  updated_at = :now""")
                .param("k", key).param("now", Timestamp.from(now)).param("cutoff", Timestamp.from(now.minus(window))).update();
        int failures = jdbc.sql("SELECT failures FROM login_throttle WHERE k = ?").param(key).query(Integer.class).single();
        if (failures < max) return 0;
        int locks = jdbc.sql("SELECT lock_count FROM login_throttle WHERE k = ?").param(key).query(Integer.class).single();
        Duration lock = progressive ? baseLock.multipliedBy(1L << Math.min(locks, 6)) : baseLock;
        if (lock.compareTo(EMAIL_LOCK_MAX) > 0) lock = EMAIL_LOCK_MAX;
        jdbc.sql("UPDATE login_throttle SET locked_until = ?, failures = 0, window_start = ?, lock_count = lock_count + 1 WHERE k = ?")
                .params(Timestamp.from(now.plus(lock)), Timestamp.from(now), key).update();
        return lock.toSeconds();
    }

    /** Curățenie: rândurile vechi (fără pauză activă) nu mai sunt utile. */
    @Scheduled(fixedDelay = 3_600_000, initialDelay = 600_000)
    public void cleanup() {
        jdbc.sql("DELETE FROM login_throttle WHERE updated_at < now() - interval '2 days' AND (locked_until IS NULL OR locked_until < now())").update();
    }

    private static String emailKey(String email) { return "e:" + sha256(email == null ? "" : email.trim().toLowerCase()); }
    private static String ipKey(String ip) { return "i:" + sha256(ip); }

    private static String sha256(String s) {
        try {
            return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(s.getBytes(StandardCharsets.UTF_8))).substring(0, 64);
        } catch (NoSuchAlgorithmException e) { throw new IllegalStateException(e); }
    }
}
