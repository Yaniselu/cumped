package com.velosyntech.cumped;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

@IntegrationTest
class AuthSecurityIT {
    @Value("${local.server.port}") int port;
    @Autowired JsonMapper json;
    TestClient c;

    @BeforeEach
    void setUp() { c = new TestClient(port, json); }

    @Test
    void registerLoginAndProfileDoNotLeakData() {
        JsonNode me = c.register();
        assertThat(me.get("quota").get("limit").asInt()).isEqualTo(2);
        assertThat(c.get("/api/me").status()).isEqualTo(200);

        TestClient anon = new TestClient(port, json);
        TestClient.Res pub = anon.get("/api/users/" + me.get("id").asText());
        assertThat(pub.status()).isEqualTo(200);
        assertThat(pub.raw().body()).doesNotContain("@test.dev").doesNotContain("passwordHash").doesNotContain("legal");
    }

    @Test
    void wrongPasswordIsGenericAndWeakPasswordIsRejected() {
        TestClient.Res r = c.post("/api/auth/login", Map.of("email", "nobody@test.dev", "password", "whatever-123"));
        assertThat(r.status()).isEqualTo(401);
        assertThat(r.error()).isEqualTo("INVALID_CREDENTIALS");

        TestClient.Res weak = c.post("/api/auth/register", Map.of("email", "weak@test.dev", "password", "1234567890", "username", "weakling",
                "acceptTerms", true, "adultConfirmed", true));
        assertThat(weak.error()).isEqualTo("WEAK_PASSWORD");

        // Fără acordul cu Termenii și confirmarea vârstei, contul nu se creează.
        TestClient.Res noTerms = c.post("/api/auth/register", Map.of("email", "noterms@test.dev", "password", "Sigur-Parola-2026!", "username", "noterms_1"));
        assertThat(noTerms.error()).isEqualTo("TERMS_REQUIRED");
    }

    @Test
    void refreshNeedsCsrfHeaderAndDetectsTokenReuse() {
        c.register();
        assertThat(c.post("/api/auth/refresh", null).status()).isEqualTo(403); // fără header anti-CSRF
        String firstCookie = c.raw("cmp_rt");
        assertThat(c.postCsrf("/api/auth/refresh").status()).isEqualTo(200); // rotire

        // Un atacator refolosește token-ul vechi: e respins și toată familia de sesiuni e revocată.
        TestClient attacker = new TestClient(port, json);
        attacker.setCookie("cmp_rt", firstCookie);
        assertThat(attacker.postCsrf("/api/auth/refresh").status()).isEqualTo(401);
        assertThat(c.postCsrf("/api/auth/refresh").status()).isEqualTo(401);
    }

    @Test
    void logoutEverywhereInvalidatesAccessTokens() {
        c.register();
        String old = c.token;
        assertThat(c.postCsrf("/api/auth/logout-all").status()).isEqualTo(204);
        c.token = old;
        assertThat(c.get("/api/me").status()).isEqualTo(401);
    }

    @Test
    void accessControlAndErrorShape() {
        TestClient anon = new TestClient(port, json);
        TestClient.Res unauth = anon.get("/api/me");
        assertThat(unauth.status()).isEqualTo(401);
        assertThat(unauth.raw().body()).isEqualTo("{\"error\":\"UNAUTHORIZED\"}");

        c.register();
        assertThat(c.get("/api/admin/overview").status()).isEqualTo(403);

        TestClient.Res bad = c.get("/api/listings/not-a-uuid");
        assertThat(bad.status()).isEqualTo(400);
        assertThat(bad.raw().body()).doesNotContain("Exception").doesNotContain("at com.");

        TestClient.Res headers = anon.get("/api/listings?size=1");
        assertThat(headers.raw().headers().firstValue("X-Content-Type-Options")).contains("nosniff");
        assertThat(headers.raw().headers().firstValue("X-Frame-Options")).contains("DENY");
        assertThat(headers.raw().headers().firstValue("Content-Security-Policy")).isPresent();
    }

    @Test
    void forgedTokenIsRejected() {
        c.token = "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIwMDAwMDAwMC0wMDAwLTAwMDAtMDAwMC0wMDAwMDAwMDAwMDAiLCJ0eXAiOiJhY2Nlc3MiLCJyb2xlIjoiQURNSU4iLCJ0diI6MH0.invalidsignature";
        assertThat(c.get("/api/admin/overview").status()).isEqualTo(401);
    }

    @Test
    void loginThrottleIsPerEmailAndLooksTheSameForUnknownAccounts() {
        TestClient owner = new TestClient(port, json);
        String email = owner.register().get("email").asText();
        TestClient attacker = new TestClient(port, json);
        for (String target : new String[] { email, "nobody-" + System.nanoTime() + "@test.dev" }) {
            for (int i = 1; i <= 4; i++) {
                TestClient.Res r = attacker.post("/api/auth/login", Map.of("email", target, "password", "wrong-pass-" + i));
                assertThat(r.status()).isEqualTo(401);
                assertThat(r.error()).isEqualTo("INVALID_CREDENTIALS");
            }
            TestClient.Res fifth = attacker.post("/api/auth/login", Map.of("email", target, "password", "wrong-pass-5"));
            assertThat(fifth.status()).isEqualTo(429);
            assertThat(fifth.error()).isEqualTo("LOGIN_THROTTLED");
            assertThat(Long.parseLong(fifth.raw().headers().firstValue("Retry-After").orElse("0"))).isBetween(60L, 15 * 60L + 1);
        }
        // Contul e protejat chiar și de pe alt IP, chiar și cu parola corectă, până expiră pauza.
        TestClient other = new TestClient(port, json);
        assertThat(other.post("/api/auth/login", Map.of("email", email, "password", "Sigur-Parola-2026!")).error()).isEqualTo("LOGIN_THROTTLED");
    }

    @Test
    void manyFailuresFromOneIpAreBlockedEvenAcrossAccounts() {
        TestClient bot = new TestClient(port, json);
        int last = 0;
        for (int i = 0; i < 21; i++) {
            last = bot.post("/api/auth/login", Map.of("email", "stuffing-" + i + "-" + System.nanoTime() + "@test.dev", "password", "Parola-Furata-1")).status();
        }
        assertThat(last).isEqualTo(429);
        // Un utilizator legitim de pe alt IP nu e afectat.
        TestClient legit = new TestClient(port, json);
        String email = legit.register().get("email").asText();
        legit.token = null;
        assertThat(legit.post("/api/auth/login", Map.of("email", email, "password", "Sigur-Parola-2026!")).status()).isEqualTo(200);
    }
}
