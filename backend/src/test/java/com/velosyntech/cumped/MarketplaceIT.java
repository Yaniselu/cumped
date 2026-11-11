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

    @Test
    void safePaymentHoldsMoneyUntilBuyerConfirms() {
        TestClient seller = new TestClient(port, json);
        seller.register();
        String listingId = seller.post("/api/listings", listing("Cască de moto Shoei")).body().get("id").asText();
        TestClient buyer = new TestClient(port, json);
        buyer.register();

        JsonNode quote = buyer.get("/api/listings/" + listingId + "/order-quote?delivery=COURIER&country=RO").body();
        assertThat(quote.get("feeCents").asLong()).isGreaterThan(0);
        assertThat(quote.get("totalCents").asLong()).isEqualTo(quote.get("itemCents").asLong() + quote.get("shippingCents").asLong() + quote.get("feeCents").asLong());

        Map<String, Object> addr = Map.of("name", "Ion Popescu", "address", "Str. Lalelelor 10", "city", "Cluj-Napoca",
                "postcode", "400000", "country", "RO", "phone", "+40 712 345 678");
        assertThat(buyer.post("/api/listings/" + listingId + "/orders", Map.of("delivery", "COURIER")).error()).isEqualTo("ADDRESS_REQUIRED");
        TestClient.Res created = buyer.post("/api/listings/" + listingId + "/orders", Map.of("delivery", "COURIER", "address", addr));
        assertThat(created.status()).isEqualTo(201);
        String orderId = created.body().get("id").asText();
        assertThat(created.body().get("status").asText()).isEqualTo("PAID");
        // produsul nu mai poate fi cumpărat de altcineva
        assertThat(new TestClient(port, json).get("/api/listings/" + listingId).body().get("status").asText()).isEqualTo("SOLD");

        // cumpărătorul nu poate marca expedierea; vânzătorul are nevoie de AWB
        assertThat(buyer.post("/api/orders/" + orderId + "/ship", Map.of("carrier", "SAMEDAY", "trackingCode", "1ONB123456")).status()).isEqualTo(404);
        assertThat(seller.post("/api/orders/" + orderId + "/ship", Map.of("carrier", "SAMEDAY", "trackingCode", "x")).error()).isEqualTo("TRACKING_REQUIRED");
        JsonNode shipped = seller.post("/api/orders/" + orderId + "/ship", Map.of("carrier", "SAMEDAY", "trackingCode", "1ONB123456")).body();
        assertThat(shipped.get("status").asText()).isEqualTo("SHIPPED");
        assertThat(shipped.get("shipTo").get("city").asText()).isEqualTo("Cluj-Napoca");

        // vânzătorul nu poate confirma în locul cumpărătorului
        assertThat(seller.post("/api/orders/" + orderId + "/confirm", Map.of()).status()).isEqualTo(404);
        assertThat(buyer.post("/api/orders/" + orderId + "/confirm", Map.of()).body().get("status").asText()).isEqualTo("COMPLETED");
        // comanda finalizată permite recenzia
        assertThat(buyer.post("/api/reviews", Map.of("listingId", listingId, "rating", 5, "comment", "Totul perfect")).status()).isBetween(200, 201);
    }

    @Test
    void sellerCancelRefundsAndDisputeOpensTicket() {
        TestClient seller = new TestClient(port, json);
        seller.register();
        String l1 = seller.post("/api/listings", listing("Trotinetă electrică Xiaomi")).body().get("id").asText();
        TestClient buyer = new TestClient(port, json);
        buyer.register();
        String o1 = buyer.post("/api/listings/" + l1 + "/orders", Map.of("delivery", "PICKUP")).body().get("id").asText();
        // cumpărătorul nu poate anula înainte de termenul de expediere
        assertThat(buyer.post("/api/orders/" + o1 + "/cancel", Map.of()).error()).isEqualTo("TOO_EARLY_TO_CANCEL");
        assertThat(seller.post("/api/orders/" + o1 + "/cancel", Map.of()).body().get("status").asText()).isEqualTo("REFUNDED");
        assertThat(buyer.get("/api/listings/" + l1).body().get("status").asText()).isEqualTo("ACTIVE");

        String o2 = buyer.post("/api/listings/" + l1 + "/orders", Map.of("delivery", "PICKUP")).body().get("id").asText();
        assertThat(buyer.post("/api/orders/" + o2 + "/dispute", Map.of("reason", "NOT_AS_DESCRIBED", "details", "scurt")).error()).isEqualTo("DETAILS_REQUIRED");
        JsonNode d = buyer.post("/api/orders/" + o2 + "/dispute", Map.of("reason", "NOT_AS_DESCRIBED",
                "details", "Bateria nu ține deloc, în anunț scria că ține 30 km.")).body();
        assertThat(d.get("status").asText()).isEqualTo("DISPUTED");
        int tickets = jdbc.sql("SELECT count(*) FROM support_tickets WHERE target_id = CAST(? AS uuid) AND target_type = 'ORDER'").param(o2).query(Integer.class).single();
        assertThat(tickets).isEqualTo(1);
        // banii rămân blocați: nici confirmarea, nici anularea nu mai sunt posibile
        assertThat(seller.post("/api/orders/" + o2 + "/cancel", Map.of()).error()).isEqualTo("INVALID_STATE");
    }

    @Test
    void priceAlertNotifiesWhenTargetReachedAndSellerStatsArePublic() {
        TestClient seller = new TestClient(port, json);
        JsonNode s = seller.register();
        Map<String, Object> l = listing("Monitor LG 27 inch");
        String id = seller.post("/api/listings", l).body().get("id").asText();
        long price = seller.get("/api/listings/" + id).body().get("priceCents").asLong();
        TestClient fan = new TestClient(port, json);
        fan.register();
        assertThat(fan.send("PUT", "/api/listings/" + id + "/price-alert", Map.of("targetPriceCents", price + 100), false).error()).isEqualTo("INVALID_AMOUNT");
        assertThat(fan.send("PUT", "/api/listings/" + id + "/price-alert", Map.of("targetPriceCents", price - 1000), false).status()).isEqualTo(200);
        assertThat(fan.get("/api/listings/" + id).body().get("priceAlertCents").asLong()).isEqualTo(price - 1000);
        l.put("priceCents", price - 2000);
        assertThat(seller.put("/api/listings/" + id, l).status()).isEqualTo(200);
        JsonNode notes = fan.get("/api/me/notifications").body();
        boolean reached = false;
        for (JsonNode n : notes) if ("PRICE_TARGET_REACHED".equals(n.get("type").asText())) reached = true;
        assertThat(reached).isTrue();

        JsonNode stats = new TestClient(port, json).get("/api/users/" + s.get("id").asText() + "/stats").body();
        assertThat(stats.get("lastActive").asText()).isEqualTo("TODAY");
        assertThat(stats.has("responseMinutes")).isTrue();
    }

    @Test
    void aiFeaturesNeedAnApiKey() {
        TestClient u = new TestClient(port, json);
        u.register();
        TestClient.Res r = u.post("/api/ai/listing-draft", Map.of("imageIds", java.util.List.of(java.util.UUID.randomUUID()), "lang", "ro"));
        assertThat(r.status()).isEqualTo(503);
        assertThat(r.error()).isEqualTo("AI_NOT_CONFIGURED");
    }
}
