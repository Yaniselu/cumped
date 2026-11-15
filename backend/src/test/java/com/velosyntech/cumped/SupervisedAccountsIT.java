package com.velosyntech.cumped;

import com.velosyntech.cumped.user.Guardianship;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.jdbc.core.simple.JdbcClient;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

import java.time.LocalDate;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Conturi 16–17 ani gestionate de un părinte: fără acord nu se poate tranzacționa, acordul cere un adult cu identitatea
 * verificată, iar limitele (preț, categorii, doar curier, date de contact în chat, banii la părinte) sunt impuse de server.
 */
@IntegrationTest
class SupervisedAccountsIT {
    @Value("${local.server.port}") int port;
    @Autowired JsonMapper json;
    @Autowired JdbcClient jdbc;
    @Autowired Guardianship guardianship;

    private static final String PASSWORD = "Sigur-Parola-2026!";

    private TestClient adult(boolean verified) {
        TestClient c = new TestClient(port, json);
        c.register();
        if (verified) assertThat(c.post("/api/verification/identity/dev-complete", Map.of("firstName", "maria", "lastName", "popescu")).status()).isEqualTo(200);
        return c;
    }

    private Map<String, Object> registration(String sfx, LocalDate birth, String parentEmail, Boolean adult) {
        Map<String, Object> m = new HashMap<>();
        m.put("email", "t" + sfx + "@test.dev");
        m.put("password", PASSWORD);
        m.put("username", "t_" + sfx);
        m.put("country", "RO");
        m.put("locale", "ro");
        m.put("acceptTerms", true);
        m.put("adultConfirmed", adult);
        m.put("website", "");
        m.put("elapsedMs", 6000);
        if (birth != null) m.put("birthDate", birth.toString());
        if (parentEmail != null) m.put("parentEmail", parentEmail);
        return m;
    }

    private TestClient teen(String parentEmail) {
        TestClient c = new TestClient(port, json);
        String sfx = UUID.randomUUID().toString().substring(0, 8);
        TestClient.Res r = c.post("/api/auth/register", registration(sfx, LocalDate.now().minusYears(16).minusDays(40), parentEmail, false));
        assertThat(r.status()).as(r.raw().body()).isEqualTo(201);
        c.token = r.body().get("accessToken").asText();
        c.userId = r.body().get("user").get("id").asText();
        c.email = "t" + sfx + "@test.dev";
        return c;
    }

    /** Linkul din emailul trimis părintelui (în teste citim coada de emailuri). */
    private String inviteToken(String parentEmail) {
        String body = jdbc.sql("SELECT body FROM mail_outbox WHERE to_addr = ? ORDER BY created_at DESC LIMIT 1").param(parentEmail)
                .query(String.class).single();
        Matcher m = Pattern.compile("/guardian/([A-Za-z0-9_-]{20,})").matcher(body);
        assertThat(m.find()).as(body).isTrue();
        return m.group(1);
    }

    private Map<String, Object> listing(String title, String category, long priceCents, List<String> shipsTo) {
        Map<String, Object> m = new HashMap<>();
        m.put("title", title);
        m.put("description", "Produs original, în stare foarte bună, cu cutie și accesorii. Trimit prin curier.");
        m.put("category", category);
        m.put("condition", "LIKE_NEW");
        m.put("priceCents", priceCents);
        m.put("currency", "RON");
        m.put("country", "RO");
        m.put("city", "Cluj-Napoca");
        m.put("shipsTo", shipsTo);
        m.put("acceptsOffers", true);
        m.put("acceptsSwap", false);
        return m;
    }

    private static final Map<String, Object> ADDR = Map.of("name", "Ana Pop", "address", "Str. Florilor 3", "city", "Iași",
            "postcode", "700000", "country", "RO", "phone", "+40 733 111 222");

    private TestClient approvedTeen(TestClient parent) {
        TestClient t = teen(parent.email);
        assertThat(parent.post("/api/guardian/invites/" + inviteToken(parent.email) + "/accept", Map.of("declaration", true)).status()).isEqualTo(200);
        return t;
    }

    @Test
    void registrationNeedsAgeAndParentAndRejectsUnder16() {
        String sfx = UUID.randomUUID().toString().substring(0, 8);
        TestClient anon = new TestClient(port, json);
        assertThat(anon.post("/api/auth/register", registration(sfx, LocalDate.now().minusYears(15), "p@test.dev", false)).error()).isEqualTo("TOO_YOUNG");
        assertThat(anon.post("/api/auth/register", registration(sfx, LocalDate.now().minusYears(17), null, false)).error()).isEqualTo("PARENT_EMAIL_REQUIRED");
        assertThat(anon.post("/api/auth/register", registration(sfx, null, null, false)).error()).isEqualTo("TERMS_REQUIRED");
        assertThat(anon.post("/api/auth/register", registration(sfx, LocalDate.now().minusYears(17), "t" + sfx + "@test.dev", false)).error())
                .isEqualTo("PARENT_EMAIL_SAME");
    }

    @Test
    void withoutParentalConsentTheAccountCanOnlyBrowse() {
        TestClient parent = adult(true);
        TestClient t = teen(parent.email);
        JsonNode me = t.get("/api/me").body();
        assertThat(me.get("supervision").get("status").asText()).isEqualTo("PENDING");
        assertThat(me.get("supervision").get("courierOnly").asBoolean()).isTrue();
        assertThat(t.post("/api/listings", listing("Căști Bluetooth noi", "ELECTRONICS", 15000, List.of("RO"))).error())
                .isEqualTo("GUARDIAN_APPROVAL_REQUIRED");
        // poate naviga
        assertThat(t.get("/api/listings").status()).isEqualTo(200);
        // emailul către părinte conține linkul; pagina publică arată cine cere acordul și limitele
        JsonNode inv = new TestClient(port, json).get("/api/guardian/invites/" + inviteToken(parent.email)).body();
        assertThat(inv.get("teenAge").asInt()).isEqualTo(16);
        assertThat(inv.get("maxEurCents").asLong()).isEqualTo(Guardianship.MAX_EUR_CENTS);
    }

    @Test
    void consentRequiresAnAdultWithVerifiedIdentityAndADeclaration() {
        TestClient parent = adult(false);
        teen(parent.email);
        String token = inviteToken(parent.email);
        assertThat(parent.post("/api/guardian/invites/" + token + "/accept", Map.of("declaration", true)).error()).isEqualTo("PARENT_NOT_VERIFIED");
        assertThat(parent.post("/api/verification/identity/dev-complete", Map.of("firstName", "ion", "lastName", "pop")).status()).isEqualTo(200);
        assertThat(parent.post("/api/guardian/invites/" + token + "/accept", Map.of("declaration", false)).error()).isEqualTo("DECLARATION_REQUIRED");
        assertThat(parent.post("/api/guardian/invites/" + token + "/accept", Map.of("declaration", true)).status()).isEqualTo(200);
        // linkul se folosește o singură dată
        assertThat(parent.post("/api/guardian/invites/" + token + "/accept", Map.of("declaration", true)).status()).isEqualTo(404);
        // dovada acordului rămâne
        Integer proofs = jdbc.sql("SELECT count(*) FROM guardian_consents c JOIN users p ON p.id = c.parent_id WHERE p.email = ? AND c.action = 'APPROVED'")
                .param(parent.email).query(Integer.class).single();
        assertThat(proofs).isEqualTo(1);
        // un alt minor nu poate fi „părinte”
        TestClient other = teen("altcineva-" + UUID.randomUUID().toString().substring(0, 6) + "@test.dev");
        TestClient t2 = teen(other.email);
        assertThat(other.post("/api/guardian/invites/" + inviteToken(other.email) + "/accept", Map.of("declaration", true)).status()).isEqualTo(403);
        assertThat(t2.get("/api/me").body().get("supervision").get("status").asText()).isEqualTo("PENDING");
    }

    @Test
    void approvedAccountHasServerEnforcedLimits() {
        TestClient parent = adult(true);
        TestClient t = approvedTeen(parent);
        assertThat(t.post("/api/listings", listing("Bicicletă de oraș", "VEHICLES", 15000, List.of("RO"))).error()).isEqualTo("MINOR_CATEGORY");
        assertThat(t.post("/api/listings", listing("Telefon Samsung Galaxy", "PHONES", 150000, List.of("RO"))).error()).isEqualTo("MINOR_PRICE_LIMIT");
        assertThat(t.post("/api/listings", listing("Căști Bluetooth noi", "ELECTRONICS", 15000, List.of())).error()).isEqualTo("MINOR_COURIER_ONLY");
        TestClient.Res ok = t.post("/api/listings", listing("Căști Bluetooth noi", "ELECTRONICS", 15000, List.of("RO")));
        assertThat(ok.status()).as(ok.raw().body()).isIn(200, 201);
        String teenListing = ok.body().get("id").asText();
        // vânzătorul minor: doar curier, iar anunțul o spune
        TestClient buyer = adult(false);
        assertThat(buyer.get("/api/listings/" + teenListing).body().get("courierOnly").asBoolean()).isTrue();
        assertThat(buyer.post("/api/listings/" + teenListing + "/orders", Map.of("delivery", "PICKUP")).error()).isEqualTo("MINOR_COURIER_ONLY");
        TestClient.Res order = buyer.post("/api/listings/" + teenListing + "/orders", Map.of("delivery", "COURIER", "address", ADDR));
        assertThat(order.status()).as(order.raw().body()).isEqualTo(201);
        // banii merg la părinte, iar părintele e anunțat
        UUID payout = jdbc.sql("SELECT payout_user_id FROM orders WHERE id = CAST(? AS uuid)").param(order.body().get("id").asText()).query(UUID.class).single();
        assertThat(payout.toString()).isEqualTo(parent.userId);
        assertThat(parent.get("/api/me/notifications").raw().body()).contains("CHILD_ORDER");
        // cumpărătorul minor: peste limită, nu
        TestClient seller = adult(false);
        TestClient.Res pricey = seller.post("/api/listings", listing("Consolă PlayStation 5", "ELECTRONICS", 200000, List.of("RO")));
        String expensive = pricey.body().get("id").asText();
        assertThat(t.post("/api/listings/" + expensive + "/orders", Map.of("delivery", "COURIER", "address", ADDR)).error()).isEqualTo("MINOR_PRICE_LIMIT");
        // panoul părintelui
        JsonNode kids = parent.get("/api/guardian/children").body();
        assertThat(kids.size()).isEqualTo(1);
        assertThat(kids.get(0).get("openOrders").asInt()).isEqualTo(1);
    }

    @Test
    void chatWithASupervisedAccountBlocksContactDetails() {
        TestClient parent = adult(true);
        TestClient t = approvedTeen(parent);
        TestClient seller = adult(false);
        String l = seller.post("/api/listings", listing("Carte de colorat pentru adolescenți", "BOOKS_MUSIC", 3000, List.of("RO"))).body().get("id").asText();
        TestClient.Res conv = t.post("/api/conversations", Map.of("listingId", l));
        assertThat(conv.status()).as(conv.raw().body()).isIn(200, 201);
        String c = conv.body().get("id").asText();
        assertThat(t.post("/api/conversations/" + c + "/messages", Map.of("body", "Bună! Mai e disponibilă?")).status()).isIn(200, 201);
        assertThat(seller.post("/api/conversations/" + c + "/messages", Map.of("body", "Da, scrie-mi pe WhatsApp la 0722 123 456")).error())
                .isEqualTo("CONTACT_NOT_ALLOWED");
        assertThat(t.post("/api/conversations/" + c + "/messages", Map.of("body", "emailul meu e ana@exemplu.ro")).error()).isEqualTo("CONTACT_NOT_ALLOWED");
    }

    @Test
    void publicProfileHidesCityAndRealName() {
        TestClient parent = adult(true);
        TestClient t = approvedTeen(parent);
        JsonNode pub = new TestClient(port, json).get("/api/users/" + t.userId).body();
        assertThat(pub.get("city").isNull()).isTrue();
        assertThat(pub.get("realNameAvailable").asBoolean()).isFalse();
    }

    @Test
    void parentCanPauseAndRevokeAndAccountGraduatesAt18() {
        TestClient parent = adult(true);
        TestClient t = approvedTeen(parent);
        String l = t.post("/api/listings", listing("Căști Bluetooth noi", "ELECTRONICS", 15000, List.of("RO"))).body().get("id").asText();
        assertThat(parent.post("/api/guardian/children/" + t.userId + "/pause", Map.of()).status()).isEqualTo(200);
        assertThat(t.get("/api/listings/" + l).body().get("status").asText()).isEqualTo("PAUSED");
        assertThat(t.post("/api/listings", listing("Husă telefon", "PHONES", 5000, List.of("RO"))).error()).isEqualTo("GUARDIAN_PAUSED");
        assertThat(parent.post("/api/guardian/children/" + t.userId + "/resume", Map.of()).status()).isEqualTo(200);
        assertThat(t.post("/api/listings", listing("Husă telefon", "PHONES", 5000, List.of("RO"))).status()).isIn(200, 201);
        // alt utilizator nu poate controla contul
        assertThat(adult(true).post("/api/guardian/children/" + t.userId + "/pause", Map.of()).status()).isEqualTo(404);
        // majoratul: limitele dispar, legătura cu părintele se încheie
        jdbc.sql("UPDATE users SET adult_at = CURRENT_DATE WHERE id = CAST(? AS uuid)").param(t.userId).update();
        guardianship.graduate();
        JsonNode me = t.get("/api/me").body();
        assertThat(me.get("supervision").isNull()).isTrue();
        assertThat(t.post("/api/listings", listing("Bicicletă de oraș", "VEHICLES", 150000, List.of())).status()).isIn(200, 201, 402);
        assertThat(parent.get("/api/guardian/children").body().size()).isZero();
    }

    @Test
    void parentCanDeclineWithoutAnAccount() {
        String parentEmail = "parinte-" + UUID.randomUUID().toString().substring(0, 6) + "@test.dev";
        TestClient t = teen(parentEmail);
        assertThat(new TestClient(port, json).post("/api/guardian/invites/" + inviteToken(parentEmail) + "/decline", Map.of()).status()).isEqualTo(200);
        assertThat(t.get("/api/me").body().get("supervision").get("status").asText()).isEqualTo("DECLINED");
        // poate trimite din nou, către alt părinte
        assertThat(t.post("/api/guardian/resend", Map.of("parentEmail", "mama-" + UUID.randomUUID().toString().substring(0, 6) + "@test.dev")).status()).isEqualTo(200);
        assertThat(t.get("/api/me").body().get("supervision").get("status").asText()).isEqualTo("PENDING");
    }
}
