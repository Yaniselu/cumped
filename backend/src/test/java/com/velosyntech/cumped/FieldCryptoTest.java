package com.velosyntech.cumped;

import com.velosyntech.cumped.common.FieldCrypto;
import com.velosyntech.cumped.config.AppProperties;
import com.velosyntech.cumped.config.ProductionChecks;
import org.junit.jupiter.api.Test;
import org.springframework.mock.env.MockEnvironment;

import java.lang.reflect.Method;
import java.time.Duration;
import java.util.Base64;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/** Criptarea câmpurilor sensibile și refuzul de a porni în producție cu setări nesigure. */
class FieldCryptoTest {

    static AppProperties props(boolean dev, boolean cookieSecure, String cors, String publicUrl, boolean demo, String encKey) {
        return new AppProperties("x".repeat(48), Duration.ofMinutes(15), Duration.ofDays(30), cors, cookieSecure, "build/u",
                "s@x.ro", "n@x.ro", publicUrl, null, "m", null, null, null, null, dev, demo, false,
                "Firma", "Adresa", "J1", "RO1", "c@x.ro", "d@x.ro", encKey, null, null);
    }

    private static void init(AppProperties p) throws Exception {
        FieldCrypto fc = new FieldCrypto(p);
        Method m = FieldCrypto.class.getDeclaredMethod("init");
        m.setAccessible(true);
        m.invoke(fc);
    }

    private static String key() { return Base64.getEncoder().encodeToString(new byte[32]); }

    @Test
    void roundTripWithRandomIv() throws Exception {
        init(props(false, true, "https://cumped.com", "https://cumped.com", false, key()));
        String a = FieldCrypto.encrypt("Str. Lalelelor 10"), b = FieldCrypto.encrypt("Str. Lalelelor 10");
        assertThat(a).startsWith("enc:v1:").isNotEqualTo(b).doesNotContain("Lalelelor");
        assertThat(FieldCrypto.decrypt(a)).isEqualTo("Str. Lalelelor 10");
        assertThat(FieldCrypto.decrypt(b)).isEqualTo("Str. Lalelelor 10");
        assertThat(FieldCrypto.encrypt(null)).isNull();
    }

    @Test
    void tamperedCiphertextIsDetected() throws Exception {
        init(props(false, true, "https://cumped.com", "https://cumped.com", false, key()));
        String enc = FieldCrypto.encrypt("0712345678");
        byte[] raw = Base64.getDecoder().decode(enc.substring("enc:v1:".length()));
        raw[raw.length - 1] ^= 1;
        String tampered = "enc:v1:" + Base64.getEncoder().encodeToString(raw);
        assertThatThrownBy(() -> FieldCrypto.decrypt(tampered)).isInstanceOf(IllegalStateException.class);
    }

    @Test
    void inputThatLooksEncryptedIsStillEncrypted() throws Exception {
        init(props(false, true, "https://cumped.com", "https://cumped.com", false, key()));
        String sneaky = "enc:v1:AAAA";
        String stored = FieldCrypto.encrypt(sneaky);
        assertThat(stored).isNotEqualTo(sneaky);
        assertThat(FieldCrypto.decrypt(stored)).isEqualTo(sneaky);
    }

    @Test
    void productionRefusesToStartWithoutEncryptionKey() {
        assertThatThrownBy(() -> init(props(false, true, "https://cumped.com", "https://cumped.com", false, "")))
                .hasRootCauseInstanceOf(IllegalStateException.class);
        assertThatThrownBy(() -> init(props(false, true, "https://cumped.com", "https://cumped.com", false,
                Base64.getEncoder().encodeToString(new byte[16])))).hasRootCauseInstanceOf(IllegalStateException.class);
    }

    private static void check(AppProperties p, String dbPass) throws Exception {
        ProductionChecks c = new ProductionChecks(p, new MockEnvironment().withProperty("spring.datasource.password", dbPass));
        Method m = ProductionChecks.class.getDeclaredMethod("verify");
        m.setAccessible(true);
        m.invoke(c);
    }

    @Test
    void forceHttps_productionRefusesInsecureSettings() throws Exception {
        String strong = "o-parola-foarte-lunga-2026";
        check(props(false, true, "https://cumped.com", "https://cumped.com", false, key()), strong); // ok
        assertThatThrownBy(() -> check(props(false, false, "https://cumped.com", "https://cumped.com", false, key()), strong))
                .hasRootCauseMessage("COOKIE_SECURE trebuie să fie true în producție (cookie doar prin HTTPS).");
        assertThatThrownBy(() -> check(props(false, true, "http://cumped.com", "https://cumped.com", false, key()), strong))
                .hasRootCauseInstanceOf(IllegalStateException.class);
        assertThatThrownBy(() -> check(props(false, true, "*", "https://cumped.com", false, key()), strong))
                .hasRootCauseInstanceOf(IllegalStateException.class);
        assertThatThrownBy(() -> check(props(false, true, "https://cumped.com", "http://cumped.com", false, key()), strong))
                .hasRootCauseInstanceOf(IllegalStateException.class);
        assertThatThrownBy(() -> check(props(false, true, "https://cumped.com", "https://cumped.com", true, key()), strong))
                .hasRootCauseInstanceOf(IllegalStateException.class);
        assertThatThrownBy(() -> check(props(false, true, "https://cumped.com", "https://cumped.com", false, key()), "cumped"))
                .hasRootCauseInstanceOf(IllegalStateException.class);
        // în dezvoltare se poate porni local fără HTTPS
        check(props(true, false, "http://localhost:8100", "http://localhost:8100", true, ""), "cumped");
    }
}
