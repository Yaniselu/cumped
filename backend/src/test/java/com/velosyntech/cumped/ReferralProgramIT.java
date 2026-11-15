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
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Programul de invitații: doar prietenii cu identitatea verificată contează; la fiecare 10, invitatorul primește
 * +1 anunț pentru 30 de zile și o promovare gratuită; prietenul primește o ridicare gratuită.
 */
@IntegrationTest
class ReferralProgramIT {
    @Value("${local.server.port}") int port;
    @Autowired JsonMapper json;
    @Autowired JdbcClient jdbc;

    private TestClient invited(String code, boolean verify) {
        TestClient c = new TestClient(port, json);
        String sfx = UUID.randomUUID().toString().substring(0, 8);
        Map<String, Object> m = new HashMap<>();
        m.put("email", "r" + sfx + "@test.dev");
        m.put("password", "Sigur-Parola-2026!");
        m.put("username", "r_" + sfx);
        m.put("referralCode", code);
        m.put("acceptTerms", true);
        m.put("adultConfirmed", true);
        m.put("website", "");
        m.put("elapsedMs", 6000);
        TestClient.Res r = c.post("/api/auth/register", m);
        assertThat(r.status()).as(r.raw().body()).isEqualTo(201);
        c.token = r.body().get("accessToken").asText();
        c.userId = r.body().get("user").get("id").asText();
        if (verify) assertThat(c.post("/api/verification/identity/dev-complete", Map.of("firstName", "ana", "lastName", "pop")).status()).isEqualTo(200);
        return c;
    }

    @Test
    void everyTenVerifiedFriendsEarnARewardAndFriendsGetABump() {
        TestClient inviter = new TestClient(port, json);
        inviter.register();
        String code = inviter.get("/api/me").body().get("referralCode").asText();

        // înscriși, dar neverificați (sau doar cu telefonul): nu contează
        invited(code, false);
        TestClient friend = invited(code, true);
        JsonNode ov = inviter.get("/api/me/referrals").body();
        assertThat(ov.get("registered").asLong()).isEqualTo(2);
        assertThat(ov.get("verified").asLong()).isEqualTo(1);
        assertThat(ov.get("toNext").asInt()).isEqualTo(9);
        assertThat(ov.get("link").asText()).endsWith("/register?ref=" + code);
        assertThat(ov.get("friends").toString()).doesNotContain("@test.dev");

        // prietenul are o ridicare gratuită și o poate folosi pe anunțul lui
        assertThat(friend.get("/api/me/referrals").body().get("credits").get("BUMP").asInt()).isEqualTo(1);
        Map<String, Object> l = new HashMap<>(Map.of("title", "Geacă de iarnă mărimea M", "description", "Geacă purtată un sezon, fără defecte, foarte călduroasă.",
                "category", "FASHION", "condition", "GOOD", "priceCents", 20000, "currency", "RON", "country", "RO", "city", "Iași"));
        l.put("shipsTo", List.of("RO")); l.put("acceptsOffers", true); l.put("acceptsSwap", false);
        String listing = friend.post("/api/listings", l).body().get("id").asText();
        assertThat(friend.post("/api/billing/redeem", Map.of("product", "BUMP", "listingId", listing)).status()).isEqualTo(200);
        assertThat(friend.post("/api/billing/redeem", Map.of("product", "BUMP", "listingId", listing)).error()).isEqualTo("NO_CREDIT");

        // încă 9 verificați → prima recompensă: limita permanentă 5 + 1 anunț pe 30 de zile + promovare
        for (int i = 0; i < 9; i++) invited(code, true);
        JsonNode me = inviter.get("/api/me").body();
        assertThat(me.get("quota").get("limit").asInt()).isEqualTo(5 + 1);
        ov = inviter.get("/api/me/referrals").body();
        assertThat(ov.get("verified").asLong()).isEqualTo(10);
        assertThat(ov.get("rewards").size()).isEqualTo(1);
        assertThat(ov.get("activeRewardSlots").asInt()).isEqualTo(1);
        assertThat(ov.get("credits").get("PROMOTE_7D").asInt()).isEqualTo(1);
        assertThat(ov.get("toNext").asInt()).isEqualTo(10);
        assertThat(inviter.get("/api/me/notifications").raw().body()).contains("REFERRAL_REWARD");

        // a doua tură de 10 → încă un loc (30 de zile) și încă o promovare
        for (int i = 0; i < 10; i++) invited(code, true);
        assertThat(inviter.get("/api/me").body().get("quota").get("limit").asInt()).isEqualTo(5 + 2);
        assertThat(inviter.get("/api/me/referrals").body().get("rewards").size()).isEqualTo(2);
        // locurile câștigate expiră după 30 de zile
        Integer days = jdbc.sql("SELECT max(extract(day from expires_at - created_at))::int FROM purchased_slots WHERE user_id = CAST(? AS uuid) AND source = 'REFERRAL'")
                .param(inviter.userId).query(Integer.class).single();
        assertThat(days).isBetween(29, 30);
    }
}
