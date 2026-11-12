package com.velosyntech.cumped.media;

import com.velosyntech.cumped.config.AppProperties;
import org.springframework.stereotype.Component;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.Duration;
import java.time.Instant;
import java.util.Base64;
import java.util.UUID;

/**
 * Linkuri semnate (HMAC-SHA256) pentru pozele private (dovezile din dispute).
 * Linkul expiră după 2 ore și nu poate fi ghicit sau modificat.
 */
@Component
public class MediaSigner {
    static final Duration TTL = Duration.ofHours(2);
    private final byte[] key;

    public MediaSigner(AppProperties props) {
        this.key = sha256(("cumped-media-sign:" + props.jwtSecret()).getBytes(StandardCharsets.UTF_8));
    }

    public String url(UUID id) {
        long exp = Instant.now().plus(TTL).getEpochSecond();
        return "/api/media/" + id + "?exp=" + exp + "&sig=" + sign(id, exp);
    }

    public boolean valid(UUID id, Long exp, String sig) {
        if (exp == null || sig == null || exp < Instant.now().getEpochSecond()) return false;
        return MessageDigest.isEqual(sign(id, exp).getBytes(StandardCharsets.US_ASCII), sig.getBytes(StandardCharsets.US_ASCII));
    }

    private String sign(UUID id, long exp) {
        try {
            Mac mac = Mac.getInstance("HmacSHA256");
            mac.init(new SecretKeySpec(key, "HmacSHA256"));
            byte[] out = mac.doFinal((id + ":" + exp).getBytes(StandardCharsets.UTF_8));
            return Base64.getUrlEncoder().withoutPadding().encodeToString(out);
        } catch (Exception e) {
            throw new IllegalStateException(e);
        }
    }

    private static byte[] sha256(byte[] b) {
        try { return MessageDigest.getInstance("SHA-256").digest(b); } catch (Exception e) { throw new IllegalStateException(e); }
    }
}
