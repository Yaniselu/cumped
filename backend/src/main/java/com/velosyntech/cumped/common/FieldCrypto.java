package com.velosyntech.cumped.common;

import com.velosyntech.cumped.config.AppProperties;
import jakarta.annotation.PostConstruct;
import org.springframework.stereotype.Component;

import javax.crypto.Cipher;
import javax.crypto.spec.GCMParameterSpec;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.util.Base64;

/**
 * Criptare la nivel de câmp (AES-256-GCM) pentru datele cele mai sensibile: numele de pe act și adresele de livrare.
 * Cheia vine din DATA_ENCRYPTION_KEY (32 de octeți, base64). Fără ea, în producție aplicația nu pornește.
 * Formatul stocat: "enc:v1:" + base64(iv[12] || ciphertext || tag[16]). Valorile vechi necriptate se citesc în continuare.
 */
@Component
public class FieldCrypto {
    private static final String PREFIX = "enc:v1:";
    private static final SecureRandom RANDOM = new SecureRandom();
    private static volatile SecretKeySpec key;

    private final AppProperties props;

    public FieldCrypto(AppProperties props) { this.props = props; }

    @PostConstruct
    void init() {
        String b64 = props.dataEncryptionKey();
        byte[] raw;
        if (b64 == null || b64.isBlank()) {
            if (!props.devMode()) throw new IllegalStateException("DATA_ENCRYPTION_KEY lipsește (32 de octeți în base64, ex. `openssl rand -base64 32`).");
            raw = sha256("cumped-dev-only-key:" + props.jwtSecret()); // doar pentru dezvoltare locală
        } else {
            raw = Base64.getDecoder().decode(b64.trim());
            if (raw.length != 32) throw new IllegalStateException("DATA_ENCRYPTION_KEY trebuie să aibă exact 32 de octeți.");
        }
        key = new SecretKeySpec(raw, "AES");
    }

    public static String encrypt(String plain) {
        if (plain == null || plain.isEmpty() || plain.startsWith(PREFIX)) return plain;
        try {
            byte[] iv = new byte[12];
            RANDOM.nextBytes(iv);
            Cipher c = Cipher.getInstance("AES/GCM/NoPadding");
            c.init(Cipher.ENCRYPT_MODE, requireKey(), new GCMParameterSpec(128, iv));
            byte[] ct = c.doFinal(plain.getBytes(StandardCharsets.UTF_8));
            byte[] out = new byte[iv.length + ct.length];
            System.arraycopy(iv, 0, out, 0, iv.length);
            System.arraycopy(ct, 0, out, iv.length, ct.length);
            return PREFIX + Base64.getEncoder().encodeToString(out);
        } catch (Exception e) { throw new IllegalStateException("encrypt", e); }
    }

    public static String decrypt(String stored) {
        if (stored == null || !stored.startsWith(PREFIX)) return stored;
        try {
            byte[] in = Base64.getDecoder().decode(stored.substring(PREFIX.length()));
            Cipher c = Cipher.getInstance("AES/GCM/NoPadding");
            c.init(Cipher.DECRYPT_MODE, requireKey(), new GCMParameterSpec(128, in, 0, 12));
            return new String(c.doFinal(in, 12, in.length - 12), StandardCharsets.UTF_8);
        } catch (Exception e) { throw new IllegalStateException("decrypt", e); }
    }

    private static SecretKeySpec requireKey() {
        if (key == null) throw new IllegalStateException("FieldCrypto neinițializat");
        return key;
    }

    private static byte[] sha256(String s) {
        try { return MessageDigest.getInstance("SHA-256").digest(s.getBytes(StandardCharsets.UTF_8)); }
        catch (Exception e) { throw new IllegalStateException(e); }
    }
}
