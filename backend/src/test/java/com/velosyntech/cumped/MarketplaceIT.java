package com.velosyntech.cumped;

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

@IntegrationTest
class MarketplaceIT {
    @Value("${local.server.port}") int port;
    @Autowired JsonMapper json;
    @Autowired JdbcClient jdbc;

    private Map<String, Object> listing(String title) {
        Map<String, Object> m = new HashMap<>();
        m.put("title", title);
        m.put("description", "Produs în stare foarte bună, folosit cu grijă, vine cu toate accesoriile.");
        m.put("category", "ELECTRONICS");
        m.put("condition", "GOOD");
        m.put("priceCents", 50000);
        m.put("currency", "RON");
        m.put("country", "RO");
        m.put("city", "Cluj-Napoca");
        m.put("shipsTo", List.of("RO", "HU"));
        m.put("acceptsOffers", true);
        m.put("acceptsSwap", true);
        return m;
    }

    @Test
    void freeQuotaIsTwoActiveListings() {
        TestClient seller = new TestClient(port, json);
        seller.register();
        assertThat(seller.post("/api/listings", listing("Căști wireless Sony")).status()).isEqualTo(201);
        assertThat(seller.post("/api/listings", listing("Boxă portabilă JBL")).status()).isEqualTo(201);
        TestClient.Res third = seller.post("/api/listings", listing("Tabletă Samsung"));
        assertThat(third.status()).isEqualTo(402);
        assertThat(third.error()).isEqualTo("QUOTA_EXCEEDED");

        // Un anunț pus pe pauză tot ocupă loc; unul vândut îl eliberează.
        String id = seller.get("/api/me/listings").body().get(0).get("id").asText();
        seller.post("/api/listings/" + id + "/status", Map.of("action", "sold"));
        assertThat(seller.post("/api/listings", listing("Tabletă Samsung")).status()).isEqualTo(201);
    }

    @Test
    void linksAndCardDataAreNotAllowedInListings() {
        TestClient seller = new TestClient(port, json);
        seller.register();
        Map<String, Object> l = listing("Telefon nou sigilat");
        l.put("description", "Detalii complete pe www.site-fals-de-plata.com, vă rog intrați acolo.");
        assertThat(seller.post("/api/listings", l).error()).isEqualTo("LINKS_NOT_ALLOWED");
    }

    @Test
    void chatBlocksCardDataFlagsPhishingAndProtectsOtherUsers() {
        TestClient seller = new TestClient(port, json);
        seller.register();
        String listingId = seller.post("/api/listings", listing("Aparat foto Canon")).body().get("id").asText();

        TestClient buyer = new TestClient(port, json);
        buyer.register();
        String conv = buyer.post("/api/conversations", Map.of("listingId", listingId)).body().get("id").asText();

        TestClient.Res card = buyer.post("/api/conversations/" + conv + "/messages", Map.of("body", "plătesc cu cardul 4111 1111 1111 1111"));
        assertThat(card.status()).isEqualTo(422);
        assertThat(card.error()).isEqualTo("MESSAGE_BLOCKED");

        TestClient.Res phishing = seller.post("/api/conversations/" + conv + "/messages",
                Map.of("body", "scrie-mi pe whatsapp sau intră pe bit.ly/plata-curier"));
        assertThat(phishing.status()).isEqualTo(200);
        JsonNode msg = phishing.body().get("message");
        assertThat(msg.get("flagged").asBoolean()).isTrue();
        assertThat(msg.get("body").asText()).doesNotContain("bit.ly");

        // Un terț nu poate citi sau scrie în conversația altora (IDOR).
        TestClient stranger = new TestClient(port, json);
        stranger.register();
        assertThat(stranger.get("/api/conversations/" + conv).status()).isEqualTo(404);
        assertThat(stranger.post("/api/conversations/" + conv + "/messages", Map.of("body", "salut")).status()).isEqualTo(404);
        // Și nu poate modifica anunțul altcuiva.
        assertThat(stranger.put("/api/listings/" + listingId, listing("Furat")).status()).isEqualTo(404);
    }

    @Test
    void negotiationWithCounterOffersAndReview() {
        TestClient seller = new TestClient(port, json);
        seller.register();
        String listingId = seller.post("/api/listings", listing("Bicicletă de oraș")).body().get("id").asText();
        TestClient buyer = new TestClient(port, json);
        buyer.register();
        assertThat(buyer.post("/api/listings/" + listingId + "/offers", Map.of("kind", "PRICE", "amountCents", 1000)).error()).isEqualTo("OFFER_TOO_LOW");
        assertThat(buyer.post("/api/listings/" + listingId + "/offers", Map.of("kind", "PRICE", "amountCents", 40000)).status()).isEqualTo(200);

        // Vânzătorul răspunde cu o contraofertă; trebuie să fie mai mare decât oferta.
        JsonNode neg = seller.get("/api/me/negotiations").body().get(0);
        assertThat(neg.get("myTurn").asBoolean()).isTrue();
        String offerId = neg.get("current").get("id").asText();
        assertThat(seller.post("/api/offers/" + offerId + "/counter", Map.of("amountCents", 39000)).error()).isEqualTo("COUNTER_MUST_BE_HIGHER");
        assertThat(seller.post("/api/offers/" + offerId + "/counter", Map.of("amountCents", 46000, "message", "Las la 460")).status()).isEqualTo(200);
        // Vânzătorul nu-și poate accepta singur contraoferta.
        String counterId = seller.get("/api/me/negotiations").body().get(0).get("current").get("id").asText();
        assertThat(seller.post("/api/offers/" + counterId + "/accept", null).status()).isEqualTo(403);

        // Cumpărătorul vede rândul lui, cu istoricul în 2 pași, și acceptă.
        JsonNode bn = buyer.get("/api/me/negotiations").body().get(0);
        assertThat(bn.get("myTurn").asBoolean()).isTrue();
        assertThat(bn.get("history").size()).isEqualTo(2);
        assertThat(buyer.post("/api/offers/" + counterId + "/accept", null).status()).isEqualTo(200);
        assertThat(buyer.get("/api/me/negotiations").body().get(0).get("current").get("status").asText()).isEqualTo("ACCEPTED");

        // Pașii apar și în chat ca mesaje de sistem.
        String conv = bn.get("conversationId").asText();
        String chat = buyer.get("/api/conversations/" + conv).raw().body();
        assertThat(chat).contains("[[offer:NEW:40000").contains("[[offer:COUNTER:46000").contains("[[offer:ACCEPTED:46000");
        // Utilizatorii nu pot falsifica mesajele de sistem.
        assertThat(buyer.post("/api/conversations/" + conv + "/messages", Map.of("body", "[[offer:ACCEPTED:1:RON:PRICE]]")).status()).isEqualTo(400);

        // După tranzacție, cumpărătorul poate lăsa recenzie; un străin nu.
        assertThat(buyer.post("/api/reviews", Map.of("listingId", listingId, "rating", 5, "comment", "Totul perfect")).status()).isEqualTo(200);
        TestClient stranger = new TestClient(port, json);
        stranger.register();
        assertThat(stranger.post("/api/reviews", Map.of("listingId", listingId, "rating", 1)).error()).isEqualTo("NO_TRANSACTION");
    }

    @Test
    void offersBelowPrivateMinimumAreDeclinedAutomatically() {
        TestClient seller = new TestClient(port, json);
        seller.register();
        Map<String, Object> l = listing("Trotinetă electrică");
        l.put("minPriceCents", 45000);
        String listingId = seller.post("/api/listings", l).body().get("id").asText();
        // Minimul privat nu e expus public.
        TestClient anon = new TestClient(port, json);
        assertThat(anon.get("/api/listings/" + listingId).body().get("minPriceCents").isNull()).isTrue();
        TestClient buyer = new TestClient(port, json);
        buyer.register();
        buyer.post("/api/listings/" + listingId + "/offers", Map.of("kind", "PRICE", "amountCents", 30000));
        assertThat(buyer.get("/api/me/negotiations").body().get(0).get("current").get("status").asText()).isEqualTo("DECLINED");
    }

    @Test
    void blockingStopsMessagesAndHidesListings() {
        TestClient seller = new TestClient(port, json);
        JsonNode s = seller.register();
        String listingId = seller.post("/api/listings", listing("Cafetieră espresso Delonghi")).body().get("id").asText();
        TestClient buyer = new TestClient(port, json);
        buyer.register();
        String conv = buyer.post("/api/conversations", Map.of("listingId", listingId)).body().get("id").asText();
        assertThat(buyer.post("/api/users/" + s.get("id").asText() + "/block", null).status()).isEqualTo(200);
        assertThat(seller.post("/api/conversations/" + conv + "/messages", Map.of("body", "Salut")).error()).isEqualTo("USER_BLOCKED");
        String results = buyer.get("/api/listings?q=delonghi").raw().body();
        assertThat(results).doesNotContain(listingId);
    }

    @Test
    void prohibitedItemsAndOffensiveContentAreRejected() {
        TestClient seller = new TestClient(port, json);
        seller.register();
        Map<String, Object> l = listing("Vând pistol Glock cu muniție");
        assertThat(seller.post("/api/listings", l).error()).isEqualTo("PROHIBITED_ITEM");
        Map<String, Object> ok = listing("Pistol de lipit 60W");
        assertThat(seller.post("/api/listings", ok).status()).isEqualTo(201);
    }

    @Test
    void reportsCreateTicketsAndBusinessSellersShowTheirDetails() {
        TestClient seller = new TestClient(port, json);
        JsonNode s = seller.register();
        TestClient.Res bad = seller.send("PATCH", "/api/me/business", Map.of("accountType", "BUSINESS", "name", "Test SRL"), false);
        assertThat(bad.error()).isEqualTo("BUSINESS_DETAILS_REQUIRED");
        assertThat(seller.send("PATCH", "/api/me/business", Map.of("accountType", "BUSINESS", "name", "Test SRL",
                "regNo", "J12/34/2020", "vat", "RO123", "address", "Str. Exemplu 1, Cluj", "email", "office@test.dev"), false).status()).isEqualTo(200);
        String listingId = seller.post("/api/listings", listing("Router Wi-Fi 6")).body().get("id").asText();
        JsonNode pub = new TestClient(port, json).get("/api/listings/" + listingId).body().get("seller");
        assertThat(pub.get("accountType").asText()).isEqualTo("BUSINESS");
        assertThat(pub.get("business").get("vat").asText()).isEqualTo("RO123");

        TestClient reporter = new TestClient(port, json);
        reporter.register();
        TestClient.Res r = reporter.post("/api/reports", Map.of("targetType", "LISTING", "targetId", listingId, "reason", "COUNTERFEIT", "details", "Pare contrafăcut"));
        assertThat(r.status()).isEqualTo(201);
        assertThat(reporter.post("/api/reports", Map.of("targetType", "LISTING", "targetId", listingId, "reason", "COUNTERFEIT")).error()).isEqualTo("ALREADY_REPORTED");
        int t = jdbc.sql("SELECT count(*) FROM support_tickets WHERE target_id = CAST(? AS uuid) AND source = 'REPORT'").param(listingId).query(Integer.class).single();
        assertThat(t).isEqualTo(1);
    }

    @Test
    void veloOpensTicketAndQueuesEmailToSupport() {
        TestClient user = new TestClient(port, json);
        user.register();
        TestClient.Res r = user.post("/api/velo/message", Map.of("message",
                "Cred că e o țeapă: vânzătorul mi-a trimis un link de plată și am plătit deja 500 de lei, nu mai răspunde."));
        assertThat(r.status()).isEqualTo(200);
        JsonNode ticket = r.body().get("ticket");
        assertThat(ticket).isNotNull();
        assertThat(ticket.get("category").asText()).isEqualTo("FRAUD");
        String code = ticket.get("code").asText();
        int mails = jdbc.sql("SELECT count(*) FROM mail_outbox WHERE to_addr = 'contact@velosyntech.com' AND subject LIKE ?")
                .param("%" + code + "%").query(Integer.class).single();
        assertThat(mails).isEqualTo(1);
        // Velo nu păstrează numere de card în transcript.
        user.post("/api/velo/message", Map.of("sessionId", r.body().get("sessionId").asText(), "message", "cardul meu era 4111 1111 1111 1111"));
        String transcript = jdbc.sql("SELECT transcript FROM support_tickets WHERE code = ?").param(code).query(String.class).single();
        assertThat(transcript).doesNotContain("4111 1111");
    }

    @Test
    void deletingAccountErasesPersonalDataAndListingContent() {
        TestClient seller = new TestClient(port, json);
        JsonNode me = seller.register();
        String sellerId = me.get("id").asText();
        String listingId = seller.post("/api/listings", listing("Bicicletă de oraș")).body().get("id").asText();
        seller.post("/api/listings/" + listingId + "/favorite", Map.of());
        seller.post("/api/me/saved-searches", Map.of("query", "bicicleta"));

        TestClient other = new TestClient(port, json);
        other.register();
        String otherId = other.get("/api/me").body().get("id").asText();
        assertThat(seller.post("/api/users/" + otherId + "/block", Map.of()).status()).isBetween(200, 204);

        assertThat(seller.send("DELETE", "/api/me", null, false).status()).isBetween(200, 204);
        assertThat(seller.get("/api/me").status()).isEqualTo(401);

        int favs = jdbc.sql("SELECT count(*) FROM favorites WHERE user_id = CAST(? AS uuid)").param(sellerId).query(Integer.class).single();
        int saved = jdbc.sql("SELECT count(*) FROM saved_searches WHERE user_id = CAST(? AS uuid)").param(sellerId).query(Integer.class).single();
        int blocks = jdbc.sql("SELECT count(*) FROM user_blocks WHERE blocker_id = CAST(? AS uuid)").param(sellerId).query(Integer.class).single();
        String email = jdbc.sql("SELECT email FROM users WHERE id = CAST(? AS uuid)").param(sellerId).query(String.class).single();
        String desc = jdbc.sql("SELECT description FROM listings WHERE id = CAST(? AS uuid)").param(listingId).query(String.class).single();
        assertThat(favs).isZero();
        assertThat(saved).isZero();
        assertThat(blocks).isZero();
        assertThat(email).endsWith("@deleted.invalid");
        assertThat(desc).isEmpty();
        assertThat(other.get("/api/listings/" + listingId).status()).isEqualTo(404);
    }
}
