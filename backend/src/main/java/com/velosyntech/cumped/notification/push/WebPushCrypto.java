package com.velosyntech.cumped.notification.push;

import javax.crypto.Cipher;
import javax.crypto.KeyAgreement;
import javax.crypto.Mac;
import javax.crypto.spec.GCMParameterSpec;
import javax.crypto.spec.SecretKeySpec;
import java.math.BigInteger;
import java.nio.ByteBuffer;
import java.nio.charset.StandardCharsets;
import java.security.AlgorithmParameters;
import java.security.KeyFactory;
import java.security.KeyPair;
import java.security.KeyPairGenerator;
import java.security.PrivateKey;
import java.security.SecureRandom;
import java.security.Signature;
import java.security.interfaces.ECPrivateKey;
import java.security.interfaces.ECPublicKey;
import java.security.spec.ECGenParameterSpec;
import java.security.spec.ECParameterSpec;
import java.security.spec.ECPoint;
import java.security.spec.ECPrivateKeySpec;
import java.security.spec.ECPublicKeySpec;
import java.util.Arrays;
import java.util.Base64;

/**
 * Web Push fără biblioteci externe, doar criptografia din Java:
 *  - criptarea mesajului pentru browser (RFC 8291, „aes128gcm”): serviciul de push (Google, Mozilla, Apple)
 *    transportă mesajul, dar nu îl poate citi;
 *  - semnătura VAPID (RFC 8292, ES256): serviciul de push știe că mesajul vine de la serverul Cumped.
 */
public final class WebPushCrypto {
    private static final SecureRandom RANDOM = new SecureRandom();
    private static final ECParameterSpec P256 = p256();
    static final int RECORD_SIZE = 4096;

    private WebPushCrypto() {}

    public static KeyPair generateKeyPair() {
        try {
            KeyPairGenerator g = KeyPairGenerator.getInstance("EC");
            g.initialize(new ECGenParameterSpec("secp256r1"), RANDOM);
            return g.generateKeyPair();
        } catch (Exception e) { throw new IllegalStateException(e); }
    }

    /** Cheia publică necomprimată (65 de octeți: 0x04 || X || Y). */
    public static byte[] rawPublic(ECPublicKey k) {
        byte[] out = new byte[65];
        out[0] = 4;
        copy32(k.getW().getAffineX(), out, 1);
        copy32(k.getW().getAffineY(), out, 33);
        return out;
    }

    public static byte[] rawPrivate(ECPrivateKey k) {
        byte[] out = new byte[32];
        copy32(k.getS(), out, 0);
        return out;
    }

    public static ECPublicKey publicKey(byte[] raw) {
        if (raw.length != 65 || raw[0] != 4) throw new IllegalArgumentException("cheie publică invalidă");
        try {
            ECPoint w = new ECPoint(new BigInteger(1, Arrays.copyOfRange(raw, 1, 33)), new BigInteger(1, Arrays.copyOfRange(raw, 33, 65)));
            return (ECPublicKey) KeyFactory.getInstance("EC").generatePublic(new ECPublicKeySpec(w, P256));
        } catch (Exception e) { throw new IllegalArgumentException("cheie publică invalidă", e); }
    }

    public static ECPrivateKey privateKey(byte[] raw) {
        try {
            return (ECPrivateKey) KeyFactory.getInstance("EC").generatePrivate(new ECPrivateKeySpec(new BigInteger(1, raw), P256));
        } catch (Exception e) { throw new IllegalArgumentException("cheie privată invalidă", e); }
    }

    /**
     * Criptează mesajul pentru un abonament (RFC 8291). {@code uaPublic} = cheia p256dh a browserului,
     * {@code authSecret} = secretul „auth” (16 octeți). Întoarce corpul cererii HTTP (antet + date criptate).
     */
    public static byte[] encrypt(byte[] payload, byte[] uaPublic, byte[] authSecret) {
        return encrypt(payload, uaPublic, authSecret, generateKeyPair(), randomBytes(16));
    }

    static byte[] encrypt(byte[] payload, byte[] uaPublic, byte[] authSecret, KeyPair asKeys, byte[] salt) {
        if (payload.length > RECORD_SIZE - 17 - 86) throw new IllegalArgumentException("mesaj prea lung");
        try {
            byte[] asPublic = rawPublic((ECPublicKey) asKeys.getPublic());
            KeyAgreement ka = KeyAgreement.getInstance("ECDH");
            ka.init(asKeys.getPrivate());
            ka.doPhase(publicKey(uaPublic), true);
            byte[] ecdhSecret = ka.generateSecret();

            byte[] prkKey = hmac(authSecret, ecdhSecret);
            byte[] keyInfo = concat("WebPush: info".getBytes(StandardCharsets.US_ASCII), new byte[] {0}, uaPublic, asPublic);
            byte[] ikm = hkdfExpand(prkKey, keyInfo, 32);
            byte[] prk = hmac(salt, ikm);
            byte[] cek = hkdfExpand(prk, concat("Content-Encoding: aes128gcm".getBytes(StandardCharsets.US_ASCII), new byte[] {0}), 16);
            byte[] nonce = hkdfExpand(prk, concat("Content-Encoding: nonce".getBytes(StandardCharsets.US_ASCII), new byte[] {0}), 12);

            Cipher c = Cipher.getInstance("AES/GCM/NoPadding");
            c.init(Cipher.ENCRYPT_MODE, new SecretKeySpec(cek, "AES"), new GCMParameterSpec(128, nonce));
            byte[] ct = c.doFinal(concat(payload, new byte[] {2})); // 0x02 = ultimul record

            ByteBuffer header = ByteBuffer.allocate(16 + 4 + 1 + asPublic.length);
            header.put(salt).putInt(RECORD_SIZE).put((byte) asPublic.length).put(asPublic);
            return concat(header.array(), ct);
        } catch (IllegalArgumentException e) {
            throw e;
        } catch (Exception e) {
            throw new IllegalStateException("criptare web push", e);
        }
    }

    /** Antetul Authorization pentru VAPID: „vapid t=JWT, k=cheia publică”. */
    public static String vapidAuthorization(String endpoint, String subject, ECPrivateKey key, byte[] publicRaw, long nowEpochSeconds) {
        try {
            java.net.URI u = java.net.URI.create(endpoint);
            String aud = u.getScheme() + "://" + u.getHost() + (u.getPort() > 0 ? ":" + u.getPort() : "");
            String header = b64("{\"typ\":\"JWT\",\"alg\":\"ES256\"}".getBytes(StandardCharsets.UTF_8));
            String claims = b64(("{\"aud\":\"" + aud + "\",\"exp\":" + (nowEpochSeconds + 12 * 3600) + ",\"sub\":\"" + subject + "\"}")
                    .getBytes(StandardCharsets.UTF_8));
            Signature s = Signature.getInstance("SHA256withECDSAinP1363Format");
            s.initSign(key);
            s.update((header + "." + claims).getBytes(StandardCharsets.US_ASCII));
            return "vapid t=" + header + "." + claims + "." + b64(s.sign()) + ", k=" + b64(publicRaw);
        } catch (Exception e) { throw new IllegalStateException("semnătură VAPID", e); }
    }

    // ---------------- utilitare ----------------

    static byte[] hmac(byte[] key, byte[] data) {
        try {
            Mac m = Mac.getInstance("HmacSHA256");
            m.init(new SecretKeySpec(key, "HmacSHA256"));
            return m.doFinal(data);
        } catch (Exception e) { throw new IllegalStateException(e); }
    }

    /** HKDF-Expand pentru o lungime ≤ 32 (un singur bloc). */
    static byte[] hkdfExpand(byte[] prk, byte[] info, int len) {
        return Arrays.copyOf(hmac(prk, concat(info, new byte[] {1})), len);
    }

    static byte[] concat(byte[]... parts) {
        int n = 0;
        for (byte[] p : parts) n += p.length;
        byte[] out = new byte[n];
        int i = 0;
        for (byte[] p : parts) { System.arraycopy(p, 0, out, i, p.length); i += p.length; }
        return out;
    }

    public static String b64(byte[] b) { return Base64.getUrlEncoder().withoutPadding().encodeToString(b); }

    public static byte[] unb64(String s) { return Base64.getUrlDecoder().decode(s.trim().replace('+', '-').replace('/', '_').replace("=", "")); }

    static byte[] randomBytes(int n) { byte[] b = new byte[n]; RANDOM.nextBytes(b); return b; }

    private static void copy32(BigInteger v, byte[] out, int off) {
        byte[] b = v.toByteArray();
        int len = Math.min(b.length, 32);
        System.arraycopy(b, b.length - len, out, off + 32 - len, len);
    }

    private static ECParameterSpec p256() {
        try {
            AlgorithmParameters p = AlgorithmParameters.getInstance("EC");
            p.init(new ECGenParameterSpec("secp256r1"));
            return p.getParameterSpec(ECParameterSpec.class);
        } catch (Exception e) { throw new IllegalStateException(e); }
    }

    /** Doar pentru teste: decriptează ca un browser (verifică implementarea cap-coadă). */
    static byte[] decryptForTest(byte[] body, PrivateKey uaPrivate, byte[] uaPublic, byte[] authSecret) throws Exception {
        ByteBuffer bb = ByteBuffer.wrap(body);
        byte[] salt = new byte[16];
        bb.get(salt);
        bb.getInt();
        byte[] asPublic = new byte[bb.get() & 0xff];
        bb.get(asPublic);
        byte[] ct = new byte[bb.remaining()];
        bb.get(ct);
        KeyAgreement ka = KeyAgreement.getInstance("ECDH");
        ka.init(uaPrivate);
        ka.doPhase(publicKey(asPublic), true);
        byte[] prkKey = hmac(authSecret, ka.generateSecret());
        byte[] ikm = hkdfExpand(prkKey, concat("WebPush: info".getBytes(StandardCharsets.US_ASCII), new byte[] {0}, uaPublic, asPublic), 32);
        byte[] prk = hmac(salt, ikm);
        byte[] cek = hkdfExpand(prk, concat("Content-Encoding: aes128gcm".getBytes(StandardCharsets.US_ASCII), new byte[] {0}), 16);
        byte[] nonce = hkdfExpand(prk, concat("Content-Encoding: nonce".getBytes(StandardCharsets.US_ASCII), new byte[] {0}), 12);
        Cipher c = Cipher.getInstance("AES/GCM/NoPadding");
        c.init(Cipher.DECRYPT_MODE, new SecretKeySpec(cek, "AES"), new GCMParameterSpec(128, nonce));
        byte[] plain = c.doFinal(ct);
        int end = plain.length - 1;
        while (end >= 0 && plain[end] == 0) end--;
        if (plain[end] != 2) throw new IllegalStateException("delimitator lipsă");
        return Arrays.copyOf(plain, end);
    }
}
