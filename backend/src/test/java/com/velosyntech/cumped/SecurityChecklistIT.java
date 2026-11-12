package com.velosyntech.cumped;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.jdbc.core.simple.JdbcClient;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

/** Lista de securitate, punct cu punct, verificată pe aplicația pornită de-adevăratelea. */
@IntegrationTest
class SecurityChecklistIT {
    @Value("${local.server.port}") int port;
    @Autowired JsonMapper json;
    @Autowired JdbcClient jdbc;

    private TestClient user() {
        TestClient c = new TestClient(port, json);
        c.register();
        return c;
    }

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
        m.put("acceptsOffers", true);
        m.put("acceptsSwap", false);
        return m;
    }

    @Test
    void hideApiKeys_publicConfigHasNoSecrets() {
        String body = new TestClient(port, json).get("/api/config").raw().body();
        assertThat(body).doesNotContainIgnoringCase("secret").doesNotContain("test-secret").doesNotContain("sk-ant")
                .doesNotContain("password").doesNotContain("jdbc:");
    }

    @Test
    void enforceServerSideAuth_everyPrivateEndpointNeedsLogin() {
        TestClient anon = new TestClient(port, json);
        for (String path : List.of("/api/me", "/api/me/orders", "/api/me/favorites", "/api/me/export", "/api/me/negotiations",
                "/api/me/notifications", "/api/conversations", "/api/admin/overview", "/api/admin/orders/disputed")) {
            assertThat(anon.get(path).status()).as(path).isEqualTo(401);
        }
        assertThat(anon.post("/api/listings", listing("Fără cont")).status()).isEqualTo(401);
        assertThat(anon.post("/api/reviews", Map.of("orderId", java.util.UUID.randomUUID(), "rating", 5)).status()).isEqualTo(401);
        // un utilizator obișnuit nu ajunge la panoul de administrare
        TestClient u = user();
        assertThat(u.get("/api/admin/orders/disputed").status()).isEqualTo(403);
        assertThat(u.post("/api/admin/users/" + u.userId + "/suspend", Map.of()).status()).isEqualTo(403);
    }

    @Test
    void lockRecordAccess_usersCannotTouchOtherPeoplesData() {
        TestClient owner = user(), buyer = user(), intruder = user();
        String listingId = owner.post("/api/listings", listing("Laptop Lenovo ThinkPad")).body().get("id").asText();
        // editare / ștergere / schimbare status pe anunțul altcuiva
        assertThat(intruder.put("/api/listings/" + listingId, listing("Laptop furat")).status()).isIn(403, 404);
        assertThat(intruder.send("DELETE", "/api/listings/" + listingId, null, false).status()).isIn(403, 404, 405);
        assertThat(intruder.post("/api/listings/" + listingId + "/status", Map.of("status", "SOLD")).status()).isIn(400, 403, 404);
        // conversația dintre alți doi
        String conv = buyer.post("/api/conversations", Map.of("listingId", listingId)).body().get("id").asText();
        assertThat(intruder.get("/api/conversations/" + conv).status()).isIn(403, 404);
        assertThat(intruder.post("/api/conversations/" + conv + "/messages", Map.of("body", "Salut")).status()).isIn(403, 404);
        // comanda altcuiva: nici citire, nici acțiuni
        String order = buyer.post("/api/listings/" + listingId + "/orders", Map.of("delivery", "PICKUP")).body().get("id").asText();
        assertThat(intruder.get("/api/orders/" + order).status()).isEqualTo(404);
        for (String action : List.of("confirm", "cancel", "ship")) {
            assertThat(intruder.post("/api/orders/" + order + "/" + action, Map.of()).status()).as(action).isEqualTo(404);
        }
        // datele de cont rămân private
        assertThat(intruder.get("/api/users/" + owner.userId).raw().body()).doesNotContain(owner.email);
    }

    @Test
    void blockFieldTampering_unknownOrPrivilegedFieldsAreRejected() {
        TestClient anon = new TestClient(port, json);
        Map<String, Object> reg = new HashMap<>(Map.of("email", "tamper" + System.nanoTime() + "@test.dev", "password", "Sigur-Parola-2026!",
                "username", "t" + (System.nanoTime() % 100000000), "acceptTerms", true, "adultConfirmed", true));
        reg.put("role", "ADMIN");
        assertThat(anon.post("/api/auth/register", reg).status()).isEqualTo(400);

        TestClient u = user();
        assertThat(u.send("PATCH", "/api/me", Map.of("role", "ADMIN"), false).status()).isEqualTo(400);
        assertThat(u.send("PATCH", "/api/me", Map.of("idVerified", true), false).status()).isEqualTo(400);
        assertThat(u.send("PATCH", "/api/me", Map.of("plan", "PRO"), false).status()).isEqualTo(400);
        Map<String, Object> l = listing("Telefon Samsung Galaxy");
        l.put("sellerId", java.util.UUID.randomUUID());
        assertThat(u.post("/api/listings", l).status()).isEqualTo(400);
        Map<String, Object> l2 = listing("Telefon Samsung Galaxy");
        l2.put("viewCount", 99999);
        assertThat(u.post("/api/listings", l2).status()).isEqualTo(400);
        // prețul la comandă îl calculează serverul, nu clientul
        String id = user().post("/api/listings", listing("Cameră foto Canon")).body().get("id").asText();
        assertThat(u.post("/api/listings/" + id + "/orders", Map.of("delivery", "PICKUP", "totalCents", 1)).status()).isEqualTo(400);
    }

    @Test
    void secureSessionCookies_refreshCookieIsHttpOnlyStrictAndScoped() {
        TestClient c = new TestClient(port, json);
        String suffix = String.valueOf(System.nanoTime() % 100000000);
        TestClient.Res r = c.post("/api/auth/register", Map.of("email", "ck" + suffix + "@test.dev", "password", "Sigur-Parola-2026!",
                "username", "ck_" + suffix, "acceptTerms", true, "adultConfirmed", true));
        String cookie = r.raw().headers().allValues("Set-Cookie").stream().filter(h -> h.startsWith("cmp_rt=")).findFirst().orElseThrow();
        assertThat(cookie).contains("HttpOnly").contains("SameSite=Strict").contains("Path=/api/auth");
        // token-ul de acces nu e pus în cookie (nu poate fi trimis automat de alt site)
        assertThat(r.raw().headers().allValues("Set-Cookie")).noneMatch(h -> h.contains(r.body().get("accessToken").asText()));
    }

    @Test
    void hashPasswords_storedWithBcryptNeverInClear() {
        TestClient u = user();
        String hash = jdbc.sql("SELECT password_hash FROM users WHERE id = CAST(? AS uuid)").param(u.userId).query(String.class).single();
        assertThat(hash).startsWith("{bcrypt}$2").doesNotContain("Sigur-Parola");
        // parola nu apare nici în exportul de date
        assertThat(u.get("/api/me/export").raw().body()).doesNotContain(hash).doesNotContain("passwordHash");
    }

    @Test
    void passwordsLongerThanBcryptLimitAreRejectedCleanly() {
        TestClient anon = new TestClient(port, json);
        String suffix = String.valueOf(System.nanoTime() % 100000000);
        String longPass = "Aa1-" + "x".repeat(90);
        TestClient.Res r = anon.post("/api/auth/register", Map.of("email", "lp" + suffix + "@test.dev", "password", longPass,
                "username", "lp_" + suffix, "acceptTerms", true, "adultConfirmed", true));
        assertThat(r.error()).isEqualTo("PASSWORD_TOO_LONG");
        TestClient.Res login = anon.post("/api/auth/login", Map.of("email", "lp" + suffix + "@test.dev", "password", longPass));
        assertThat(login.error()).isEqualTo("INVALID_CREDENTIALS");
    }

    @Test
    void addBotProtection_honeypotAndInstantSubmitAreBlocked() {
        TestClient anon = new TestClient(port, json);
        String suffix = String.valueOf(System.nanoTime() % 100000000);
        Map<String, Object> reg = new HashMap<>(Map.of("email", "bot" + suffix + "@test.dev", "password", "Sigur-Parola-2026!",
                "username", "bot_" + suffix, "acceptTerms", true, "adultConfirmed", true));
        reg.put("website", "http://spam.example");
        assertThat(anon.post("/api/auth/register", reg).error()).isEqualTo("BOT_DETECTED");
        reg.put("website", "");
        reg.put("elapsedMs", 120);
        assertThat(anon.post("/api/auth/register", reg).error()).isEqualTo("BOT_DETECTED");
        reg.put("elapsedMs", 8000);
        assertThat(anon.post("/api/auth/register", reg).status()).isEqualTo(201);
    }

    @Test
    void parameterizeQueries_sqlInjectionIsTreatedAsPlainText() {
        TestClient anon = new TestClient(port, json);
        int before = jdbc.sql("SELECT count(*) FROM users").query(Integer.class).single();
        for (String q : List.of("' OR '1'='1", "'; DROP TABLE users; --", "\\\" OR 1=1 --", "%' UNION SELECT password_hash FROM users --")) {
            TestClient.Res r = anon.get("/api/listings?q=" + java.net.URLEncoder.encode(q, java.nio.charset.StandardCharsets.UTF_8));
            assertThat(r.status()).as(q).isEqualTo(200);
            assertThat(r.raw().body()).doesNotContain("$2a$").doesNotContain("bcrypt");
        }
        assertThat(anon.get("/api/listings?sort=" + java.net.URLEncoder.encode("price; DROP TABLE listings", java.nio.charset.StandardCharsets.UTF_8)).status()).isIn(200, 400);
        TestClient u = user();
        String title = "Robert'); DROP TABLE listings;--";
        TestClient.Res created = u.post("/api/listings", listing(title));
        assertThat(created.status()).isIn(200, 201);
        assertThat(u.get("/api/listings/" + created.body().get("id").asText()).body().get("title").asText()).isEqualTo(title);
        assertThat(jdbc.sql("SELECT count(*) FROM users").query(Integer.class).single()).isGreaterThanOrEqualTo(before);
    }

    @Test
    void validateAllInput_badValuesAreRejected() {
        TestClient u = user();
        Map<String, Object> l = listing("Ok");
        assertThat(u.post("/api/listings", l).status()).isEqualTo(400); // titlu prea scurt
        l = listing("Titlu bun de anunț");
        l.put("priceCents", -5);
        assertThat(u.post("/api/listings", l).status()).isEqualTo(400);
        l.put("priceCents", 1000);
        l.put("currency", "BITCOIN");
        assertThat(u.post("/api/listings", l).status()).isEqualTo(400);
        l.put("currency", "RON");
        l.put("country", "ROMANIA");
        assertThat(u.post("/api/listings", l).status()).isEqualTo(400);
        l.put("country", "RO");
        l.put("description", "x".repeat(4001));
        assertThat(u.post("/api/listings", l).status()).isEqualTo(400);
        assertThat(new TestClient(port, json).post("/api/auth/register", Map.of("email", "nu-e-email", "password", "Sigur-Parola-2026!",
                "username", "valid_name", "acceptTerms", true, "adultConfirmed", true)).status()).isEqualTo(400);
        assertThat(u.get("/api/listings/not-a-uuid").status()).isEqualTo(400);
        assertThat(u.send("POST", "/api/listings", "{ asta nu e json", false).status()).isEqualTo(400);
    }

    @Test
    void escapeUserContent_htmlIsReturnedAsInertJsonText() {
        TestClient seller = user(), buyer = user();
        String listingId = seller.post("/api/listings", listing("Boxă portabilă JBL")).body().get("id").asText();
        String conv = buyer.post("/api/conversations", Map.of("listingId", listingId)).body().get("id").asText();
        String xss = "<img src=x onerror=alert(1)> salut";
        buyer.post("/api/conversations/" + conv + "/messages", Map.of("body", xss));
        TestClient.Res r = seller.get("/api/conversations/" + conv);
        assertThat(r.raw().headers().firstValue("Content-Type").orElse("")).startsWith("application/json");
        assertThat(r.raw().headers().firstValue("X-Content-Type-Options")).contains("nosniff");
        // API-ul nu întoarce niciodată HTML: CSP-ul blochează orice script chiar dacă răspunsul ar fi deschis în browser
        assertThat(r.raw().headers().firstValue("Content-Security-Policy").orElse("")).contains("default-src 'none'");
    }

    @Test
    void restrictFileUploads_onlyRealImagesWithinLimits() {
        TestClient u = user();
        // conținutul real e verificat (nu extensia sau tipul declarat): orice nu e JPEG/PNG e respins
        assertThat(u.upload("poza.jpg", "image/jpeg", "<?php system($_GET['c']); ?>".getBytes()).status()).isIn(400, 415);
        assertThat(u.upload("img.svg", "image/svg+xml", "<svg xmlns='http://www.w3.org/2000/svg'><script>alert(1)</script></svg>".getBytes()).status()).isIn(400, 415);
        assertThat(u.upload("doc.pdf", "application/pdf", "%PDF-1.7 fake".getBytes()).status()).isIn(400, 415);
        byte[] big = new byte[11 * 1024 * 1024];
        big[0] = (byte) 0xFF; big[1] = (byte) 0xD8; big[2] = (byte) 0xFF;
        int status;
        try { status = u.upload("mare.jpg", "image/jpeg", big).status(); }
        catch (RuntimeException closedByServer) { status = 413; } // serverul poate închide conexiunea înainte să citească tot fișierul
        assertThat(status).isIn(400, 413);
        assertThat(new TestClient(port, json).upload("anon.jpg", "image/jpeg", new byte[] {(byte) 0xFF, (byte) 0xD8}).status()).isEqualTo(401);
    }

    @Test
    void uploadedPhotosLoseMetadataLikeGpsLocation() throws Exception {
        TestClient u = user();
        // JPEG valid + segment EXIF (APP1) cu „coordonate GPS” false
        java.awt.image.BufferedImage img = new java.awt.image.BufferedImage(64, 64, java.awt.image.BufferedImage.TYPE_INT_RGB);
        java.io.ByteArrayOutputStream jpg = new java.io.ByteArrayOutputStream();
        javax.imageio.ImageIO.write(img, "jpg", jpg);
        byte[] plain = jpg.toByteArray();
        byte[] exif = ("Exif\0\0GPS-LAT-46.77-LON-23.59-SECRET-HOME").getBytes(java.nio.charset.StandardCharsets.ISO_8859_1);
        java.io.ByteArrayOutputStream withExif = new java.io.ByteArrayOutputStream();
        withExif.write(plain, 0, 2);
        withExif.write(0xFF); withExif.write(0xE1);
        withExif.write((exif.length + 2) >> 8); withExif.write((exif.length + 2) & 0xFF);
        withExif.write(exif);
        withExif.write(plain, 2, plain.length - 2);
        TestClient.Res up = u.upload("gps.jpg", "image/jpeg", withExif.toByteArray());
        assertThat(up.status()).isEqualTo(200);
        HttpResponse<byte[]> served = HttpClient.newHttpClient().send(HttpRequest.newBuilder(URI.create("http://localhost:" + port + up.body().get("url").asText())).build(),
                HttpResponse.BodyHandlers.ofByteArray());
        assertThat(new String(served.body(), java.nio.charset.StandardCharsets.ISO_8859_1)).doesNotContain("SECRET-HOME").doesNotContain("Exif");
    }

    @Test
    void trimApiResponses_publicDataNeverLeaksPrivateFields() {
        TestClient seller = user(), other = user();
        Map<String, Object> l = listing("Bicicletă de oraș");
        l.put("negotiable", true);
        l.put("minPriceCents", 42000);
        String id = seller.post("/api/listings", l).body().get("id").asText();
        String asOther = other.get("/api/listings/" + id).raw().body();
        assertThat(asOther).doesNotContain("42000"); // prețul minim secret al vânzătorului
        assertThat(asOther).doesNotContain(seller.email).doesNotContain("passwordHash").doesNotContain("tokenVersion");
        assertThat(seller.get("/api/listings/" + id).body().get("minPriceCents").asLong()).isEqualTo(42000);
        String search = new TestClient(port, json).get("/api/listings?q=Bicicletă").raw().body();
        assertThat(search).doesNotContain("@test.dev").doesNotContain("minPriceCents\":42000");
        String profile = new TestClient(port, json).get("/api/users/" + seller.userId).raw().body();
        assertThat(profile).doesNotContain("email").doesNotContain("phone\"").doesNotContain("legalFirstName").doesNotContain("role");
        // erorile nu arată detalii interne
        String err = other.send("POST", "/api/listings", "{\"title\":", false).raw().body();
        assertThat(err).doesNotContain("Exception").doesNotContain("at com.").doesNotContain("jackson");
    }

    @Test
    void addSecurityHeaders_andHstsWhenServedOverHttps() throws Exception {
        HttpResponse<String> r = HttpClient.newHttpClient().send(HttpRequest.newBuilder(URI.create("http://localhost:" + port + "/api/listings?size=1"))
                .header("X-Forwarded-Proto", "https").build(), HttpResponse.BodyHandlers.ofString());
        assertThat(r.headers().firstValue("Strict-Transport-Security").orElse("")).contains("max-age=").contains("includeSubDomains");
        assertThat(r.headers().firstValue("X-Content-Type-Options")).contains("nosniff");
        assertThat(r.headers().firstValue("X-Frame-Options")).contains("DENY");
        assertThat(r.headers().firstValue("Referrer-Policy")).contains("no-referrer");
        assertThat(r.headers().firstValue("Permissions-Policy").orElse("")).contains("camera=()");
        assertThat(r.headers().firstValue("Content-Security-Policy").orElse("")).contains("frame-ancestors 'none'");
        assertThat(r.headers().firstValue("Server")).isEmpty();
    }

    @Test
    void encryptSensitiveData_legalNamesAreEncryptedAtRest() {
        TestClient u = user();
        assertThat(u.post("/api/verification/identity/dev-complete", Map.of("firstName", "ioana", "lastName", "marinescu")).status()).isEqualTo(200);
        String raw = jdbc.sql("SELECT legal_first_name || '|' || legal_last_name FROM users WHERE id = CAST(? AS uuid)").param(u.userId).query(String.class).single();
        assertThat(raw).doesNotContainIgnoringCase("ioana").doesNotContainIgnoringCase("marinescu").contains("enc:v1:");
        assertThat(u.get("/api/me").body().get("legalName").asText()).isEqualTo("Ioana Marinescu");
    }

    @Test
    void rateLimitLogin_isCoveredAndReturnsRetryAfter() {
        // detaliat în AuthSecurityIT și RateLimitIT; aici doar verificăm că limita există și pentru un cont nou
        TestClient owner = user();
        TestClient attacker = new TestClient(port, json);
        int last = 0;
        for (int i = 0; i < 6; i++) last = attacker.post("/api/auth/login", Map.of("email", owner.email, "password", "gresit-" + i + "-Abc")).status();
        assertThat(last).isEqualTo(429);
    }
}
