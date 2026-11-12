package com.velosyntech.cumped;

import com.velosyntech.cumped.order.OrderService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.jdbc.core.simple.JdbcClient;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Cerințe legale verificate automat. Nu înlocuiesc un avocat, dar prind regresiile:
 *  GDPR (UE 2016/679), DSA (UE 2022/2065), Omnibus (UE 2019/2161), drepturile consumatorilor (2011/83/UE),
 *  ePrivacy (2002/58/CE), regulile App Store / Google Play pentru ștergerea contului.
 */
@IntegrationTest
class LegalComplianceIT {
    @Value("${local.server.port}") int port;
    @Autowired JsonMapper json;
    @Autowired JdbcClient jdbc;
    @Autowired OrderService orders;

    private TestClient user() {
        TestClient c = new TestClient(port, json);
        c.register();
        return c;
    }

    private String listing(TestClient seller, String title) {
        Map<String, Object> m = new HashMap<>();
        m.put("title", title);
        m.put("description", "Produs în stare foarte bună, folosit cu grijă, vine cu toate accesoriile.");
        m.put("category", "ELECTRONICS");
        m.put("condition", "GOOD");
        m.put("priceCents", 50000);
        m.put("currency", "RON");
        m.put("country", "RO");
        m.put("city", "Cluj-Napoca");
        m.put("shipsTo", List.of("RO"));
        m.put("acceptsOffers", true);
        m.put("acceptsSwap", false);
        return seller.post("/api/listings", m).body().get("id").asText();
    }

    /** GDPR art. 7 + vârsta minimă: fără acord explicit cu Termenii și confirmarea de 18+, nu se creează cont. */
    @Test
    void gdprConsent_registrationNeedsExplicitTermsAndAdultConfirmation() {
        TestClient anon = new TestClient(port, json);
        String s = String.valueOf(System.nanoTime() % 100000000);
        Map<String, Object> base = Map.of("email", "c" + s + "@test.dev", "password", "Sigur-Parola-2026!", "username", "c_" + s);
        Map<String, Object> noAge = new HashMap<>(base);
        noAge.put("acceptTerms", true);
        noAge.put("adultConfirmed", false);
        assertThat(anon.post("/api/auth/register", noAge).error()).isEqualTo("TERMS_REQUIRED");
        Map<String, Object> noTerms = new HashMap<>(base);
        noTerms.put("acceptTerms", false);
        noTerms.put("adultConfirmed", true);
        assertThat(anon.post("/api/auth/register", noTerms).error()).isEqualTo("TERMS_REQUIRED");
        // acordul e înregistrat cu versiunea Termenilor acceptată (dovada consimțământului)
        TestClient u = user();
        String accepted = u.get("/api/me").body().get("termsVersion").asText();
        assertThat(accepted).isEqualTo(new TestClient(port, json).get("/api/config").body().get("termsVersion").asText());
    }

    /** GDPR art. 15 și 20: utilizatorul își poate descărca toate datele. */
    @Test
    void gdprAccessAndPortability_exportContainsAllPersonalData() {
        TestClient seller = user(), buyer = user();
        String l = listing(seller, "Tabletă Samsung Tab");
        String conv = buyer.post("/api/conversations", Map.of("listingId", l)).body().get("id").asText();
        buyer.post("/api/conversations/" + conv + "/messages", Map.of("body", "Mai e disponibilă tableta?"));
        Map<String, Object> addr = Map.of("name", "Mihai Ionescu", "address", "Str. Teilor 9", "city", "Brașov",
                "postcode", "500000", "country", "RO", "phone", "+40 744 000 111");
        String o = buyer.post("/api/listings/" + l + "/orders", Map.of("delivery", "COURIER", "address", addr)).body().get("id").asText();
        seller.post("/api/orders/" + o + "/ship", Map.of("carrier", "SAMEDAY", "trackingCode", "1ONB55554444"));
        buyer.post("/api/orders/" + o + "/confirm", Map.of());
        buyer.post("/api/reviews", Map.of("orderId", o, "rating", 5, "comment", "Foarte ok"));

        JsonNode ex = buyer.get("/api/me/export").body();
        assertThat(ex.get("profile").get("email").asText()).isEqualTo(buyer.email);
        assertThat(ex.get("messagesSent").toString()).contains("Mai e disponibilă");
        assertThat(ex.get("orders").get(0).get("shipAddress").asText()).isEqualTo("Str. Teilor 9"); // decriptată pentru titular
        assertThat(ex.get("reviewsWritten").get(0).get("comment").asText()).isEqualTo("Foarte ok");
        // vânzătorul nu primește adresa cumpărătorului în exportul LUI
        assertThat(seller.get("/api/me/export").raw().body()).doesNotContain("Teilor").doesNotContain("744");
    }

    /** GDPR art. 17 + App Store 5.1.1(v) / Google Play: contul se poate șterge din aplicație, datele dispar. */
    @Test
    void gdprErasure_accountDeletionRemovesIdentityAndBlocksLogin() {
        TestClient u = user();
        assertThat(u.send("DELETE", "/api/me", null, false).status()).isBetween(200, 204);
        TestClient again = new TestClient(port, json);
        assertThat(again.post("/api/auth/login", Map.of("email", u.email, "password", "Sigur-Parola-2026!")).status()).isEqualTo(401);
        Integer left = jdbc.sql("SELECT count(*) FROM users WHERE email = ?").param(u.email).query(Integer.class).single();
        assertThat(left).isZero();
    }

    /** GDPR art. 5(1)(c) minimizarea datelor: profilul public nu conține date de contact. */
    @Test
    void gdprMinimisation_publicProfileHasNoContactData() {
        TestClient u = user();
        String pub = new TestClient(port, json).get("/api/users/" + u.userId).raw().body();
        assertThat(pub).doesNotContain(u.email).doesNotContain("phone\"").doesNotContain("legalName");
    }

    /** ePrivacy art. 5(3): fără cont, aplicația nu pune cookie-uri (deci nu e nevoie de banner de consimțământ). */
    @Test
    void ePrivacy_anonymousBrowsingSetsNoCookies() {
        TestClient anon = new TestClient(port, json);
        for (String path : List.of("/api/config", "/api/listings", "/api/categories")) {
            assertThat(anon.get(path).raw().headers().allValues("Set-Cookie")).as(path).isEmpty();
        }
    }

    /** DSA art. 11, 12 + Directiva comerțului electronic art. 5: date de identificare și puncte de contact publice. */
    @Test
    void dsaContactPoints_companyIdentityIsPublished() {
        JsonNode company = new TestClient(port, json).get("/api/config").body().get("company");
        for (String k : List.of("name", "address", "regNo", "email", "dpoEmail")) assertThat(company.has(k)).as(k).isTrue();
    }

    /** DSA art. 16: oricine are cont poate raporta conținut ilegal și primește confirmarea (cod de tichet). */
    @Test
    void dsaNoticeAndAction_reportGetsTicketReceipt() {
        TestClient seller = user(), reporter = user();
        String l = listing(seller, "Parfum Chanel de vânzare");
        TestClient.Res r = reporter.post("/api/reports", Map.of("targetType", "LISTING", "targetId", l, "reason", "COUNTERFEIT", "details", "Pare fals"));
        assertThat(r.status()).isEqualTo(201);
        assertThat(r.body().get("code").asText()).isNotBlank();
        // raportarea propriului anunț nu e permisă (abuz)
        assertThat(seller.post("/api/reports", Map.of("targetType", "LISTING", "targetId", l, "reason", "SPAM")).error()).isEqualTo("CANNOT_REPORT_SELF");
    }

    /** DSA art. 20: vânzătorul poate contesta o decizie de moderare; alții nu pot contesta în numele lui. */
    @Test
    void dsaInternalComplaints_onlyTheOwnerCanAppeal() {
        TestClient seller = user(), other = user();
        String l = listing(seller, "Căști Bose QC");
        assertThat(other.post("/api/appeals", Map.of("listingId", l, "message", "Contest eliminarea anunțului.")).status()).isEqualTo(404);
        assertThat(seller.post("/api/appeals", Map.of("listingId", l, "message", "Contest eliminarea, produsul e original.")).status()).isIn(200, 201);
    }

    /** DSA art. 30–31 + Omnibus art. 6a: cumpărătorul vede dacă vinde o firmă sau o persoană fizică. */
    @Test
    void dsaTraderTransparency_sellerTypeIsAlwaysShown() {
        TestClient seller = user();
        String l = listing(seller, "Mouse Logitech MX");
        JsonNode s = new TestClient(port, json).get("/api/listings/" + l).body().get("seller");
        assertThat(s.get("accountType").asText()).isEqualTo("PRIVATE");
    }

    /** Omnibus (Directiva 2005/29 art. 7(6)): recenziile provin doar din cumpărări verificate și sunt marcate ca atare. */
    @Test
    void omnibus_reviewsComeOnlyFromVerifiedPurchases() {
        TestClient seller = user(), buyer = user(), fake = user();
        String l = listing(seller, "Cameră GoPro Hero");
        String o = buyer.post("/api/listings/" + l + "/orders", Map.of("delivery", "PICKUP")).body().get("id").asText();
        seller.post("/api/orders/" + o + "/ship", Map.of());
        buyer.post("/api/orders/" + o + "/confirm", Map.of());
        assertThat(fake.post("/api/reviews", Map.of("orderId", o, "rating", 1, "comment", "Țeapă")).status()).isEqualTo(404);
        assertThat(buyer.post("/api/reviews", Map.of("orderId", o, "rating", 4)).status()).isEqualTo(200);
        JsonNode reviews = new TestClient(port, json).get("/api/users/" + seller.userId + "/reviews").body();
        assertThat(reviews.size()).isEqualTo(1);
        for (JsonNode r : reviews) assertThat(r.get("verifiedPurchase").asBoolean()).isTrue();
        Integer unverified = jdbc.sql("SELECT count(*) FROM reviews WHERE reviewee_id = CAST(? AS uuid) AND order_id IS NULL").param(seller.userId).query(Integer.class).single();
        assertThat(unverified).isZero();
    }

    /** Directiva 2011/83 art. 6(1)(e): prețul total, cu transport și comision, e arătat înainte de plată. */
    @Test
    void consumerRights_totalPriceIsShownBeforePayment() {
        TestClient seller = user(), buyer = user();
        String l = listing(seller, "Consolă Nintendo Switch");
        JsonNode q = buyer.get("/api/listings/" + l + "/order-quote?delivery=COURIER&country=RO").body();
        long item = q.get("itemCents").asLong(), ship = q.get("shippingCents").asLong(), fee = q.get("feeCents").asLong();
        assertThat(item).isEqualTo(50000);
        assertThat(q.get("totalCents").asLong()).isEqualTo(item + ship + fee);
        assertThat(q.get("currency").asText()).isEqualTo("RON");
    }

    /** Protecția cumpărătorului: dacă vânzătorul nu trimite la timp, banii se întorc automat. */
    @Test
    void buyerProtection_unshippedOrdersAreRefundedAutomatically() {
        TestClient seller = user(), buyer = user();
        String l = listing(seller, "Aparat cafea DeLonghi");
        String o = buyer.post("/api/listings/" + l + "/orders", Map.of("delivery", "PICKUP")).body().get("id").asText();
        jdbc.sql("UPDATE orders SET ship_by = now() - interval '3 days' WHERE id = CAST(? AS uuid)").param(o).update();
        orders.housekeeping();
        JsonNode v = buyer.get("/api/orders/" + o).body();
        assertThat(v.get("status").asText()).isEqualTo("REFUNDED");
        assertThat(v.get("refundReason").asText()).isEqualTo("NOT_SHIPPED_IN_TIME");
    }

    /** Protecția vânzătorului: fără reclamație, banii ajung automat la vânzător după perioada de verificare. */
    @Test
    void sellerProtection_moneyIsReleasedAfterInspectionPeriod() {
        TestClient seller = user(), buyer = user();
        String l = listing(seller, "Monitor Dell 24");
        String o = buyer.post("/api/listings/" + l + "/orders", Map.of("delivery", "PICKUP")).body().get("id").asText();
        seller.post("/api/orders/" + o + "/ship", Map.of());
        jdbc.sql("UPDATE orders SET auto_release_at = now() - interval '1 minute' WHERE id = CAST(? AS uuid)").param(o).update();
        orders.housekeeping();
        assertThat(seller.get("/api/orders/" + o).body().get("status").asText()).isEqualTo("COMPLETED");
    }

    /** Acțiunile sensibile sunt înregistrate (GDPR art. 30/32, DSA art. 24): jurnal de audit. */
    @Test
    void auditTrail_sensitiveActionsAreLogged() {
        TestClient u = user();
        u.get("/api/me/export");
        Integer n = jdbc.sql("SELECT count(*) FROM audit_log WHERE actor_id = CAST(? AS uuid) AND action = 'DATA_EXPORT'").param(u.userId).query(Integer.class).single();
        assertThat(n).isEqualTo(1);
    }
}
