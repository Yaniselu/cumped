package com.velosyntech.cumped.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

import java.time.Duration;
import java.util.Arrays;
import java.util.List;

@ConfigurationProperties("cumped")
public record AppProperties(
        String jwtSecret,
        Duration accessTokenTtl,
        Duration refreshTokenTtl,
        String corsOrigins,
        boolean cookieSecure,
        String uploadsDir,
        String supportEmail,
        String mailFrom,
        String publicUrl,
        String anthropicApiKey,
        String anthropicModel,
        String googleClientIds,
        String appleClientIds,
        String adminEmail,
        String adminPassword,
        boolean devMode,
        boolean demoData,
        Boolean rateLimit,
        String companyName,
        String companyAddress,
        String companyRegNo,
        String companyVat,
        String companyEmail,
        String dpoEmail
) {
    public boolean rateLimitEnabled() { return rateLimit == null || rateLimit; }
    public List<String> corsOriginList() { return split(corsOrigins); }
    public List<String> googleClientIdList() { return split(googleClientIds); }
    public List<String> appleClientIdList() { return split(appleClientIds); }
    public boolean aiEnabled() { return anthropicApiKey != null && !anthropicApiKey.isBlank(); }

    private static List<String> split(String v) {
        if (v == null || v.isBlank()) return List.of();
        return Arrays.stream(v.split(",")).map(String::trim).filter(s -> !s.isEmpty()).toList();
    }
}
