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
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Recenzii doar de la cumpărători reali și protecția vânzătorului la reclamații
 * (cazul „vând o geacă de 600 €, cumpărătorul spune că a primit altceva”).
 */
@IntegrationTest
class ReviewsAndDisputesIT {
    @Value("${local.server.port}") int port;
    @Autowired JsonMapper json;
    @Autowired JdbcClient jdbc;
    @Autowired OrderService orderService;

    private TestClient user() {
        TestClient c = new TestClient(port, json);
        c.register();
        return c;
    }

    private TestClient admin() {
        TestClient a = user();
        jdbc.sql("UPDATE users SET role = 'ADMIN' WHERE id = CAST(? AS uuid)").param(a.userId).update();
        a.relogin();
        return a;
    }

    private String listing(TestClient seller, String title, long priceCents, String currency) {
        Map<String, Object> m = new HashMap<>();
        m.put("title", title);
        m.put("description", "Produs original, în stare foarte bună, cu factură și etichete. Trimit oriunde în țară.");
        m.put("category", "FASHION");
        m.put("condition", "LIKE_NEW");
        m.put("priceCents", priceCents);
        m.put("currency", currency);
        m.put("country", "RO");
        m.put("city", "Cluj-Napoca");
        m.put("shipsTo", List.of("RO"));
        m.put("acceptsOffers", true);
        m.put("acceptsSwap", false);
        TestClient.Res r = seller.post("/api/listings", m);
        assertThat(r.status()).as(r.raw().body()).isIn(200, 201);
        return r.body().get("id").asText();
    }

    private static final Map<String, Object> ADDR = Map.of("name", "Ana Pop", "address", "Str. Florilor 3", "city", "Iași",
            "postcode", "700000", "country", "RO", "phone", "+40 733 111 222");

    private String order(TestClient buyer, String listingId, String delivery) {
        TestClient.Res r = buyer.post("/api/listings/" + listingId + "/orders",
                "COURIER".equals(delivery) ? Map.of("delivery", delivery, "address", ADDR) : Map.of("delivery", delivery));
        assertThat(r.status()).as(r.raw().body()).isEqualTo(201);
        return r.body().get("id").asText();
    }

    private String completedOrder(TestClient seller, TestClient buyer) {
        String l = listing(seller, "Pantofi sport Nike", 30000, "RON");
        String o = order(buyer, l, "PICKUP");
        assertThat(seller.post("/api/orders/" + o + "/ship", Map.of()).status()).isEqualTo(200);
        assertThat(buyer.post("/api/orders/" + o + "/confirm", Map.of()).body().get("status").asText()).isEqualTo("COMPLETED");
        return o;
    }

    // ---------------- recenzii ----------------

    @Test
    void onlyRealBuyersOfThatSellerCanReview() {
        TestClient seller = user(), buyer = user(), stranger = user();
        String l = listing(seller, "Geacă de piele", 40000, "RON");
        String o = order(buyer, l, "PICKUP");

        // comanda plătită dar neconfirmată nu dă încă drept de recenzie
        assertThat(buyer.post("/api/reviews", Map.of("orderId", o, "rating", 5)).error()).isEqualTo("NO_TRANSACTION");
        // un străin nu poate recenza o comandă care nu e a lui (nici nu află că există)
        assertThat(stranger.post("/api/reviews", Map.of("orderId", o, "rating", 1)).status()).isEqualTo(404);
        assertThat(stranger.post("/api/reviews", Map.of("orderId", UUID.randomUUID(), "rating", 1)).status()).isEqualTo(404);

        seller.post("/api/orders/" + o + "/ship", Map.of());
        buyer.post("/api/orders/" + o + "/confirm", Map.of());
        assertThat(buyer.get("/api/orders/" + o + "/review-status").body().get("reviewed").asBoolean()).isFalse();
        assertThat(buyer.post("/api/reviews", Map.of("orderId", o, "rating", 5, "comment", "Exact ca în poze, mulțumesc!")).status()).isEqualTo(200);
        assertThat(buyer.get("/api/orders/" + o + "/review-status").body().get("reviewed").asBoolean()).isTrue();
        // o singură recenzie per comandă
        assertThat(buyer.post("/api/reviews", Map.of("orderId", o, "rating", 1)).error()).isEqualTo("ALREADY_REVIEWED");
        // și vânzătorul îl poate evalua pe cumpărător (o dată)
        assertThat(seller.post("/api/reviews", Map.of("orderId", o, "rating", 5, "comment", "Plată rapidă")).status()).isEqualTo(200);

        JsonNode list = stranger.get("/api/users/" + seller.userId + "/reviews").body();
        assertThat(list.size()).isEqualTo(1);
        assertThat(list.get(0).get("verifiedPurchase").asBoolean()).isTrue();
        assertThat(list.get(0).get("reviewerRole").asText()).isEqualTo("BUYER");
        JsonNode aboutBuyer = stranger.get("/api/users/" + buyer.userId + "/reviews").body();
        assertThat(aboutBuyer.get(0).get("reviewerRole").asText()).isEqualTo("SELLER");
    }

    @Test
    void reviewsRejectTamperingSpamAndLateSubmissions() {
        TestClient seller = user(), buyer = user();
        String o = completedOrder(seller, buyer);
        // rating în afara intervalului 1–5
        assertThat(buyer.post("/api/reviews", Map.of("orderId", o, "rating", 6)).status()).isEqualTo(400);
        assertThat(buyer.post("/api/reviews", Map.of("orderId", o, "rating", 0)).status()).isEqualTo(400);
        // câmpuri în plus (ex. a forța insigna „verificat” sau alt autor) sunt respinse
        assertThat(buyer.post("/api/reviews", Map.of("orderId", o, "rating", 5, "verifiedPurchase", true)).status()).isEqualTo(400);
        assertThat(buyer.post("/api/reviews", Map.of("orderId", o, "rating", 5, "reviewerId", seller.userId)).status()).isEqualTo(400);
        // fără linkuri (spam / phishing)
        assertThat(buyer.post("/api/reviews", Map.of("orderId", o, "rating", 5, "comment", "Vezi aici https://evil.example")).error()).isEqualTo("LINKS_NOT_ALLOWED");
        // după 30 de zile fereastra se închide
        jdbc.sql("UPDATE orders SET completed_at = now() - interval '31 days' WHERE id = CAST(? AS uuid)").param(o).update();
        assertThat(buyer.post("/api/reviews", Map.of("orderId", o, "rating", 1)).error()).isEqualTo("REVIEW_WINDOW_CLOSED");
    }

    @Test
    void refundedOrdersAndOwnListingsGiveNoReviewRight() {
        TestClient seller = user(), buyer = user();
        String l = listing(seller, "Rucsac de oraș", 10000, "RON");
        String o = order(buyer, l, "PICKUP");
        seller.post("/api/orders/" + o + "/cancel", Map.of());
        assertThat(buyer.post("/api/reviews", Map.of("orderId", o, "rating", 1)).error()).isEqualTo("NO_TRANSACTION");
        // nu-ți poți cumpăra propriul anunț (deci nici să-ți dai singur recenzii)
        String own = listing(seller, "Șapcă de vară", 5000, "RON");
        assertThat(seller.post("/api/listings/" + own + "/orders", Map.of("delivery", "PICKUP")).status()).isBetween(400, 409);
    }

    // ---------------- protecția vânzătorului ----------------

    @Test
    void expensiveCourierOrderRequiresShippingProof() {
        TestClient seller = user(), buyer = user();
        String l = listing(seller, "Geacă Moncler originală", 60000, "EUR");
        String o = order(buyer, l, "COURIER");
        JsonNode v = buyer.get("/api/orders/" + o).body();
        assertThat(v.get("proofRequired").asBoolean()).isTrue();
        Map<String, Object> ship = new HashMap<>(Map.of("carrier", "FAN_COURIER", "trackingCode", "FAN123456789"));
        assertThat(seller.post("/api/orders/" + o + "/ship", ship).error()).isEqualTo("SHIP_PROOF_REQUIRED");
        // poze care nu sunt ale vânzătorului nu pot fi folosite ca dovadă
        ship.put("proofImageIds", List.of(buyer.uploadPhoto(), buyer.uploadPhoto()));
        assertThat(seller.post("/api/orders/" + o + "/ship", ship).error()).isEqualTo("INVALID_IMAGE");
        ship.put("proofImageIds", List.of(seller.uploadPhoto(), seller.uploadPhoto()));
        ship.put("serialNumber", "mcl-2026-778899");
        ship.put("parcelWeightGrams", 1450);
        JsonNode shipped = seller.post("/api/orders/" + o + "/ship", ship).body();
        assertThat(shipped.get("status").asText()).isEqualTo("SHIPPED");
        assertThat(shipped.get("evidence").get("serialNumber").asText()).isEqualTo("MCL2026778899");
        assertThat(shipped.get("evidence").get("parcelWeightGrams").asInt()).isEqualTo(1450);
        assertThat(shipped.get("evidence").get("shipProof").size()).isEqualTo(2);
    }

    @Test
    void vintedCaseFalseClaimIsNotBelievedOnWordAlone() {
        TestClient seller = user(), buyer = user(), admin = admin();
        String l = listing(seller, "Geacă de iarnă 600 €", 60000, "EUR");
        String o = order(buyer, l, "COURIER");
        seller.post("/api/orders/" + o + "/ship", Map.of("carrier", "SAMEDAY", "trackingCode", "1ONB99887766",
                "serialNumber", "JKT-600-ABCD", "proofImageIds", List.of(seller.uploadPhoto(), seller.uploadPhoto())));

        String details = "Am primit o altă geacă, mai ieftină, nu cea din anunț.";
        // „am primit altceva” fără poze: respins
        assertThat(buyer.post("/api/orders/" + o + "/dispute", Map.of("reason", "NOT_AS_DESCRIBED", "details", details)).error()).isEqualTo("EVIDENCE_REQUIRED");
        List<String> photos = List.of(buyer.uploadPhoto(), buyer.uploadPhoto());
        // vânzătorul a înregistrat seria: cumpărătorul trebuie s-o scrie pe cea de pe produsul primit
        assertThat(buyer.post("/api/orders/" + o + "/dispute", Map.of("reason", "NOT_AS_DESCRIBED", "details", details,
                "evidenceImageIds", photos)).error()).isEqualTo("SERIAL_REQUIRED");
        // pozele anunțului nu pot fi refolosite ca „dovadă”
        String listingPhoto = seller.uploadPhoto();
        assertThat(buyer.post("/api/orders/" + o + "/dispute", Map.of("reason", "NOT_AS_DESCRIBED", "details", details,
                "evidenceImageIds", List.of(listingPhoto, photos.get(0)), "serialNumber", "X1234")).error()).isEqualTo("INVALID_IMAGE");

        JsonNode d = buyer.post("/api/orders/" + o + "/dispute", Map.of("reason", "NOT_AS_DESCRIBED", "details", details,
                "evidenceImageIds", photos, "serialNumber", "JKT-600-ABCD")).body();
        assertThat(d.get("status").asText()).isEqualTo("DISPUTED");
        // seria scrisă de cumpărător e aceeași cu cea de la expediere: semn că a primit exact produsul trimis
        assertThat(d.get("evidence").get("serialMismatch").asBoolean()).isFalse();
        // banii NU ajung automat la cumpărător
        assertThat(d.get("canConfirm").asBoolean()).isFalse();

        // vânzătorul răspunde cu dovezile lui, o singură dată; cumpărătorul nu poate răspunde în locul lui
        assertThat(buyer.post("/api/orders/" + o + "/respond", Map.of("statement", "Am trimis exact geaca din anunț.")).status()).isEqualTo(404);
        JsonNode r = seller.post("/api/orders/" + o + "/respond", Map.of("statement", "Am trimis exact geaca din anunț, vezi pozele cu seria.",
                "evidenceImageIds", List.of(seller.uploadPhoto()))).body();
        assertThat(r.get("evidence").get("sellerResponse").asText()).contains("exact geaca");
        assertThat(r.get("canRespond").asBoolean()).isFalse();
        assertThat(seller.post("/api/orders/" + o + "/respond", Map.of("statement", "Încă o dată, a doua oară.")).error()).isEqualTo("INVALID_STATE");

        // echipa vede istoricul cumpărătorului și decide: reclamația nu e susținută -> vânzătorul e plătit
        JsonNode queue = admin.get("/api/admin/orders/disputed").body();
        JsonNode mine = null;
        for (JsonNode q : queue) if (q.get("order").get("id").asText().equals(o)) mine = q;
        assertThat(mine).isNotNull();
        assertThat(mine.get("buyerDisputes90d").asInt()).isEqualTo(1);
        assertThat(buyer.get("/api/admin/orders/disputed").status()).isEqualTo(403);
        assertThat(admin.post("/api/admin/orders/" + o + "/resolve", Map.of("outcome", "RELEASE")).status()).isEqualTo(200);
        assertThat(seller.get("/api/orders/" + o).body().get("status").asText()).isEqualTo("COMPLETED");
        String against = jdbc.sql("SELECT resolved_against FROM orders WHERE id = CAST(? AS uuid)").param(o).query(String.class).single();
        assertThat(against).isEqualTo("BUYER");
    }

    @Test
    void refundOnlyAfterTheItemIsReturnedToTheSeller() {
        TestClient seller = user(), buyer = user(), admin = admin();
        String l = listing(seller, "Bocanci de munte", 50000, "RON");
        String o = order(buyer, l, "COURIER");
        seller.post("/api/orders/" + o + "/ship", Map.of("carrier", "CARGUS", "trackingCode", "CG12345678"));
        buyer.post("/api/orders/" + o + "/dispute", Map.of("reason", "DAMAGED", "details", "Talpa e dezlipită complet la ambii bocanci.",
                "evidenceImageIds", List.of(buyer.uploadPhoto(), buyer.uploadPhoto())));
        // echipa cere returnarea: încă nu se dau banii înapoi
        admin.post("/api/admin/orders/" + o + "/resolve", Map.of("outcome", "RETURN"));
        JsonNode v = buyer.get("/api/orders/" + o).body();
        assertThat(v.get("status").asText()).isEqualTo("RETURN_REQUESTED");
        assertThat(v.get("canReturnShip").asBoolean()).isTrue();
        // vânzătorul nu poate confirma primirea până nu e trimis coletul înapoi
        assertThat(seller.post("/api/orders/" + o + "/return-received", Map.of("sameCondition", true)).error()).isEqualTo("INVALID_STATE");
        assertThat(buyer.post("/api/orders/" + o + "/return-ship", Map.of("carrier", "CARGUS", "trackingCode", "x")).error()).isEqualTo("TRACKING_REQUIRED");
        assertThat(buyer.post("/api/orders/" + o + "/return-ship", Map.of("carrier", "CARGUS", "trackingCode", "CG87654321")).status()).isEqualTo(200);
        JsonNode done = seller.post("/api/orders/" + o + "/return-received", Map.of("sameCondition", true)).body();
        assertThat(done.get("status").asText()).isEqualTo("REFUNDED");
        assertThat(buyer.get("/api/listings/" + l).body().get("status").asText()).isEqualTo("ACTIVE");
    }

    @Test
    void returnWithDifferentItemGoesBackToTheTeam() {
        TestClient seller = user(), buyer = user(), admin = admin();
        String l = listing(seller, "Telefon", 90000, "RON");
        String o = order(buyer, l, "COURIER");
        seller.post("/api/orders/" + o + "/ship", Map.of("carrier", "DPD", "trackingCode", "DPD1234567", "serialNumber", "IMEI356938035643809",
                "proofImageIds", List.of(seller.uploadPhoto(), seller.uploadPhoto())));
        buyer.post("/api/orders/" + o + "/dispute", Map.of("reason", "NOT_AS_DESCRIBED", "details", "Ecranul are o zgârietură mare.",
                "evidenceImageIds", List.of(buyer.uploadPhoto(), buyer.uploadPhoto()), "serialNumber", "IMEI111111111111111"));
        // seria raportată diferă de cea înregistrată: echipa vede imediat
        JsonNode v = admin.get("/api/admin/orders/disputed").body();
        boolean flagged = false;
        for (JsonNode q : v) if (q.get("order").get("id").asText().equals(o)) flagged = q.get("order").get("evidence").get("serialMismatch").asBoolean();
        assertThat(flagged).isTrue();
        admin.post("/api/admin/orders/" + o + "/resolve", Map.of("outcome", "RETURN"));
        buyer.post("/api/orders/" + o + "/return-ship", Map.of("carrier", "DPD", "trackingCode", "DPD7654321"));
        // vânzătorul primește înapoi alt telefon: nu se rambursează, decide echipa
        assertThat(seller.post("/api/orders/" + o + "/return-received", Map.of("sameCondition", false)).error()).isEqualTo("DETAILS_REQUIRED");
        JsonNode back = seller.post("/api/orders/" + o + "/return-received", Map.of("sameCondition", false,
                "note", "Am primit înapoi alt telefon, IMEI diferit de cel din poze.")).body();
        assertThat(back.get("status").asText()).isEqualTo("DISPUTED");
    }

    @Test
    void buyerWhoDoesNotSendItemBackLosesTheClaim() {
        TestClient seller = user(), buyer = user(), admin = admin();
        String l = listing(seller, "Geantă de piele", 70000, "RON");
        String o = order(buyer, l, "COURIER");
        seller.post("/api/orders/" + o + "/ship", Map.of("carrier", "GLS", "trackingCode", "GLS12345678"));
        buyer.post("/api/orders/" + o + "/dispute", Map.of("reason", "COUNTERFEIT", "details", "Cred că geanta nu e originală.",
                "evidenceImageIds", List.of(buyer.uploadPhoto(), buyer.uploadPhoto())));
        admin.post("/api/admin/orders/" + o + "/resolve", Map.of("outcome", "RETURN"));
        jdbc.sql("UPDATE orders SET return_by = now() - interval '1 hour' WHERE id = CAST(? AS uuid)").param(o).update();
        orderService.housekeeping();
        assertThat(seller.get("/api/orders/" + o).body().get("status").asText()).isEqualTo("COMPLETED");
    }

    @Test
    void evidencePhotosArePrivateAndLinksAreSigned() {
        TestClient seller = user(), buyer = user();
        String l = listing(seller, "Ceas de mână", 20000, "RON");
        String o = order(buyer, l, "PICKUP");
        String p1 = buyer.uploadPhoto(), p2 = buyer.uploadPhoto();
        JsonNode d = buyer.post("/api/orders/" + o + "/dispute", Map.of("reason", "DAMAGED", "details", "Geamul ceasului e spart.",
                "evidenceImageIds", List.of(p1, p2))).body();
        String signed = d.get("evidence").get("disputeEvidence").get(0).asText();
        assertThat(signed).contains("sig=").contains("exp=");
        // linkul semnat merge, linkul simplu sau modificat nu
        assertThat(buyer.fetchStatus(signed)).isEqualTo(200);
        assertThat(buyer.fetchStatus("/api/media/" + p1)).isEqualTo(404);
        assertThat(buyer.fetchStatus(signed.replaceAll("sig=.", "sig=A"))).isEqualTo(404);
        assertThat(buyer.fetchStatus(signed.replaceAll("exp=\\d+", "exp=9999999999"))).isEqualTo(404);
        // un străin nu vede comanda (deci nici linkurile)
        assertThat(user().get("/api/orders/" + o).status()).isEqualTo(404);
        // pozele-dovadă nu pot fi mutate într-un anunț și nu sunt șterse de curățenia automată
        Map<String, Object> m = new HashMap<>(Map.of("title", "Test dovadă", "description", "Descriere suficient de lungă pentru un anunț de test.",
                "category", "OTHER", "condition", "GOOD", "priceCents", 1000, "currency", "RON", "country", "RO", "city", "Iași"));
        m.put("acceptsOffers", false);
        m.put("acceptsSwap", false);
        m.put("imageIds", List.of(p1));
        assertThat(buyer.post("/api/listings", m).status()).isBetween(400, 403);
    }

    @Test
    void cannotDeleteAccountToEscapeAnOpenOrder() {
        TestClient seller = user(), buyer = user();
        String l = listing(seller, "Bicicletă", 80000, "RON");
        order(buyer, l, "PICKUP");
        assertThat(buyer.send("DELETE", "/api/me", null, false).error()).isEqualTo("OPEN_ORDERS");
        assertThat(seller.send("DELETE", "/api/me", null, false).error()).isEqualTo("OPEN_ORDERS");
    }

    @Test
    void shippingAddressIsEncryptedAndPurgedAfter90Days() {
        TestClient seller = user(), buyer = user();
        String l = listing(seller, "Lampă de birou", 15000, "RON");
        String o = order(buyer, l, "COURIER");
        String raw = jdbc.sql("SELECT ship_name || ship_address || ship_city || ship_postcode || ship_phone FROM orders WHERE id = CAST(? AS uuid)")
                .param(o).query(String.class).single();
        assertThat(raw).doesNotContain("Ana").doesNotContain("Florilor").doesNotContain("Iași").doesNotContain("733");
        assertThat(seller.get("/api/orders/" + o).body().get("shipTo").get("address").asText()).isEqualTo("Str. Florilor 3");
        seller.post("/api/orders/" + o + "/ship", Map.of("carrier", "FAN_COURIER", "trackingCode", "FAN55556666"));
        buyer.post("/api/orders/" + o + "/confirm", Map.of());
        jdbc.sql("UPDATE orders SET completed_at = now() - interval '91 days' WHERE id = CAST(? AS uuid)").param(o).update();
        orderService.housekeeping();
        Integer left = jdbc.sql("SELECT count(*) FROM orders WHERE id = CAST(? AS uuid) AND ship_address IS NULL AND ship_phone IS NULL")
                .param(o).query(Integer.class).single();
        assertThat(left).isEqualTo(1);
    }
}
