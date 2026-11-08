package com.velosyntech.cumped.config;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Limitare de cereri per IP și per grup de rute (token bucket în memorie).
 * Protejează login-ul de ghicirea parolelor, Velo AI de abuz și API-ul de scraping.
 * Pentru mai multe instanțe se înlocuiește cu Redis.
 * Nu e bean Spring intenționat: rulează doar în lanțul de securitate, nu de două ori.
 */
public class RateLimitFilter extends OncePerRequestFilter {

    private record Rule(String name, int capacity, double refillPerSecond) {}

    private static final Rule AUTH = new Rule("auth", 10, 10 / 60.0);
    private static final Rule REVEAL = new Rule("reveal", 20, 20 / 3600.0);
    private static final Rule VELO = new Rule("velo", 20, 20 / 60.0);
    private static final Rule WRITE = new Rule("write", 60, 1.0);
    private static final Rule READ = new Rule("read", 300, 5.0);

    private static final class Bucket {
        double tokens;
        long last;
        Bucket(double tokens, long last) { this.tokens = tokens; this.last = last; }
    }

    private final Map<String, Bucket> buckets = new ConcurrentHashMap<>();
    private final java.util.concurrent.atomic.AtomicLong calls = new java.util.concurrent.atomic.AtomicLong();

    @Override
    protected void doFilterInternal(HttpServletRequest req, HttpServletResponse res, FilterChain chain)
            throws ServletException, IOException {
        String path = req.getRequestURI();
        if (!path.startsWith("/api/")) { chain.doFilter(req, res); return; }
        Rule rule = ruleFor(req.getMethod(), path);
        String key = rule.name + "|" + req.getRemoteAddr();
        if (!take(key, rule)) {
            res.setStatus(429);
            res.setHeader("Retry-After", "30");
            res.setContentType("application/json");
            res.getWriter().write("{\"error\":\"RATE_LIMITED\"}");
            return;
        }
        chain.doFilter(req, res);
    }

    private Rule ruleFor(String method, String path) {
        if (path.startsWith("/api/auth/") && !path.equals("/api/auth/refresh")) return AUTH;
        if (path.startsWith("/api/verification/")) return AUTH;
        if (path.endsWith("/real-name")) return REVEAL;
        if (path.startsWith("/api/velo/")) return VELO;
        if (!"GET".equals(method)) return WRITE;
        return READ;
    }

    private boolean take(String key, Rule rule) {
        long now = System.nanoTime();
        if (calls.incrementAndGet() % 10_000 == 0) cleanup(now);
        Bucket b = buckets.computeIfAbsent(key, k -> new Bucket(rule.capacity, now));
        synchronized (b) {
            double elapsed = (now - b.last) / 1_000_000_000.0;
            b.tokens = Math.min(rule.capacity, b.tokens + elapsed * rule.refillPerSecond);
            b.last = now;
            if (b.tokens < 1) return false;
            b.tokens -= 1;
            return true;
        }
    }

    private void cleanup(long now) {
        long cutoff = now - 3_600_000_000_000L;
        buckets.entrySet().removeIf(e -> e.getValue().last < cutoff);
    }
}
