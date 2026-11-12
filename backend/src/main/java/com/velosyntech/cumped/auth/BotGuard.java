package com.velosyntech.cumped.auth;

import com.velosyntech.cumped.common.ApiException;
import com.velosyntech.cumped.common.AuditService;
import com.velosyntech.cumped.config.AppProperties;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

import java.net.URI;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;

/**
 * Protecție anti-roboți la crearea conturilor, în trei straturi:
 *  1. câmp-capcană (honeypot) invizibil pentru oameni;
 *  2. timpul de completare: un formular completat în sub 1,5 secunde nu e completat de un om;
 *  3. Cloudflare Turnstile (CAPTCHA fără puzzle), verificat pe server, când TURNSTILE_SECRET e setat.
 * Pe lângă acestea: limitarea cererilor pe IP și limitarea login-ului pe email/IP.
 */
@Component
public class BotGuard {
    private static final Logger log = LoggerFactory.getLogger(BotGuard.class);
    static final long MIN_FILL_MS = 1500;

    private final AppProperties props;
    private final AuditService audit;
    private final JsonMapper json;
    private final HttpClient http = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(5)).build();

    public BotGuard(AppProperties props, AuditService audit, JsonMapper json) {
        this.props = props;
        this.audit = audit;
        this.json = json;
    }

    public void check(String honeypot, Long elapsedMs, String captchaToken, String ip) {
        if (honeypot != null && !honeypot.isBlank()) reject("honeypot", ip);
        if (elapsedMs != null && elapsedMs < MIN_FILL_MS) reject("too-fast", ip);
        if (props.captchaEnabled() && !turnstileOk(captchaToken, ip)) reject("captcha", ip);
    }

    private void reject(String why, String ip) {
        audit.log(null, "BOT_BLOCKED", why);
        // același mesaj pentru orice motiv: robotul nu află ce l-a dat de gol
        throw new ApiException(HttpStatus.BAD_REQUEST, "BOT_DETECTED");
    }

    private boolean turnstileOk(String token, String ip) {
        if (token == null || token.isBlank()) return false;
        try {
            String body = "secret=" + enc(props.turnstileSecret()) + "&response=" + enc(token) + (ip == null ? "" : "&remoteip=" + enc(ip));
            HttpResponse<String> r = http.send(HttpRequest.newBuilder(URI.create("https://challenges.cloudflare.com/turnstile/v0/siteverify"))
                    .timeout(Duration.ofSeconds(8)).header("Content-Type", "application/x-www-form-urlencoded")
                    .POST(HttpRequest.BodyPublishers.ofString(body)).build(), HttpResponse.BodyHandlers.ofString());
            JsonNode n = json.readTree(r.body());
            return n.path("success").asBoolean(false);
        } catch (Exception e) {
            log.warn("Turnstile indisponibil ({}), cererea e respinsă", e.getClass().getSimpleName());
            return false;
        }
    }

    private static String enc(String s) { return URLEncoder.encode(s, StandardCharsets.UTF_8); }
}
