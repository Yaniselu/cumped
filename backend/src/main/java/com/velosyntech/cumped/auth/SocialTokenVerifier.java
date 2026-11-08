package com.velosyntech.cumped.auth;

import com.velosyntech.cumped.common.ApiException;
import com.velosyntech.cumped.config.AppProperties;
import org.springframework.http.HttpStatus;
import org.springframework.security.oauth2.core.DelegatingOAuth2TokenValidator;
import org.springframework.security.oauth2.core.OAuth2Error;
import org.springframework.security.oauth2.core.OAuth2TokenValidator;
import org.springframework.security.oauth2.core.OAuth2TokenValidatorResult;
import org.springframework.security.oauth2.jose.jws.SignatureAlgorithm;
import org.springframework.security.oauth2.jwt.*;
import org.springframework.stereotype.Component;

import java.util.List;

/**
 * Verifică ID token-urile de la Google și Apple pe server: semnătura (cheile publice ale furnizorului),
 * emitentul, audiența (client ID-urile noastre) și expirarea. Nu ne bazăm niciodată pe datele trimise de client.
 */
@Component
public class SocialTokenVerifier {
    public record Identity(String subject, String email, boolean emailVerified) {}

    private final AppProperties props;
    private volatile JwtDecoder google;
    private volatile JwtDecoder apple;

    public SocialTokenVerifier(AppProperties props) { this.props = props; }

    public Identity verifyGoogle(String idToken) {
        if (props.googleClientIdList().isEmpty()) throw notConfigured();
        if (google == null) google = decoder("https://www.googleapis.com/oauth2/v3/certs",
                List.of("https://accounts.google.com", "accounts.google.com"), props.googleClientIdList());
        return decode(google, idToken);
    }

    public Identity verifyApple(String idToken) {
        if (props.appleClientIdList().isEmpty()) throw notConfigured();
        if (apple == null) apple = decoder("https://appleid.apple.com/auth/keys",
                List.of("https://appleid.apple.com"), props.appleClientIdList());
        return decode(apple, idToken);
    }

    private Identity decode(JwtDecoder decoder, String token) {
        if (token == null || token.length() > 5000) throw invalid();
        try {
            Jwt jwt = decoder.decode(token);
            Object ev = jwt.getClaim("email_verified");
            boolean verified = Boolean.TRUE.equals(ev) || "true".equals(String.valueOf(ev));
            return new Identity(jwt.getSubject(), jwt.getClaimAsString("email"), verified);
        } catch (JwtException e) {
            throw invalid();
        }
    }

    private JwtDecoder decoder(String jwks, List<String> issuers, List<String> audiences) {
        NimbusJwtDecoder d = NimbusJwtDecoder.withJwkSetUri(jwks).jwsAlgorithm(SignatureAlgorithm.RS256).build();
        OAuth2TokenValidator<Jwt> issuer = jwt -> issuers.contains(jwt.getClaimAsString("iss"))
                ? OAuth2TokenValidatorResult.success()
                : OAuth2TokenValidatorResult.failure(new OAuth2Error("invalid_token", "issuer", null));
        OAuth2TokenValidator<Jwt> audience = jwt -> jwt.getAudience() != null && jwt.getAudience().stream().anyMatch(audiences::contains)
                ? OAuth2TokenValidatorResult.success()
                : OAuth2TokenValidatorResult.failure(new OAuth2Error("invalid_token", "audience", null));
        d.setJwtValidator(new DelegatingOAuth2TokenValidator<>(JwtValidators.createDefault(), issuer, audience));
        return d;
    }

    private static ApiException notConfigured() { return new ApiException(HttpStatus.SERVICE_UNAVAILABLE, "PROVIDER_NOT_CONFIGURED"); }
    private static ApiException invalid() { return new ApiException(HttpStatus.UNAUTHORIZED, "INVALID_SOCIAL_TOKEN"); }
}
