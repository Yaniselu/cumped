package com.velosyntech.cumped.notification.push;

import org.junit.jupiter.api.Test;

import java.nio.charset.StandardCharsets;
import java.security.KeyPair;
import java.security.Signature;
import java.time.Instant;

import static org.assertj.core.api.Assertions.assertThat;

/** Criptarea Web Push verificată pe exemplul oficial din standard (RFC 8291, secțiunea 5) și semnătura VAPID (RFC 8292). */
class WebPushCryptoTest {
    @Test
    void matchesTheRfc8291ExampleByteForByte() {
        byte[] plaintext = "When I grow up, I want to be a watermelon".getBytes(StandardCharsets.US_ASCII);
        byte[] asPrivate = WebPushCrypto.unb64("yfWPiYE-n46HLnH0KqZOF1fJJU3MYrct3AELtAQ-oRw");
        byte[] asPublic = WebPushCrypto.unb64("BP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27mlmlMoZIIgDll6e3vCYLocInmYWAmS6TlzAC8wEqKK6PBru3jl7A8");
        byte[] uaPublic = WebPushCrypto.unb64("BCVxsr7N_eNgVRqvHtD0zTZsEc6-VV-JvLexhqUzORcxaOzi6-AYWXvTBHm4bjyPjs7Vd8pZGH6SRpkNtoIAiw4");
        byte[] auth = WebPushCrypto.unb64("BTBZMqHH6r4Tts7J_aSIgg");
        byte[] salt = WebPushCrypto.unb64("DGv6ra1nlYgDCS1FRnbzlw");
        KeyPair as = new KeyPair(WebPushCrypto.publicKey(asPublic), WebPushCrypto.privateKey(asPrivate));
        byte[] body = WebPushCrypto.encrypt(plaintext, uaPublic, auth, as, salt);
        assertThat(WebPushCrypto.b64(body)).isEqualTo("DGv6ra1nlYgDCS1FRnbzlwAAEABBBP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27mlmlMoZIIgDll6e3vCYLocInmYWAmS6TlzAC8wEqKK6PBru3jl7A_yl95bQpu6cVPTpK4Mqgkf1CXztLVBSt2Ks3oZwbuwXPXLWyouBWLVWGNWQexSgSxsj_Qulcy4a-fN");
        // și invers: „browserul” (cheia privată din exemplu) îl decriptează
        byte[] uaPrivate = WebPushCrypto.unb64("q1dXpw3UpT5VOmu_cf_v6ih07Aems3njxI-JWgLcM94");
        assertThat(roundTrip(body, uaPrivate, uaPublic, auth)).isEqualTo("When I grow up, I want to be a watermelon");
    }

    @Test
    void everyMessageUsesFreshKeysAndSalt() {
        WebPushTestSupport.Browser b = WebPushTestSupport.browser();
        byte[] m = "{\"body\":\"salut\"}".getBytes(StandardCharsets.UTF_8);
        byte[] one = WebPushCrypto.encrypt(m, b.publicRaw(), b.authSecret()), two = WebPushCrypto.encrypt(m, b.publicRaw(), b.authSecret());
        assertThat(WebPushCrypto.b64(one)).isNotEqualTo(WebPushCrypto.b64(two));
    }

    @Test
    void vapidTokenIsSignedForThePushServiceOrigin() throws Exception {
        KeyPair kp = WebPushCrypto.generateKeyPair();
        byte[] pub = WebPushCrypto.rawPublic((java.security.interfaces.ECPublicKey) kp.getPublic());
        String h = WebPushCrypto.vapidAuthorization("https://fcm.googleapis.com/fcm/send/abc", "mailto:contact@velosyntech.com",
                (java.security.interfaces.ECPrivateKey) kp.getPrivate(), pub, Instant.now().getEpochSecond());
        assertThat(WebPushTestSupport.vapidValid(h, WebPushCrypto.b64(pub))).isTrue();
        String claims = new String(WebPushCrypto.unb64(h.substring(8, h.indexOf(',')).split("\\.")[1]), StandardCharsets.UTF_8);
        assertThat(claims).contains("\"aud\":\"https://fcm.googleapis.com\"").contains("\"sub\":\"mailto:contact@velosyntech.com\"");
        // semnătura altei chei nu trece
        byte[] other = WebPushCrypto.rawPublic((java.security.interfaces.ECPublicKey) WebPushCrypto.generateKeyPair().getPublic());
        assertThat(WebPushTestSupport.vapidValid(h, WebPushCrypto.b64(other))).isFalse();
    }

    private static String roundTrip(byte[] body, byte[] uaPrivate, byte[] uaPublic, byte[] auth) {
        try {
            return new String(WebPushCrypto.decryptForTest(body, WebPushCrypto.privateKey(uaPrivate), uaPublic, auth), StandardCharsets.UTF_8);
        } catch (Exception e) { throw new IllegalStateException(e); }
    }
}
