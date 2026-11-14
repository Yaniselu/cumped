package com.velosyntech.cumped.notification.push;

import com.velosyntech.cumped.common.ApiException;
import com.velosyntech.cumped.common.FieldCrypto;
import com.velosyntech.cumped.config.AppProperties;
import jakarta.annotation.PostConstruct;
import jakarta.annotation.PreDestroy;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.core.io.ClassPathResource;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Service;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.security.KeyPair;
import java.security.interfaces.ECPrivateKey;
import java.security.interfaces.ECPublicKey;
import java.text.NumberFormat;
import java.time.Duration;
import java.time.Instant;
import java.util.*;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/**
 * Alerte push: pe site (Web Push, criptat cap-coadă) și pe telefon (Firebase Cloud Messaging).
 * Textul e tradus pe server, în limba utilizatorului, din aceleași traduceri ca aplicația (push-texts.json).
 * Trimiterea e asincronă și abia după ce tranzacția s-a salvat (nu anunțăm ceva ce nu s-a întâmplat).
 */
@Service
public class PushService {
    private static final Logger log = LoggerFactory.getLogger(PushService.class);
    public static final int MAX_SUBSCRIPTIONS_PER_USER = 10;
    /** Serviciile de push ale browserelor: abonamentele către alte adrese sunt refuzate (altfel serverul ar putea fi folosit să atace alte site-uri). */
    static final List<String> PUSH_HOSTS = List.of("fcm.googleapis.com", "android.googleapis.com", "updates.push.services.mozilla.com",
            "push.services.mozilla.com", "web.push.apple.com", "notify.windows.com");
    public static final List<String> CATEGORIES = List.of("messages", "offers", "orders", "alerts", "account");

    public record Prefs(boolean messages, boolean offers, boolean orders, boolean alerts, boolean account) {}
    public record Subscription(UUID id, String kind, String endpoint, String p256dh, String auth, String platform) {}

    private final JdbcClient jdbc;
    private final JsonMapper json;
    private final AppProperties props;
    private final FcmSender fcm;
    private final HttpClient http = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(5)).followRedirects(HttpClient.Redirect.NEVER).build();
    private final ExecutorService pool = Executors.newFixedThreadPool(2, r -> { Thread t = new Thread(r, "push"); t.setDaemon(true); return t; });
    private JsonNode texts;
    private ECPrivateKey vapidPrivate;
    private byte[] vapidPublic;

    /** {@code crypto} e cerut doar ca să fie inițializat înainte (cheile VAPID se păstrează criptate). */
    public PushService(JdbcClient jdbc, JsonMapper json, AppProperties props, FcmSender fcm, FieldCrypto crypto) {
        this.jdbc = jdbc;
        this.json = json;
        this.props = props;
        this.fcm = fcm;
    }

    @PostConstruct
    void init() throws Exception {
        texts = json.readTree(new ClassPathResource("push-texts.json").getInputStream());
        if (props.vapidPrivateKey() != null && !props.vapidPrivateKey().isBlank()) {
            vapidPrivate = WebPushCrypto.privateKey(WebPushCrypto.unb64(props.vapidPrivateKey()));
            vapidPublic = WebPushCrypto.unb64(props.vapidPublicKey());
            return;
        }
        // fără chei în configurare: le generăm o singură dată și le păstrăm criptate în baza de date
        Optional<String> stored = jdbc.sql("SELECT value FROM app_keys WHERE name = 'vapid'").query(String.class).optional();
        String value = stored.map(FieldCrypto::decrypt).orElseGet(() -> {
            KeyPair kp = WebPushCrypto.generateKeyPair();
            String v = WebPushCrypto.b64(WebPushCrypto.rawPrivate((ECPrivateKey) kp.getPrivate())) + "." + WebPushCrypto.b64(WebPushCrypto.rawPublic((ECPublicKey) kp.getPublic()));
            jdbc.sql("INSERT INTO app_keys(name, value) VALUES ('vapid', ?) ON CONFLICT (name) DO NOTHING").param(FieldCrypto.encrypt(v)).update();
            return FieldCrypto.decrypt(jdbc.sql("SELECT value FROM app_keys WHERE name = 'vapid'").query(String.class).single());
        });
        String[] parts = value.split("\\.");
        vapidPrivate = WebPushCrypto.privateKey(WebPushCrypto.unb64(parts[0]));
        vapidPublic = WebPushCrypto.unb64(parts[1]);
    }

    @PreDestroy
    void stop() { pool.shutdown(); }

    public String vapidPublicKey() { return WebPushCrypto.b64(vapidPublic); }

    // ---------------- abonamente ----------------

    /** Abonament de browser (Web Push). Același browser pe alt cont: abonamentul trece la contul nou. */
    public void subscribeWeb(UUID user, String endpoint, String p256dh, String auth, String deviceLabel) {
        URI u;
        try { u = URI.create(endpoint); } catch (Exception e) { throw ApiException.badRequest("INVALID_PUSH_ENDPOINT"); }
        if (!allowedEndpoint(u)) throw ApiException.badRequest("INVALID_PUSH_ENDPOINT");
        byte[] key, secret;
        try { key = WebPushCrypto.unb64(p256dh); secret = WebPushCrypto.unb64(auth); WebPushCrypto.publicKey(key); }
        catch (Exception e) { throw ApiException.badRequest("INVALID_PUSH_KEYS"); }
        if (secret.length != 16) throw ApiException.badRequest("INVALID_PUSH_KEYS");
        save(user, "WEB", endpoint, p256dh, auth, "web", deviceLabel);
    }

    /** Token de telefon (Firebase Cloud Messaging, Android și iOS). */
    public void subscribeNative(UUID user, String token, String platform, String deviceLabel) {
        if (token == null || !token.matches("^[A-Za-z0-9_:\\-.]{20,4096}$")) throw ApiException.badRequest("INVALID_PUSH_TOKEN");
        save(user, "FCM", token, null, null, "ios".equals(platform) ? "ios" : "android", deviceLabel);
    }

    private void save(UUID user, String kind, String endpoint, String p256dh, String auth, String platform, String label) {
        int count = jdbc.sql("SELECT count(*) FROM push_subscriptions WHERE user_id = ? AND endpoint <> ?").params(user, endpoint).query(Integer.class).single();
        if (count >= MAX_SUBSCRIPTIONS_PER_USER) {
            // păstrăm cele mai recente dispozitive
            jdbc.sql("""
                    DELETE FROM push_subscriptions WHERE id IN (SELECT id FROM push_subscriptions WHERE user_id = ?
                    ORDER BY coalesce(last_used_at, created_at) ASC LIMIT ?)""").params(user, count - MAX_SUBSCRIPTIONS_PER_USER + 1).update();
        }
        jdbc.sql("""
                INSERT INTO push_subscriptions(id, user_id, kind, endpoint, p256dh, auth_secret, platform, device_label)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT (endpoint) DO UPDATE SET user_id = EXCLUDED.user_id, kind = EXCLUDED.kind, p256dh = EXCLUDED.p256dh,
                  auth_secret = EXCLUDED.auth_secret, platform = EXCLUDED.platform, device_label = EXCLUDED.device_label, failures = 0""")
                .params(UUID.randomUUID(), user, kind, endpoint, p256dh, auth, platform, clip(label, 80)).update();
    }

    public void unsubscribe(UUID user, String endpoint) {
        jdbc.sql("DELETE FROM push_subscriptions WHERE user_id = ? AND endpoint = ?").params(user, endpoint).update();
    }

    public void unsubscribeAll(UUID user) {
        jdbc.sql("DELETE FROM push_subscriptions WHERE user_id = ?").param(user).update();
    }

    public int devices(UUID user) {
        return jdbc.sql("SELECT count(*) FROM push_subscriptions WHERE user_id = ?").param(user).query(Integer.class).single();
    }

    boolean allowedEndpoint(URI u) {
        if (u.getHost() == null || u.getUserInfo() != null) return false;
        String host = u.getHost().toLowerCase(Locale.ROOT);
        if (props.pushLocalAllowed() && "http".equals(u.getScheme()) && (host.equals("localhost") || host.equals("127.0.0.1"))) return true;
        if (!"https".equals(u.getScheme()) || (u.getPort() != -1 && u.getPort() != 443)) return false;
        return PUSH_HOSTS.stream().anyMatch(h -> host.equals(h) || host.endsWith("." + h));
    }

    // ---------------- preferințe ----------------

    public Prefs prefs(UUID user) {
        return jdbc.sql("SELECT messages, offers, orders, alerts, account FROM notification_prefs WHERE user_id = ?").param(user)
                .query((rs, i) -> new Prefs(rs.getBoolean(1), rs.getBoolean(2), rs.getBoolean(3), rs.getBoolean(4), rs.getBoolean(5)))
                .optional().orElse(new Prefs(true, true, true, true, true));
    }

    public Prefs savePrefs(UUID user, Prefs p) {
        jdbc.sql("""
                INSERT INTO notification_prefs(user_id, messages, offers, orders, alerts, account, updated_at) VALUES (?, ?, ?, ?, ?, ?, now())
                ON CONFLICT (user_id) DO UPDATE SET messages = EXCLUDED.messages, offers = EXCLUDED.offers, orders = EXCLUDED.orders,
                  alerts = EXCLUDED.alerts, account = EXCLUDED.account, updated_at = now()""")
                .params(user, p.messages(), p.offers(), p.orders(), p.alerts(), p.account()).update();
        return prefs(user);
    }

    /** Categoria unei notificări (pentru preferințe). Securitatea nu se poate opri. */
    static String category(String type) {
        if (type.startsWith("SECURITY_") || type.equals("PUSH_TEST")) return "security";
        if (type.equals("NEW_MESSAGE") || type.equals("NEW_CONVERSATION")) return "messages";
        if (type.startsWith("OFFER_") || type.startsWith("SWAP_")) return "offers";
        if (type.startsWith("ORDER_") || type.equals("PURCHASE_CONFIRMED")) return "orders";
        if (type.startsWith("PRICE_") || type.equals("SAVED_SEARCH_MATCH")) return "alerts";
        return "account";
    }

    private static boolean wants(Prefs p, String category) {
        return switch (category) {
            case "messages" -> p.messages();
            case "offers" -> p.offers();
            case "orders" -> p.orders();
            case "alerts" -> p.alerts();
            case "account" -> p.account();
            default -> true;
        };
    }

    // ---------------- trimitere ----------------

    /** Trimite alerta pe toate dispozitivele utilizatorului (după salvarea tranzacției curente). */
    public void send(UUID user, String type, Map<String, ?> params, String link) {
        Map<String, Object> copy = new HashMap<>(params);
        Runnable task = () -> pool.submit(() -> {
            try { deliver(user, type, copy, link); } catch (Exception e) { log.warn("push {} eșuat: {}", type, e.toString()); }
        });
        if (TransactionSynchronizationManager.isSynchronizationActive()) {
            TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
                @Override public void afterCommit() { task.run(); }
            });
        } else task.run();
    }

    /** Trimitere imediată (folosită de teste și de „alertă de test”). Întoarce câte dispozitive au primit. */
    public int deliver(UUID user, String type, Map<String, ?> params, String link) {
        if (!wants(prefs(user), category(type))) return 0;
        List<Subscription> subs = jdbc.sql("SELECT id, kind, endpoint, p256dh, auth_secret, platform FROM push_subscriptions WHERE user_id = ?")
                .param(user).query((rs, i) -> new Subscription(rs.getObject(1, UUID.class), rs.getString(2), rs.getString(3), rs.getString(4),
                        rs.getString(5), rs.getString(6))).list();
        if (subs.isEmpty()) return 0;
        String lang = jdbc.sql("SELECT locale FROM users WHERE id = ?").param(user).query(String.class).optional().orElse("en");
        String body = text(lang, type, params);
        if (body == null) return 0;
        String tag = params.containsKey("conversationId") ? "chat-" + params.get("conversationId") : type;
        int ok = 0;
        for (Subscription s : subs) {
            boolean delivered = "FCM".equals(s.kind()) ? fcm.send(s.endpoint(), "Cumped", body, link, type, tag, this::dropToken)
                    : sendWeb(s, body, link, type, tag);
            if (delivered) ok++;
        }
        return ok;
    }

    private boolean sendWeb(Subscription s, String body, String link, String type, String tag) {
        try {
            Map<String, Object> payload = new LinkedHashMap<>();
            payload.put("title", "Cumped");
            payload.put("body", body);
            payload.put("url", link != null && link.startsWith("/") ? link : "/notifications");
            payload.put("type", type);
            payload.put("tag", tag);
            byte[] enc = WebPushCrypto.encrypt(json.writeValueAsString(payload).getBytes(StandardCharsets.UTF_8),
                    WebPushCrypto.unb64(s.p256dh()), WebPushCrypto.unb64(s.auth()));
            HttpRequest req = HttpRequest.newBuilder(URI.create(s.endpoint())).timeout(Duration.ofSeconds(10))
                    .header("Content-Type", "application/octet-stream").header("Content-Encoding", "aes128gcm")
                    .header("TTL", "86400").header("Urgency", type.startsWith("SECURITY_") || type.equals("NEW_MESSAGE") ? "high" : "normal")
                    .header("Authorization", WebPushCrypto.vapidAuthorization(s.endpoint(), props.vapidSubject(), vapidPrivate, vapidPublic, Instant.now().getEpochSecond()))
                    .POST(HttpRequest.BodyPublishers.ofByteArray(enc)).build();
            int code = http.send(req, HttpResponse.BodyHandlers.discarding()).statusCode();
            if (code == 404 || code == 410) { // abonament expirat / browserul l-a retras
                jdbc.sql("DELETE FROM push_subscriptions WHERE id = ?").param(s.id()).update();
                return false;
            }
            if (code >= 200 && code < 300) {
                jdbc.sql("UPDATE push_subscriptions SET last_used_at = now(), failures = 0 WHERE id = ?").param(s.id()).update();
                return true;
            }
            fail(s.id());
            return false;
        } catch (Exception e) {
            fail(s.id());
            return false;
        }
    }

    private void fail(UUID id) {
        jdbc.sql("UPDATE push_subscriptions SET failures = failures + 1 WHERE id = ?").param(id).update();
        jdbc.sql("DELETE FROM push_subscriptions WHERE id = ? AND failures >= 10").param(id).update();
    }

    private void dropToken(String token) {
        jdbc.sql("DELETE FROM push_subscriptions WHERE endpoint = ?").param(token).update();
    }

    /** Textul alertei, în limba utilizatorului (cu engleza ca rezervă), cu sumele și curierii formatați. */
    String text(String lang, String type, Map<String, ?> params) {
        JsonNode l = texts.has(lang) ? texts.get(lang) : texts.get("en");
        JsonNode t = l.path("notifications").path(type);
        if (t.isMissingNode()) t = texts.get("en").path("notifications").path(type);
        if (t.isMissingNode()) return null;
        String s = t.asText();
        Locale loc = Locale.forLanguageTag(lang);
        for (Map.Entry<String, ?> e : params.entrySet()) {
            Object v = e.getValue();
            String k = e.getKey();
            if (v == null) continue;
            String val = String.valueOf(v);
            if ((k.equals("amount") || k.equals("new") || k.equals("old")) && v instanceof Number n && params.get("currency") != null) val = money(n.longValue(), String.valueOf(params.get("currency")), loc);
            if (k.equals("carrier") && l.path("carriers").has(val)) val = l.path("carriers").path(val).asText();
            if (k.equals("reason") && l.path("reasons").has(val)) val = l.path("reasons").path(val).asText();
            s = s.replace("{" + k + "}", val);
        }
        return s.replaceAll("\\{[a-zA-Z]+}", "").trim();
    }

    static String money(long cents, String currency, Locale loc) {
        try {
            NumberFormat f = NumberFormat.getCurrencyInstance(loc);
            f.setCurrency(Currency.getInstance(currency));
            int digits = cents % 100 == 0 ? 0 : 2;
            f.setMinimumFractionDigits(digits);
            f.setMaximumFractionDigits(digits);
            return f.format(cents / 100.0);
        } catch (Exception e) {
            return (cents / 100.0) + " " + currency;
        }
    }

    private static String clip(String s, int n) { return s == null ? null : s.length() > n ? s.substring(0, n) : s; }
}
