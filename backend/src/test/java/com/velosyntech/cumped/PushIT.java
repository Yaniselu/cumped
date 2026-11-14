package com.velosyntech.cumped;

import com.sun.net.httpserver.HttpServer;
import com.velosyntech.cumped.notification.push.WebPushTestSupport;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.jdbc.core.simple.JdbcClient;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

import java.net.InetSocketAddress;
import java.security.KeyPair;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.LinkedBlockingQueue;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Alertele push cap-coadă: un „serviciu de push” fals primește cererea, iar testul o decriptează exact ca un browser
 * și verifică semnătura VAPID. Plus: protecția la adrese periculoase, preferințele și alertele de securitate.
 */
@IntegrationTest
class PushIT {
    @Value("${local.server.port}") int port;
    @Autowired JsonMapper json;
    @Autowired JdbcClient jdbc;

    record Received(Map<String, String> headers, byte[] body) {}

    HttpServer server;
    final LinkedBlockingQueue<Received> inbox = new LinkedBlockingQueue<>();
    final AtomicInteger status = new AtomicInteger(201);

    @BeforeEach
    void start() throws Exception {
        server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        server.createContext("/push/", ex -> {
            Map<String, String> h = new HashMap<>();
            ex.getRequestHeaders().forEach((k, v) -> h.put(k.toLowerCase(), v.get(0)));
            inbox.add(new Received(h, ex.getRequestBody().readAllBytes()));
            ex.sendResponseHeaders(status.get(), -1);
            ex.close();
        });
        server.start();
    }

    @AfterEach
    void stop() { server.stop(0); }

    private TestClient user() {
        TestClient c = new TestClient(port, json);
        c.register();
        return c;
    }

    /** Abonează un „browser” și întoarce cheile lui, ca testul să poată decripta alertele. */
    private WebPushTestSupport.Browser subscribe(TestClient c, String path) {
        WebPushTestSupport.Browser b = WebPushTestSupport.browser();
        TestClient.Res r = c.post("/api/me/push/subscriptions", Map.of("kind", "WEB", "endpoint", "http://localhost:" + server.getAddress().getPort() + "/push/" + path,
                "keys", Map.of("p256dh", b.p256dh(), "auth", b.auth()), "device", "Chrome · Windows"));
        assertThat(r.status()).as(r.raw().body()).isEqualTo(200);
        return b;
    }

    private JsonNode receive(WebPushTestSupport.Browser b, String vapidPublic) throws Exception {
        Received r = inbox.poll(8, TimeUnit.SECONDS);
        assertThat(r).as("alerta a ajuns la serviciul de push").isNotNull();
        assertThat(r.headers().get("content-encoding")).isEqualTo("aes128gcm");
        assertThat(r.headers().get("ttl")).isNotBlank();
        String auth = r.headers().get("authorization");
        assertThat(auth).startsWith("vapid t=");
        assertThat(WebPushTestSupport.vapidValid(auth, vapidPublic)).as("semnătura VAPID e validă").isTrue();
        return json.readTree(WebPushTestSupport.decrypt(r.body(), b));
    }

    private String vapid() { return new TestClient(port, json).get("/api/config").body().get("vapidPublicKey").asText(); }

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
    void sellerGetsEncryptedAlertInTheirLanguageWhenSomethingSells() throws Exception {
        TestClient seller = user(), buyer = user();
        WebPushTestSupport.Browser b = subscribe(seller, "seller");
        String id = seller.post("/api/listings", listing("Căști Sony WH-1000XM5")).body().get("id").asText();
        String order = buyer.post("/api/listings/" + id + "/orders", Map.of("delivery", "PICKUP")).body().get("id").asText();
        JsonNode alert = receive(b, vapid());
        assertThat(alert.get("title").asText()).isEqualTo("Cumped");
        assertThat(alert.get("body").asText()).contains("Căști Sony WH-1000XM5"); // textul tradus pe server, cu titlul anunțului
        assertThat(alert.get("url").asText()).isEqualTo("/orders/" + order);
        assertThat(alert.get("type").asText()).isEqualTo("ORDER_PAID");
    }

    @Test
    void newMessageAlertShowsWhoWroteButNotTheMessageItself() throws Exception {
        TestClient seller = user(), buyer = user();
        WebPushTestSupport.Browser b = subscribe(seller, "chat");
        String id = seller.post("/api/listings", listing("Monitor Dell 27")).body().get("id").asText();
        String conv = buyer.post("/api/conversations", Map.of("listingId", id)).body().get("id").asText();
        assertThat(receive(b, vapid()).get("type").asText()).isEqualTo("NEW_CONVERSATION"); // întâi: conversație nouă
        buyer.post("/api/conversations/" + conv + "/messages", Map.of("body", "Codul meu secret este 4242"));
        JsonNode alert = receive(b, vapid());
        assertThat(alert.get("type").asText()).isEqualTo("NEW_MESSAGE");
        assertThat(alert.get("body").asText()).contains("Monitor Dell 27").doesNotContain("4242");
        assertThat(alert.get("url").asText()).isEqualTo("/chat/" + conv);
    }

    @Test
    void preferencesTurnOffCategoriesButNotSecurity() throws Exception {
        TestClient seller = user(), buyer = user();
        WebPushTestSupport.Browser b = subscribe(seller, "prefs");
        assertThat(seller.put("/api/me/notification-prefs", Map.of("messages", true, "offers", true, "orders", false, "alerts", true, "account", true)).status()).isEqualTo(200);
        assertThat(seller.get("/api/me/notification-prefs").body().get("orders").asBoolean()).isFalse();
        String id = seller.post("/api/listings", listing("Tabletă Lenovo")).body().get("id").asText();
        buyer.post("/api/listings/" + id + "/orders", Map.of("delivery", "PICKUP"));
        assertThat(inbox.poll(2, TimeUnit.SECONDS)).as("comenzile sunt oprite: nicio alertă").isNull();
        // alerta de test (categoria securitate) merge mereu
        assertThat(seller.post("/api/me/push/test", Map.of()).body().get("delivered").asInt()).isEqualTo(1);
        assertThat(receive(b, vapid()).get("type").asText()).isEqualTo("PUSH_TEST");
    }

    @Test
    void pushEndpointsArePinnedToRealPushServices() {
        TestClient u = user();
        WebPushTestSupport.Browser b = WebPushTestSupport.browser();
        Map<String, String> keys = Map.of("p256dh", b.p256dh(), "auth", b.auth());
        // serverul nu poate fi folosit ca să trimită cereri spre adrese interne sau site-uri oarecare (SSRF)
        for (String bad : List.of("https://evil.example.com/x", "http://169.254.169.254/latest/meta-data", "https://fcm.googleapis.com.evil.com/x",
                "https://user@fcm.googleapis.com/x", "https://fcm.googleapis.com:8443/x", "http://fcm.googleapis.com/x", "file:///etc/passwd")) {
            assertThat(u.post("/api/me/push/subscriptions", Map.of("kind", "WEB", "endpoint", bad, "keys", keys)).error()).as(bad).isEqualTo("INVALID_PUSH_ENDPOINT");
        }
        assertThat(u.post("/api/me/push/subscriptions", Map.of("kind", "WEB", "endpoint", "https://fcm.googleapis.com/fcm/send/abc", "keys", keys)).status()).isEqualTo(200);
        assertThat(u.post("/api/me/push/subscriptions", Map.of("kind", "WEB", "endpoint", "https://web.push.apple.com/QK3x", "keys", keys)).status()).isEqualTo(200);
        // chei invalide
        assertThat(u.post("/api/me/push/subscriptions", Map.of("kind", "WEB", "endpoint", "https://fcm.googleapis.com/fcm/send/z",
                "keys", Map.of("p256dh", "AAAA", "auth", "BBBB"))).error()).isEqualTo("INVALID_PUSH_KEYS");
        // fără cont: nimic
        assertThat(new TestClient(port, json).post("/api/me/push/subscriptions", Map.of("kind", "WEB", "endpoint", "https://fcm.googleapis.com/fcm/send/q", "keys", keys)).status()).isEqualTo(401);
    }

    @Test
    void expiredSubscriptionsAreRemovedAndDevicesAreCapped() throws Exception {
        TestClient u = user();
        subscribe(u, "gone");
        status.set(410);
        u.post("/api/me/push/test", Map.of());
        inbox.poll(5, TimeUnit.SECONDS);
        Integer left = jdbc.sql("SELECT count(*) FROM push_subscriptions WHERE user_id = CAST(? AS uuid)").param(u.userId).query(Integer.class).single();
        assertThat(left).isZero();
        status.set(201);
        for (int i = 0; i < 13; i++) subscribe(u, "dev" + i);
        Integer n = jdbc.sql("SELECT count(*) FROM push_subscriptions WHERE user_id = CAST(? AS uuid)").param(u.userId).query(Integer.class).single();
        assertThat(n).isEqualTo(10);
        // „ieși de pe toate dispozitivele” oprește și alertele
        assertThat(u.postCsrf("/api/auth/logout-all").status()).isEqualTo(204);
        Integer after = jdbc.sql("SELECT count(*) FROM push_subscriptions WHERE user_id = CAST(? AS uuid)").param(u.userId).query(Integer.class).single();
        assertThat(after).isZero();
    }

    @Test
    void newDeviceSignInAndPasswordChangeTriggerSecurityAlerts() throws Exception {
        TestClient u = user(); // înregistrat din Chrome pe Windows
        WebPushTestSupport.Browser b = subscribe(u, "sec");
        u.relogin(); // același dispozitiv: nicio alertă
        assertThat(inbox.poll(1500, TimeUnit.MILLISECONDS)).isNull();
        TestClient phone = new TestClient(port, json);
        phone.email = u.email;
        phone.userAgent = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1";
        phone.relogin();
        JsonNode alert = receive(b, vapid());
        assertThat(alert.get("type").asText()).isEqualTo("SECURITY_NEW_LOGIN");
        assertThat(alert.get("body").asText()).contains("Safari · iPhone");
        Integer mails = jdbc.sql("SELECT count(*) FROM mail_outbox WHERE to_addr = ?").param(u.email).query(Integer.class).single();
        assertThat(mails).isGreaterThanOrEqualTo(1);
        // schimbarea parolei
        assertThat(u.post("/api/auth/change-password", Map.of("currentPassword", "Sigur-Parola-2026!", "newPassword", "Alta-Parola-Sigura-2027!")).status()).isEqualTo(204);
        Integer pw = jdbc.sql("SELECT count(*) FROM notifications WHERE user_id = CAST(? AS uuid) AND type = 'SECURITY_PASSWORD_CHANGED'").param(u.userId).query(Integer.class).single();
        assertThat(pw).isEqualTo(1);
    }
}
