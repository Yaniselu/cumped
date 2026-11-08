package com.velosyntech.cumped;

import com.velosyntech.cumped.velo.ScamDetector;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class ScamDetectorTest {
    private final ScamDetector d = new ScamDetector();

    @Test
    void blocksValidCardNumbersButNotRandomDigits() {
        assertThat(d.analyze("cardul 4111 1111 1111 1111").level()).isEqualTo(ScamDetector.Level.BLOCK);
        assertThat(d.analyze("comanda 1234 5678 9012 3456").reasons()).doesNotContain("CARD_NUMBER");
    }

    @Test
    void blocksCardDataRequestsInSeveralLanguages() {
        assertThat(d.analyze("Trimite-mi codul CVV de pe spatele cardului").blocked()).isTrue();
        assertThat(d.analyze("Please send me your card number").blocked()).isTrue();
        assertThat(d.analyze("Schick mir die Kartendaten").blocked()).isTrue();
    }

    @Test
    void hidesLinksAndWarnsAboutOffPlatformChat() {
        ScamDetector.Result r = d.analyze("scrie-mi pe WhatsApp sau intră pe bit.ly/abc");
        assertThat(r.level()).isEqualTo(ScamDetector.Level.WARN);
        assertThat(r.reasons()).contains("LINK", "OFF_PLATFORM_CHAT");
        assertThat(r.sanitized()).doesNotContain("bit.ly");
    }

    @Test
    void paymentLinkIsBlocked() {
        assertThat(d.analyze("ca să primești banii completează datele pe https://curier-livrare.top/plata").blocked()).isTrue();
    }

    @Test
    void normalMessagesPass() {
        ScamDetector.Result r = d.analyze("Bună! Mai e disponibil? Pot veni mâine la 18:00.");
        assertThat(r.level()).isEqualTo(ScamDetector.Level.NONE);
        assertThat(r.flagged()).isFalse();
    }
}
