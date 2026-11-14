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
    /** Browserul / aplicația cu care „intră” clientul de test (pentru alertele de dispozitiv nou). */
    public String userAgent = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Safari/537.36";
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
            if (userAgent != null) b.header("User-Agent", userAgent);
            String payload = body == null ? "" : (body instanceof String s ? s : json.writeValueAsString(body));
            b.method(method, body == null ? HttpRequest.BodyPublishers.noBody() : HttpRequest.BodyPublishers.ofString(payload));
            HttpResponse<String> r = http.send(b.build(), HttpResponse.BodyHandlers.ofString());
            JsonNode node = r.body() == null || r.body().isBlank() ? null : json.readTree(r.body());
            return new Res(r.statusCode(), node, r);
        } catch (Exception e) {
            throw new RuntimeException(e);
        }
    }

    /** Încarcă o poză JPEG generată (culoare diferită la fiecare apel) și întoarce id-ul ei. */
    public String uploadPhoto() {
        try {
            java.awt.image.BufferedImage img = new java.awt.image.BufferedImage(320, 240, java.awt.image.BufferedImage.TYPE_INT_RGB);
            java.awt.Graphics2D g = img.createGraphics();
            g.setColor(new java.awt.Color(java.util.concurrent.ThreadLocalRandom.current().nextInt(0xFFFFFF)));
            g.fillRect(0, 0, 320, 240);
            g.dispose();
            java.io.ByteArrayOutputStream out = new java.io.ByteArrayOutputStream();
            javax.imageio.ImageIO.write(img, "jpg", out);
            return upload("photo.jpg", "image/jpeg", out.toByteArray()).body().get("id").asText();
        } catch (java.io.IOException e) {
            throw new RuntimeException(e);
        }
    }

    /** Trimite un fișier ca multipart/form-data (câmpul „file”). */
    public Res upload(String filename, String contentType, byte[] bytes) {
        try {
            String boundary = "----cumped" + UUID.randomUUID();
            java.io.ByteArrayOutputStream body = new java.io.ByteArrayOutputStream();
            body.write(("--" + boundary + "\r\nContent-Disposition: form-data; name=\"file\"; filename=\"" + filename
                    + "\"\r\nContent-Type: " + contentType + "\r\n\r\n").getBytes(java.nio.charset.StandardCharsets.UTF_8));
            body.write(bytes);
            body.write(("\r\n--" + boundary + "--\r\n").getBytes(java.nio.charset.StandardCharsets.UTF_8));
            HttpRequest.Builder b = HttpRequest.newBuilder(URI.create(base + "/api/media"))
                    .header("Content-Type", "multipart/form-data; boundary=" + boundary)
                    .POST(HttpRequest.BodyPublishers.ofByteArray(body.toByteArray()));
            if (token != null) b.header("Authorization", "Bearer " + token);
            if (ip != null) b.header("X-Forwarded-For", ip);
            HttpResponse<String> r = http.send(b.build(), HttpResponse.BodyHandlers.ofString());
            JsonNode node = r.body() == null || r.body().isBlank() ? null : json.readTree(r.body());
            return new Res(r.statusCode(), node, r);
        } catch (Exception e) {
            throw new RuntimeException(e);
        }
    }

    /** Descarcă un URL relativ (ex. /api/media/...) și întoarce doar codul de stare. */
    public int fetchStatus(String path) {
        try {
            HttpRequest.Builder b = HttpRequest.newBuilder(URI.create(base + path)).GET();
            if (ip != null) b.header("X-Forwarded-For", ip);
            return http.send(b.build(), HttpResponse.BodyHandlers.discarding()).statusCode();
        } catch (Exception e) {
            throw new RuntimeException(e);
        }
    }

    /** Creează un cont nou și păstrează token-ul. */
    public String email;
    public String userId;

    /** Autentificare din nou (ex. după ce testul i-a schimbat rolul în baza de date). */
    public void relogin() {
        Res r = post("/api/auth/login", java.util.Map.of("email", email, "password", "Sigur-Parola-2026!"));
        if (r.status() != 200) throw new IllegalStateException("login failed " + r.status() + " " + r.raw().body());
        token = r.body().get("accessToken").asText();
    }

    public JsonNode register() {
        String suffix = UUID.randomUUID().toString().substring(0, 8);
        email = "u" + suffix + "@test.dev";
        Res r = post("/api/auth/register", java.util.Map.of("email", email,
                "password", "Sigur-Parola-2026!", "username", "u_" + suffix, "country", "RO", "locale", "ro",
                "acceptTerms", true, "adultConfirmed", true, "website", "", "elapsedMs", 6000));
        if (r.status() != 201) throw new IllegalStateException("register failed " + r.status() + " " + r.raw().body());
        token = r.body().get("accessToken").asText();
        userId = r.body().get("user").get("id").asText();
        return r.body().get("user");
    }
}
