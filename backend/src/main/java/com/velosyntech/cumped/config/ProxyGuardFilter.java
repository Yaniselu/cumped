package com.velosyntech.cumped.config;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletRequestWrapper;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.regex.Pattern;

/**
 * În producție, API-ul stă în spatele site-ului (Vercel). Vercel adaugă la fiecare cerere spre /api un antet secret
 * (vizitatorii nu-l pot trimite ei înșiși: Vercel îl suprascrie) și pune IP-ul real al clientului în X-Forwarded-For.
 *  - cererile fără secret sunt refuzate (nimeni nu poate ocoli site-ul și protecțiile lui);
 *  - pentru cererile cu secret, IP-ul clientului e primul din X-Forwarded-For (pus de Vercel),
 *    ca limitele de cereri să fie pe utilizator, nu pe serverele Vercel.
 * Fără PROXY_SECRET (dezvoltare, docker-compose cu nginx), filtrul nu face nimic.
 */
public class ProxyGuardFilter extends OncePerRequestFilter {
    public static final String HEADER = "X-Cumped-Proxy";
    private static final Pattern IP = Pattern.compile("^[0-9a-fA-F:.]{3,45}$");
    private final byte[] secret;

    public ProxyGuardFilter(String secret) { this.secret = secret.getBytes(StandardCharsets.UTF_8); }

    @Override
    protected void doFilterInternal(HttpServletRequest req, HttpServletResponse res, FilterChain chain) throws ServletException, IOException {
        String path = req.getRequestURI();
        if (!path.startsWith("/api/")) { chain.doFilter(req, res); return; } // ex. /actuator/health pentru verificarea serverului
        String given = req.getHeader(HEADER);
        if (given == null || !MessageDigest.isEqual(secret, given.getBytes(StandardCharsets.UTF_8))) {
            res.setStatus(404);
            res.setContentType("application/json");
            res.getWriter().write("{\"error\":\"NOT_FOUND\"}");
            return;
        }
        String xff = req.getHeader("X-Forwarded-For");
        String client = xff == null ? null : xff.split(",")[0].trim();
        if (client == null || !IP.matcher(client).matches()) { chain.doFilter(req, res); return; }
        chain.doFilter(new HttpServletRequestWrapper(req) {
            @Override public String getRemoteAddr() { return client; }
            @Override public String getRemoteHost() { return client; }
            @Override public String getHeader(String name) { return HEADER.equalsIgnoreCase(name) ? null : super.getHeader(name); }
        }, res);
    }
}
