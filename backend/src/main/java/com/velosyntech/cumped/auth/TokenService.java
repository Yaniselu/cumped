package com.velosyntech.cumped.auth;

import com.velosyntech.cumped.common.ApiException;
import com.velosyntech.cumped.common.Texts;
import com.velosyntech.cumped.config.AppProperties;
import com.velosyntech.cumped.user.User;
import org.springframework.http.HttpStatus;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.security.oauth2.jose.jws.MacAlgorithm;
import org.springframework.security.oauth2.jwt.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.time.Instant;
import java.util.UUID;

/**
 * Token de acces: JWT scurt (15 min), ținut doar în memorie pe client.
 * Token de refresh: aleator, opac, stocat doar ca hash, rotit la fiecare folosire.
 * Dacă un refresh token vechi e refolosit (furt), toată familia de sesiuni e revocată.
 */
@Service
public class TokenService {
    public record Issued(String accessToken, long expiresInSeconds, String refreshToken) {}

    private final JwtEncoder encoder;
    private final RefreshTokenRepository refreshTokens;
    private final AppProperties props;

    public TokenService(JwtEncoder encoder, RefreshTokenRepository refreshTokens, AppProperties props) {
        this.encoder = encoder;
        this.refreshTokens = refreshTokens;
        this.props = props;
    }

    @Transactional
    public Issued issue(User user) {
        return issue(user, UUID.randomUUID());
    }

    private Issued issue(User user, UUID family) {
        String access = accessToken(user);
        String raw = Texts.randomToken(32);
        refreshTokens.save(new RefreshToken(user.getId(), Texts.sha256(raw), family,
                Instant.now().plus(props.refreshTokenTtl())));
        return new Issued(access, props.accessTokenTtl().toSeconds(), raw);
    }

    public String accessToken(User user) {
        Instant now = Instant.now();
        JwtClaimsSet claims = JwtClaimsSet.builder()
                .issuer("cumped")
                .subject(user.getId().toString())
                .issuedAt(now)
                .expiresAt(now.plus(props.accessTokenTtl()))
                .id(UUID.randomUUID().toString())
                .claim("typ", "access")
                .claim("role", user.getRole().name())
                .claim("tv", user.getTokenVersion())
                .build();
        return encoder.encode(JwtEncoderParameters.from(JwsHeader.with(MacAlgorithm.HS256).build(), claims)).getTokenValue();
    }

    /**
     * Rotește refresh token-ul. noRollbackFor: revocarea familiei la refolosire trebuie să rămână salvată
     * chiar dacă cererea e respinsă cu eroare.
     */
    @Transactional(noRollbackFor = ApiException.class)
    public RefreshToken rotate(String raw) {
        if (raw == null || raw.length() < 20 || raw.length() > 100) throw unauthorized();
        RefreshToken t = refreshTokens.findByTokenHash(Texts.sha256(raw)).orElseThrow(TokenService::unauthorized);
        if (t.getRevokedAt() != null) {
            // Refolosire a unui token deja rotit: posibil furt. Revocăm toată familia.
            refreshTokens.revokeFamily(t.getFamily(), Instant.now());
            throw unauthorized();
        }
        if (t.getExpiresAt().isBefore(Instant.now())) throw unauthorized();
        t.revoke();
        return t;
    }

    @Transactional
    public Issued issueInFamily(User user, UUID family) { return issue(user, family); }

    @Transactional
    public void revoke(String raw) {
        if (raw == null) return;
        refreshTokens.findByTokenHash(Texts.sha256(raw)).ifPresent(t -> refreshTokens.revokeFamily(t.getFamily(), Instant.now()));
    }

    @Transactional
    public void revokeAll(UUID userId) { refreshTokens.revokeAllForUser(userId, Instant.now()); }

    @Scheduled(cron = "0 17 3 * * *")
    @Transactional
    public void purge() { refreshTokens.deleteExpired(Instant.now().minus(Duration.ofDays(7))); }

    private static ApiException unauthorized() { return new ApiException(HttpStatus.UNAUTHORIZED, "SESSION_EXPIRED"); }
}
