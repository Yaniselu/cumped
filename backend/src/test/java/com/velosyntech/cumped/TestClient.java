package com.velosyntech.cumped;

import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

import java.net.CookieManager;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.util.UUID;

/** Client HTTP real pentru teste: trece prin toate filtrele de securitate, ca o aplicație adevărată. */
public class TestClient {
    public record Res(int status, JsonNode body, HttpResponse<String> raw) {
        public String error() { return body != null && body.has("error") ? body.get("error").asText() : null; }
    }

    private final String base;
    private final JsonMapper json;
    private final HttpClient http;
    private final CookieManager cookies = new CookieManager();
    public String token;
    /** IP simulat (prin proxy-ul de încredere local): fiecare client de test are „IP-ul lui”, ca limitele să nu se amestece. */
    public String ip = "198.18." + java.util.concurrent.ThreadLocalRandom.current().nextInt(256) + "." + (1 + java.util.concurrent.ThreadLocalRandom.current().nextInt(254));

    public TestClient(int port, JsonMapper json) {
        this.base = "http://localhost:" + port;
        this.json = json;
        this.http = HttpClient.newBuilder().cookieHandler(cookies).build();
    }

    /** Valoarea unui cookie primit (ex. refresh token-ul), ca să simulăm un atacator care l-a furat. */
    public String raw(String name) {
        return cookies.getCookieStore().getCookies().stream().filter(k -> k.getName().equals(name))
                .map(java.net.HttpCookie::getValue).findFirst().orElse(null);
    }

    public void setCookie(String name, String value) {
        java.net.HttpCookie k = new java.net.HttpCookie(name, value);
        k.setPath("/api/auth");
        k.setVersion(0);
        cookies.getCookieStore().add(URI.create(base + "/api/auth/refresh"), k);
    }

    public Res get(String path) { return send("GET", path, null, false); }
    public Res post(String path, Object body) { return send("POST", path, body, false); }
    public Res postCsrf(String path) { return send("POST", path, null, true); }
    public Res put(String path, Object body) { return send("PUT", path, body, false); }

    public Res send(String method, String path, Object body, boolean csrf) {
        try {
            HttpRequest.Builder b = HttpRequest.newBuilder(URI.create(base + path)).header("Content-Type", "application/json");
            if (token != null) b.header("Authorization", "Bearer " + token);
            if (csrf) b.header("X-Requested-With", "cumped");
            if (ip != null) b.header("X-Forwarded-For", ip);
            String payload = body == null ? "" : (body instanceof String s ? s : json.writeValueAsString(body));
            b.method(method, body == null ? HttpRequest.BodyPublishers.noBody() : HttpRequest.BodyPublishers.ofString(payload));
            HttpResponse<String> r = http.send(b.build(), HttpResponse.BodyHandlers.ofString());
            JsonNode node = r.body() == null || r.body().isBlank() ? null : json.readTree(r.body());
            return new Res(r.statusCode(), node, r);
        } catch (Exception e) {
            throw new RuntimeException(e);
        }
    }

    /** Creează un cont nou și păstrează token-ul. */
    public JsonNode register() {
        String suffix = UUID.randomUUID().toString().substring(0, 8);
        Res r = post("/api/auth/register", java.util.Map.of("email", "u" + suffix + "@test.dev",
                "password", "Sigur-Parola-2026!", "username", "u_" + suffix, "country", "RO", "locale", "ro",
                "acceptTerms", true, "adultConfirmed", true));
        if (r.status() != 201) throw new IllegalStateException("register failed " + r.status() + " " + r.raw().body());
        token = r.body().get("accessToken").asText();
        return r.body().get("user");
    }
}
