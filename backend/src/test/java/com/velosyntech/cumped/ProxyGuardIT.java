package com.velosyntech.cumped;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.test.context.TestPropertySource;
import tools.jackson.databind.json.JsonMapper;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

/** Producție în spatele Vercel: API-ul răspunde doar cererilor care au trecut prin site (antet secret). */
@IntegrationTest
@TestPropertySource(properties = "cumped.proxy-secret=secret-de-proxy-pentru-teste-0123456789")
class ProxyGuardIT {
    static final String SECRET = "secret-de-proxy-pentru-teste-0123456789";
    @Value("${local.server.port}") int port;
    @Autowired JsonMapper json;

    @Test
    void requestsThatBypassTheSiteAreRejected() {
        TestClient direct = new TestClient(port, json);
        assertThat(direct.get("/api/config").status()).isEqualTo(404);
        direct.proxySecret = "ghicit";
        assertThat(direct.get("/api/config").status()).isEqualTo(404);
        direct.proxySecret = SECRET.substring(0, SECRET.length() - 1);
        assertThat(direct.get("/api/config").status()).isEqualTo(404);
    }

    @Test
    void requestsThroughTheSiteWorkNormally() {
        TestClient viaSite = new TestClient(port, json);
        viaSite.proxySecret = SECRET;
        assertThat(viaSite.get("/api/config").status()).isEqualTo(200);
        viaSite.register();
        assertThat(viaSite.get("/api/me").status()).isEqualTo(200);
    }

    @Test
    void healthCheckStaysOpenForTheHostingPlatform() throws Exception {
        HttpResponse<String> r = HttpClient.newHttpClient().send(HttpRequest.newBuilder(URI.create("http://localhost:" + port + "/actuator/health")).build(),
                HttpResponse.BodyHandlers.ofString());
        assertThat(r.statusCode()).isEqualTo(200);
        assertThat(r.body()).doesNotContain("db").doesNotContain("diskSpace"); // fără detalii interne
    }

    @Test
    void eachClientIpHasItsOwnLoginLimit() {
        // Vercel pune IP-ul real primul în X-Forwarded-For; limitele se aplică pe el, nu pe serverele Vercel
        TestClient a = new TestClient(port, json), b = new TestClient(port, json);
        a.proxySecret = SECRET; b.proxySecret = SECRET;
        a.ip = "203.0.113.10, 76.76.21.21"; b.ip = "203.0.113.20, 76.76.21.21";
        int last = 0;
        for (int i = 0; i < 21; i++) last = a.post("/api/auth/login", Map.of("email", "x" + i + "-" + System.nanoTime() + "@test.dev", "password", "Parola-Gresita-1")).status();
        assertThat(last).isEqualTo(429);
        assertThat(b.post("/api/auth/login", Map.of("email", "y-" + System.nanoTime() + "@test.dev", "password", "Parola-Gresita-1")).status()).isEqualTo(401);
    }
}
