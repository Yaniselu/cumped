package com.velosyntech.cumped.velo;

import org.springframework.stereotype.Component;

import java.text.Normalizer;
import java.util.*;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Detector de tentative de fraudă în mesaje și anunțuri, pe reguli (funcționează și fără AI):
 *  - BLOCK: numere de card, cereri de date de card/CVV, linkuri de „plată”/„curier” false;
 *  - WARN: telefon, email, mutarea discuției pe WhatsApp/Telegram, plata în avans, crypto;
 *  - linkurile din chat sunt ascunse automat (principala metodă de phishing pe platformele de anunțuri).
 */
@Component
public class ScamDetector {
    public enum Level { NONE, WARN, BLOCK }

    public record Result(Level level, List<String> reasons, String sanitized, int risk) {
        public boolean blocked() { return level == Level.BLOCK; }
        public boolean flagged() { return level != Level.NONE; }
    }

    private static final Pattern URL = Pattern.compile(
            "(?i)\\b((https?://|www\\.)\\S+|[a-z0-9][a-z0-9-]{1,62}\\.(com|ro|net|org|info|xyz|top|site|online|link|ly|io|me|app|shop|store|click|live|eu|co|biz|pw|cc|tk|ml|ga|cf|gq)(/\\S*)?)\\b");
    private static final Pattern CARD = Pattern.compile("(?<!\\d)(?:\\d[ -]?){13,19}(?!\\d)");
    private static final Pattern PHONE = Pattern.compile("(?<!\\d)(\\+?\\d[\\d .()-]{7,}\\d)(?!\\d)");
    private static final Pattern EMAIL = Pattern.compile("(?i)[a-z0-9._%+-]+@[a-z0-9.-]+\\.[a-z]{2,}");

    private static final List<String> CARD_DATA = List.of(
            "cvv", "cvc", "cvv2", "spatele cardului", "datele cardului", "datele de card", "numarul cardului",
            "data expirarii", "card details", "card number", "security code", "kartendaten", "kartennummer",
            "pruefnummer", "numero de carte", "numero de tarjeta", "codice cvv", "dane karty", "kart bilgileri",
            "cod pin", "pin-ul", "codul pin", "codul primit prin sms", "codul de verificare", "3d secure");
    private static final List<String> PAYMENT_LINK = List.of(
            "link de plata", "link de incasare", "link pentru plata", "link de livrare", "linkul de la curier",
            "payment link", "link to receive", "receive the money", "primesti banii pe link", "primiti banii",
            "completeaza datele", "confirma plata pe", "zahlungslink", "lien de paiement", "enlace de pago");
    private static final List<String> OFF_PLATFORM = List.of(
            "whatsapp", "whats app", "watsapp", "telegram", "signal", "viber", "wechat", "scrie-mi pe", "scrie mi pe",
            "contact me on", "text me on");
    private static final List<String> RISKY_PAYMENT = List.of(
            "western union", "moneygram", "bitcoin", "crypto", "usdt", "gift card", "card cadou", "paysafe",
            "avans", "in avans", "plata in avans", "pay in advance", "advance payment", "transfer inainte",
            "vorauskasse", "acompte", "anticipo", "zaliczka");

    public Result analyze(String text) {
        if (text == null || text.isBlank()) return new Result(Level.NONE, List.of(), text, 0);
        String plain = fold(text);
        Set<String> reasons = new LinkedHashSet<>();
        Level level = Level.NONE;
        int risk = 0;

        String sanitized = text;
        Matcher card = CARD.matcher(text);
        while (card.find()) {
            String digits = card.group().replaceAll("\\D", "");
            if (digits.length() >= 13 && luhn(digits)) {
                reasons.add("CARD_NUMBER");
                level = Level.BLOCK;
                risk += 90;
            }
        }
        if (containsAny(plain, CARD_DATA)) { reasons.add("CARD_DATA_REQUEST"); level = Level.BLOCK; risk += 90; }

        boolean hasLink = URL.matcher(text).find();
        if (hasLink) {
            reasons.add("LINK");
            sanitized = URL.matcher(sanitized).replaceAll("[link]");
            if (level != Level.BLOCK) level = Level.WARN;
            risk += 35;
        }
        if (containsAny(plain, PAYMENT_LINK)) {
            reasons.add("PAYMENT_LINK");
            if (hasLink) { level = Level.BLOCK; risk += 60; } else { if (level != Level.BLOCK) level = Level.WARN; risk += 30; }
        }
        if (containsAny(plain, OFF_PLATFORM)) { reasons.add("OFF_PLATFORM_CHAT"); if (level != Level.BLOCK) level = Level.WARN; risk += 25; }
        if (containsAny(plain, RISKY_PAYMENT)) { reasons.add("RISKY_PAYMENT"); if (level != Level.BLOCK) level = Level.WARN; risk += 30; }
        if (EMAIL.matcher(text).find()) { reasons.add("CONTACT_EMAIL"); if (level != Level.BLOCK) level = Level.WARN; risk += 10; }
        Matcher phone = PHONE.matcher(text);
        while (phone.find()) {
            String digits = phone.group().replaceAll("\\D", "");
            if (digits.length() >= 9 && digits.length() <= 13 && !reasons.contains("CARD_NUMBER")) {
                reasons.add("CONTACT_PHONE");
                if (level != Level.BLOCK) level = Level.WARN;
                risk += 10;
                break;
            }
        }
        return new Result(level, List.copyOf(reasons), sanitized, Math.min(100, risk));
    }

    public boolean containsLink(String text) { return text != null && URL.matcher(text).find(); }

    static String fold(String s) {
        String n = Normalizer.normalize(s.toLowerCase(Locale.ROOT), Normalizer.Form.NFD).replaceAll("\\p{M}", "");
        return n.replaceAll("\\s+", " ");
    }

    private static boolean containsAny(String text, List<String> needles) {
        for (String n : needles) if (text.contains(n)) return true;
        return false;
    }

    static boolean luhn(String digits) {
        int sum = 0;
        boolean alt = false;
        for (int i = digits.length() - 1; i >= 0; i--) {
            int d = digits.charAt(i) - '0';
            if (alt) { d *= 2; if (d > 9) d -= 9; }
            sum += d;
            alt = !alt;
        }
        return sum % 10 == 0;
    }
}
