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
    void offersPriceAndSwap() {
        TestClient seller = new TestClient(port, json);
        seller.register();
        String listingId = seller.post("/api/listings", listing("Bicicletă de oraș")).body().get("id").asText();
        TestClient buyer = new TestClient(port, json);
        buyer.register();
        assertThat(buyer.post("/api/listings/" + listingId + "/offers", Map.of("kind", "PRICE", "amountCents", 1000)).error()).isEqualTo("OFFER_TOO_LOW");
        assertThat(buyer.post("/api/listings/" + listingId + "/offers", Map.of("kind", "PRICE", "amountCents", 45000)).status()).isEqualTo(200);
        String offerId = seller.get("/api/me/offers/received").body().get(0).get("id").asText();
        assertThat(seller.post("/api/offers/" + offerId + "/accept", null).status()).isEqualTo(200);
        // După tranzacție, cumpărătorul poate lăsa recenzie; un străin nu.
        assertThat(buyer.post("/api/reviews", Map.of("listingId", listingId, "rating", 5, "comment", "Totul perfect")).status()).isEqualTo(200);
        TestClient stranger = new TestClient(port, json);
        stranger.register();
        assertThat(stranger.post("/api/reviews", Map.of("listingId", listingId, "rating", 1)).error()).isEqualTo("NO_TRANSACTION");
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
}
