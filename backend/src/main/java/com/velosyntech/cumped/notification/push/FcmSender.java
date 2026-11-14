package com.velosyntech.cumped.notification.push;

import com.velosyntech.cumped.config.AppProperties;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

import java.net.URI;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.security.KeyFactory;
import java.security.PrivateKey;
import java.security.Signature;
import java.security.spec.PKCS8EncodedKeySpec;
import java.time.Duration;
import java.time.Instant;
import java.util.Base64;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.function.Consumer;

/**
 * Alerte pe telefon prin Firebase Cloud Messaging (HTTP v1): aceeași cale pentru Android și iOS (APNs prin Firebase).
 * Activ doar când FCM_SERVICE_ACCOUNT conține contul de serviciu Firebase (JSON, în base64).
 */
@Component
public class FcmSender {
    private static final Logger log = LoggerFactory.getLogger(FcmSender.class);
    private final AppProperties props;
    private final JsonMapper json;
    private final HttpClient http = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(5)).build();
    private String projectId, clientEmail, tokenUri;
    private PrivateKey key;
    private String accessToken;
    private Instant accessTokenExpires = Instant.EPOCH;

    public FcmSender(AppProperties props, JsonMapper json) {
        this.props = props;
        this.json = json;
        if (props.fcmEnabled()) {
            try {
                JsonNode sa = json.readTree(new String(Base64.getDecoder().decode(props.fcmServiceAccount().trim()), StandardCharsets.UTF_8));
                projectId = sa.path("project_id").asText();
                clientEmail = sa.path("client_email").asText();
                tokenUri = sa.path("token_uri").asText("https://oauth2.googleapis.com/token");
                String pem = sa.path("private_key").asText().replaceAll("-----[A-Z ]+-----", "").replaceAll("\\s", "");
                key = KeyFactory.getInstance("RSA").generatePrivate(new PKCS8EncodedKeySpec(Base64.getDecoder().decode(pem)));
            } catch (Exception e) {
                throw new IllegalStateException("FCM_SERVICE_ACCOUNT invalid (trebuie să fie fișierul JSON al contului de serviciu, în base64).", e);
            }
        }
    }

    public boolean enabled() { return key != null; }

    /** Trimite alerta; dacă token-ul nu mai e valid (aplicație dezinstalată), îl scoate prin {@code drop}. */
    public boolean send(String token, String title, String body, String link, String type, String tag, Consumer<String> drop) {
        if (!enabled()) return false;
        try {
            Map<String, Object> data = new LinkedHashMap<>();
            data.put("url", link == null ? "/notifications" : link);
            data.put("type", type);
            Map<String, Object> message = Map.of("message", Map.of(
                    "token", token,
                    "notification", Map.of("title", title, "body", body),
                    "data", data,
                    "android", Map.of("priority", "high", "collapse_key", tag, "notification", Map.of("channel_id", "cumped", "tag", tag)),
                    "apns", Map.of("headers", Map.of("apns-collapse-id", tag.length() > 64 ? tag.substring(0, 64) : tag),
                            "payload", Map.of("aps", Map.of("sound", "default", "thread-id", tag)))));
            HttpRequest req = HttpRequest.newBuilder(URI.create("https://fcm.googleapis.com/v1/projects/" + projectId + "/messages:send"))
                    .timeout(Duration.ofSeconds(10)).header("Authorization", "Bearer " + accessToken()).header("Content-Type", "application/json")
                    .POST(HttpRequest.BodyPublishers.ofString(json.writeValueAsString(message))).build();
            HttpResponse<String> r = http.send(req, HttpResponse.BodyHandlers.ofString());
            if (r.statusCode() == 404 || (r.statusCode() == 400 && r.body().contains("INVALID_ARGUMENT") && r.body().contains("token"))) {
                drop.accept(token);
                return false;
            }
            if (r.statusCode() / 100 != 2) log.warn("FCM {}: {}", r.statusCode(), r.body().length() > 200 ? r.body().substring(0, 200) : r.body());
            return r.statusCode() / 100 == 2;
        } catch (Exception e) {
            log.warn("FCM eșuat: {}", e.toString());
            return false;
        }
    }

    /** Token OAuth2 pentru Firebase, obținut cu o aserțiune JWT semnată RS256 (fără biblioteci Google). */
    private synchronized String accessToken() throws Exception {
        if (accessToken != null && Instant.now().isBefore(accessTokenExpires.minusSeconds(60))) return accessToken;
        long now = Instant.now().getEpochSecond();
        String header = b64("{\"alg\":\"RS256\",\"typ\":\"JWT\"}");
        String claims = b64(json.writeValueAsString(Map.of("iss", clientEmail, "scope", "https://www.googleapis.com/auth/firebase.messaging",
                "aud", tokenUri, "iat", now, "exp", now + 3600)));
        Signature s = Signature.getInstance("SHA256withRSA");
        s.initSign(key);
        s.update((header + "." + claims).getBytes(StandardCharsets.US_ASCII));
        String jwt = header + "." + claims + "." + Base64.getUrlEncoder().withoutPadding().encodeToString(s.sign());
        HttpRequest req = HttpRequest.newBuilder(URI.create(tokenUri)).timeout(Duration.ofSeconds(10))
                .header("Content-Type", "application/x-www-form-urlencoded")
                .POST(HttpRequest.BodyPublishers.ofString("grant_type=" + URLEncoder.encode("urn:ietf:params:oauth:grant-type:jwt-bearer", StandardCharsets.UTF_8)
                        + "&assertion=" + jwt)).build();
        JsonNode r = json.readTree(http.send(req, HttpResponse.BodyHandlers.ofString()).body());
        accessToken = r.path("access_token").asText();
        accessTokenExpires = Instant.now().plusSeconds(r.path("expires_in").asLong(3600));
        return accessToken;
    }

    private static String b64(String s) { return Base64.getUrlEncoder().withoutPadding().encodeToString(s.getBytes(StandardCharsets.UTF_8)); }
}
