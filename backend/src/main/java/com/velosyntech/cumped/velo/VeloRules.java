package com.velosyntech.cumped.velo;

import org.springframework.stereotype.Component;

import java.util.List;
import java.util.Map;

/**
 * Velo fără AI: triaj pe cuvinte-cheie în mai multe limbi, cu răspunsuri în română și engleză.
 * Rulează când nu e configurată cheia Claude sau dacă API-ul nu răspunde.
 */
@Component
public class VeloRules {

    private static final Map<String, List<String>> CATEGORY_WORDS = Map.of(
            "FRAUD", List.of("teapa", "tepar", "scam", "fraud", "inselat", "inselaciune", "escroc", "phishing", "link",
                    "card", "cvv", "furat", "fals", "fake", "betrug", "arnaque", "estafa", "truffa", "oszustwo", "dolandir",
                    "shahrai", "datele cardului", "mi-a cerut", "mi a cerut", "banii", "money", "geld"),
            "DELIVERY", List.of("colet", "livrare", "curier", "n-am primit", "nu am primit", "nu a ajuns", "not received",
                    "package", "parcel", "delivery", "shipping", "paket", "lieferung", "colis", "paquete", "pacco", "paczka"),
            "PAYMENT", List.of("plata", "rambursare", "refund", "payment", "charged", "taxat", "factura", "abonament",
                    "zahlung", "paiement", "pago", "pagamento", "platnosc"),
            "ACCOUNT", List.of("cont", "parola", "hack", "spart", "login", "logare", "account", "password", "blocat",
                    "suspendat", "konto", "passwort", "compte", "cuenta", "account bloccato"),
            "LISTING", List.of("anunt fals", "anunt interzis", "anunt suspect", "fake listing", "listing", "anunt"));

    private static final List<String> MONEY_LOST = List.of("am trimis bani", "am platit", "am transferat", "mi-au luat banii",
            "mi au luat banii", "i paid", "sent money", "lost money", "am pierdut", "habe bezahlt", "j'ai paye", "he pagado", "ho pagato");
    private static final List<String> CREDENTIALS = List.of("cvv", "datele cardului", "codul primit", "cod sms", "parola mea",
            "card number", "my password", "pin");

    record Faq(List<String> words, String ro, String en) {}

    private static final List<Faq> FAQ = List.of(
            new Faq(List.of("promov", "promote", "top", "evidentiere", "bump", "ridic"),
                    "Poți promova un anunț 7 zile în top cu 2,99 € sau îl poți „ridica” în listă cu 0,99 €. Intră pe anunț → Promovează.",
                    "You can promote a listing to the top for 7 days for €2.99, or bump it up the list for €0.99. Open the listing → Promote."),
            new Faq(List.of("abonament", "plan", "plus", "pro", "subscription", "pret", "cost", "price"),
                    "Ai 2 anunțuri active gratuite în primul an (5 dacă inviți 10 prieteni care își verifică contul). Plus: 4,99 €/lună pentru 15 anunțuri, Pro: 19,99 €/lună pentru 100 de anunțuri. Un anunț în plus costă 1,99 € pe 30 de zile.",
                    "You get 2 free active listings in your first year (5 if you invite 10 friends who verify). Plus: €4.99/month for 15 listings, Pro: €19.99/month for 100. An extra listing is €1.99 for 30 days."),
            new Faq(List.of("verific", "verify", "bifa", "badge", "buletin", "id card", "identitate", "identity"),
                    "Verificarea identității îți dă bifa de cont verificat. Numele real de pe document îl văd doar alți utilizatori verificați; public apare username-ul tău, dacă așa alegi. Profil → Verifică-ți contul.",
                    "Identity verification gives you the verified badge. Your real name is shown only to other verified users; publicly you can appear by username. Profile → Verify your account."),
            new Faq(List.of("invit", "referral", "prieten", "friend", "cod"),
                    "Trimite codul tău de invitație din Profil. Când 10 persoane invitate își verifică contul, poți avea până la 5 anunțuri active gratuite.",
                    "Share your invite code from your Profile. When 10 invited people verify their account, you can keep up to 5 free active listings."),
            new Faq(List.of("sterg cont", "sterge contul", "delete account", "gdpr", "datele mele", "my data"),
                    "Din Setări poți descărca o copie a datelor tale sau îți poți șterge contul definitiv.",
                    "In Settings you can download a copy of your data or permanently delete your account."),
            new Faq(List.of("schimb", "swap", "troc", "oferta", "offer"),
                    "Pe anunțurile care acceptă, poți face o ofertă de preț sau poți propune la schimb unul dintre anunțurile tale. Apasă „Fă o ofertă” pe anunț.",
                    "On listings that allow it, you can make a price offer or propose one of your own listings as a swap. Tap “Make an offer” on the listing."),
            new Faq(List.of("sigur", "safe", "siguranta", "safety", "sfat", "tips"),
                    "Sfaturi: păstrează discuția și plata în Cumped, nu plăti niciodată prin linkuri primite în chat, nu da datele cardului, întâlnește-te în locuri publice și verifică produsul înainte să plătești.",
                    "Tips: keep chats and payments inside Cumped, never pay through links from chat, never share card details, meet in public places and check the item before paying."));

    public VeloDecision decide(String latest, int userTurns, boolean hasContext, String locale) {
        String t = ScamDetector.fold(latest);
        boolean ro = "ro".equals(locale);

        String category = null;
        int best = 0;
        for (var e : CATEGORY_WORDS.entrySet()) {
            int hits = 0;
            for (String w : e.getValue()) if (t.contains(w)) hits++;
            if (hits > best) { best = hits; category = e.getKey(); }
        }
        boolean moneyLost = containsAny(t, MONEY_LOST);
        boolean credentials = containsAny(t, CREDENTIALS);

        if (category == null || (best == 1 && "LISTING".equals(category))) {
            for (Faq f : FAQ) {
                if (containsAny(t, f.words())) {
                    return new VeloDecision(ro ? f.ro() : f.en(), "FAQ", "OTHER", "LOW", 0, false, "", suggestions(ro, false));
                }
            }
            if (category == null) {
                String reply = ro
                        ? "Sunt Velo, asistentul Cumped. Te pot ajuta cu întrebări despre anunțuri, abonamente și verificare, sau cu raportarea unei probleme (țeapă, livrare, plată, cont). Ce s-a întâmplat?"
                        : "I'm Velo, Cumped's assistant. I can help with listings, plans and verification, or with reporting a problem (scam, delivery, payment, account). What happened?";
                return new VeloDecision(reply, "SMALLTALK", "OTHER", "LOW", 0, false, "", suggestions(ro, true));
            }
        }

        int risk = switch (category) {
            case "FRAUD" -> 60 + (moneyLost ? 20 : 0) + (credentials ? 15 : 0)
                    + (t.contains("link") ? 15 : 0) + (t.contains("whatsapp") || t.contains("telegram") ? 5 : 0);
            case "ACCOUNT" -> 30 + (t.contains("hack") || t.contains("spart") ? 30 : 0);
            default -> 20 + (moneyLost ? 15 : 0);
        };
        risk = Math.min(100, risk);
        String priority = risk >= 85 ? "URGENT" : risk >= 60 ? "HIGH" : risk >= 35 ? "MEDIUM" : "LOW";
        boolean enough = latest.length() >= 60 || userTurns >= 2 || moneyLost || credentials || hasContext;

        if (!enough) {
            String reply = ro
                    ? "Îmi pare rău că ți s-a întâmplat asta. Ca să te ajut repede: spune-mi pe scurt ce s-a întâmplat, când, despre ce anunț sau utilizator e vorba și dacă ai trimis deja bani."
                    : "I'm sorry this happened. To help quickly: briefly tell me what happened, when, which listing or user it's about, and whether you already sent money.";
            return new VeloDecision(reply, "REPORT", category, priority, risk, false, "", List.of());
        }
        StringBuilder reply = new StringBuilder(ro
                ? "Mulțumesc, am deschis un tichet și l-am trimis echipei de siguranță Cumped. Te anunțăm aici și prin notificare."
                : "Thank you, I've opened a ticket and sent it to the Cumped safety team. We'll update you here and by notification.");
        if (credentials) reply.append(ro
                ? " Important: dacă ai dat datele cardului sau un cod primit prin SMS, sună acum la banca ta și blochează cardul."
                : " Important: if you shared card details or an SMS code, call your bank now and block the card.");
        if ("FRAUD".equals(category)) reply.append(ro
                ? " Nu mai trimite bani și nu deschide linkuri primite în conversație."
                : " Don't send more money and don't open links from the conversation.");
        String summary = "Raport " + category + " (reguli automate). Ultimul mesaj: " + truncate(latest, 400);
        return new VeloDecision(reply.toString(), "REPORT", category, priority, risk, true, summary, List.of());
    }

    private static List<String> suggestions(boolean ro, boolean report) {
        return ro ? List.of("Cred că e o țeapă", "N-am primit coletul", "Cum promovez un anunț?")
                  : List.of("I think it's a scam", "I didn't get my package", "How do I promote a listing?");
    }

    private static boolean containsAny(String t, List<String> words) {
        for (String w : words) if (t.contains(w)) return true;
        return false;
    }

    static String truncate(String s, int n) { return s.length() <= n ? s : s.substring(0, n) + "…"; }
}
