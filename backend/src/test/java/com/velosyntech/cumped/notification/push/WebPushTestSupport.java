package com.velosyntech.cumped.notification.push;

import java.nio.charset.StandardCharsets;
import java.security.KeyPair;
import java.security.Signature;
import java.security.interfaces.ECPublicKey;

/** Simulează un browser abonat la alerte: cheile lui și decriptarea mesajelor (pentru teste). */
public final class WebPushTestSupport {
    public record Browser(KeyPair keys, byte[] publicRaw, byte[] authSecret) {
        public String p256dh() { return WebPushCrypto.b64(publicRaw); }
        public String auth() { return WebPushCrypto.b64(authSecret); }
    }

    private WebPushTestSupport() {}

    public static Browser browser() {
        KeyPair kp = WebPushCrypto.generateKeyPair();
        return new Browser(kp, WebPushCrypto.rawPublic((ECPublicKey) kp.getPublic()), WebPushCrypto.randomBytes(16));
    }

    public static String decrypt(byte[] body, Browser b) throws Exception {
        return new String(WebPushCrypto.decryptForTest(body, b.keys().getPrivate(), b.publicRaw(), b.authSecret()), StandardCharsets.UTF_8);
    }

    /** Verifică semnătura ES256 din antetul „vapid t=…, k=…” cu cheia publică a serverului. */
    public static boolean vapidValid(String header, String publicKeyB64) throws Exception {
        String t = header.substring("vapid t=".length(), header.indexOf(','));
        String k = header.substring(header.indexOf("k=") + 2).trim();
        if (!k.equals(publicKeyB64)) return false;
        String[] parts = t.split("\\.");
        Signature s = Signature.getInstance("SHA256withECDSAinP1363Format");
        s.initVerify(WebPushCrypto.publicKey(WebPushCrypto.unb64(k)));
        s.update((parts[0] + "." + parts[1]).getBytes(StandardCharsets.US_ASCII));
        return s.verify(WebPushCrypto.unb64(parts[2]));
    }
}
