package com.velosyntech.cumped.auth;

import com.velosyntech.cumped.common.ApiException;
import com.velosyntech.cumped.common.AuditService;
import com.velosyntech.cumped.common.Texts;
import com.velosyntech.cumped.config.UserStatusCache;
import com.velosyntech.cumped.user.*;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.time.Instant;
import java.util.Locale;
import java.util.Set;
import java.util.UUID;

@Service
public class AuthService {
    /** Versiunea curentă a Termenilor și a Politicii de confidențialitate (o schimbare cere re-acceptare). */
    public static final String TERMS_VERSION = "2026-11";
    private static final Set<String> RESERVED = Set.of("admin", "administrator", "root", "support", "suport", "velo",
            "veloai", "cumped", "moderator", "staff", "official", "oficial", "help", "ajutor", "system", "security");
    private static final int MAX_FAILED = 5;
    private static final Duration LOCK = Duration.ofMinutes(15);
    private static final Set<String> LOCALES = Set.of("ro", "en", "de", "fr", "es", "it", "hu", "pl", "uk", "tr",
            "pt", "nl", "bg", "cs", "el", "sv");

    private final UserRepository users;
    private final ReferralRepository referrals;
    private final PasswordEncoder encoder;
    private final TokenService tokens;
    private final AuditService audit;
    private final UserStatusCache statusCache;
    /** Hash fals: login-ul durează la fel și când email-ul nu există (nu putem afla ce conturi există). */
    private final String dummyHash;

    public AuthService(UserRepository users, ReferralRepository referrals, PasswordEncoder encoder,
                       TokenService tokens, AuditService audit, UserStatusCache statusCache) {
        this.users = users;
        this.referrals = referrals;
        this.encoder = encoder;
        this.tokens = tokens;
        this.audit = audit;
        this.statusCache = statusCache;
        this.dummyHash = encoder.encode(Texts.randomToken(16));
    }

    @Transactional
    public User register(AuthDtos.RegisterRequest r) {
        if (!Boolean.TRUE.equals(r.acceptTerms()) || !Boolean.TRUE.equals(r.adultConfirmed())) throw ApiException.badRequest("TERMS_REQUIRED");
        String email = normalizeEmail(r.email());
        String username = normalizeUsername(r.username());
        PasswordPolicy.check(r.password(), email, username);
        if (users.existsByEmail(email)) throw ApiException.conflict("EMAIL_TAKEN");
        if (users.existsByUsernameIgnoreCase(username)) throw ApiException.conflict("USERNAME_TAKEN");
        User u = new User();
        u.setEmail(email);
        u.setUsername(username);
        u.setPasswordHash(encoder.encode(r.password()));
        u.acceptTerms(TERMS_VERSION);
        applyCommon(u, r.locale(), r.country(), r.city());
        users.save(u);
        attachReferral(u, r.referralCode());
        audit.log(u.getId(), "REGISTER", null);
        return u;
    }

    @Transactional(noRollbackFor = ApiException.class)
    public User login(AuthDtos.LoginRequest r) {
        String email = normalizeEmail(r.email());
        User u = users.findByEmail(email).orElse(null);
        if (u == null || u.getPasswordHash() == null) {
            encoder.matches(r.password(), dummyHash);
            throw invalidCredentials();
        }
        if (u.getLockedUntil() != null && u.getLockedUntil().isAfter(Instant.now())) {
            encoder.matches(r.password(), dummyHash);
            throw new ApiException(HttpStatus.TOO_MANY_REQUESTS, "ACCOUNT_LOCKED");
        }
        if (!encoder.matches(r.password(), u.getPasswordHash())) {
            u.setFailedLogins(u.getFailedLogins() + 1);
            if (u.getFailedLogins() >= MAX_FAILED) {
                u.setLockedUntil(Instant.now().plus(LOCK));
                u.setFailedLogins(0);
                audit.log(u.getId(), "LOCKED", null);
            }
            users.save(u);
            throw invalidCredentials();
        }
        if (u.isSuspended()) throw new ApiException(HttpStatus.FORBIDDEN, "ACCOUNT_SUSPENDED");
        u.setFailedLogins(0);
        u.setLockedUntil(null);
        users.save(u);
        audit.log(u.getId(), "LOGIN", null);
        return u;
    }

    @Transactional
    public User social(String provider, SocialTokenVerifier.Identity id, AuthDtos.SocialRequest r) {
        User u = "google".equals(provider) ? users.findByGoogleSub(id.subject()).orElse(null)
                : users.findByAppleSub(id.subject()).orElse(null);
        if (u == null && id.email() != null && id.emailVerified()) {
            u = users.findByEmail(normalizeEmail(id.email())).orElse(null);
        }
        if (u == null) {
            if (id.email() == null || !id.emailVerified()) throw ApiException.badRequest("EMAIL_NOT_VERIFIED");
            if (!Boolean.TRUE.equals(r.acceptTerms()) || !Boolean.TRUE.equals(r.adultConfirmed())) throw ApiException.badRequest("TERMS_REQUIRED");
            u = new User();
            u.acceptTerms(TERMS_VERSION);
            u.setEmail(normalizeEmail(id.email()));
            u.setUsername(generateUsername(id.email()));
            applyCommon(u, r.locale(), r.country(), null);
            users.save(u);
            attachReferral(u, r.referralCode());
            audit.log(u.getId(), "REGISTER_" + provider.toUpperCase(Locale.ROOT), null);
        }
        if ("google".equals(provider)) u.setGoogleSub(id.subject()); else u.setAppleSub(id.subject());
        if (u.isSuspended()) throw new ApiException(HttpStatus.FORBIDDEN, "ACCOUNT_SUSPENDED");
        users.save(u);
        return u;
    }

    @Transactional
    public void changePassword(UUID userId, AuthDtos.ChangePasswordRequest r) {
        User u = users.findById(userId).orElseThrow(ApiException::notFound);
        if (u.getPasswordHash() != null && (r.currentPassword() == null || !encoder.matches(r.currentPassword(), u.getPasswordHash())))
            throw invalidCredentials();
        PasswordPolicy.check(r.newPassword(), u.getEmail(), u.getUsername());
        u.setPasswordHash(encoder.encode(r.newPassword()));
        u.bumpTokenVersion();
        users.save(u);
        tokens.revokeAll(userId);
        statusCache.evict(userId);
        audit.log(userId, "PASSWORD_CHANGED", null);
    }

    @Transactional
    public void logoutEverywhere(UUID userId) {
        User u = users.findById(userId).orElseThrow(ApiException::notFound);
        u.bumpTokenVersion();
        users.save(u);
        tokens.revokeAll(userId);
        statusCache.evict(userId);
        audit.log(userId, "LOGOUT_ALL", null);
    }

    private void applyCommon(User u, String locale, String country, String city) {
        u.setLocale(locale != null && LOCALES.contains(locale) ? locale : "en");
        u.setCountry(country == null ? null : country.toUpperCase(Locale.ROOT));
        u.setCity(Texts.clean(city));
        u.setAvatarHue(Texts.randomInt(360));
        String code;
        do { code = Texts.randomCode(8); } while (users.findByReferralCode(code).isPresent());
        u.setReferralCode(code);
    }

    private void attachReferral(User u, String code) {
        if (code == null || code.isBlank()) return;
        users.findByReferralCode(code.trim().toUpperCase(Locale.ROOT))
                .filter(inviter -> !inviter.getId().equals(u.getId()))
                .ifPresent(inviter -> {
                    u.setReferredBy(inviter.getId());
                    users.save(u);
                    referrals.save(new Referral(u.getId(), inviter.getId()));
                });
    }

    static String normalizeEmail(String email) {
        String e = Texts.clean(email).toLowerCase(Locale.ROOT);
        if (e.length() > 254 || !e.matches("^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$")) throw ApiException.badRequest("INVALID_EMAIL");
        return e;
    }

    public static String normalizeUsername(String username) {
        String u = Texts.clean(username).toLowerCase(Locale.ROOT);
        if (!u.matches("^[a-z0-9_.]{3,20}$") || u.startsWith(".") || u.endsWith(".") || u.contains(".."))
            throw ApiException.badRequest("INVALID_USERNAME");
        if (RESERVED.contains(u.replace(".", "").replace("_", ""))) throw ApiException.conflict("USERNAME_TAKEN");
        return u;
    }

    private String generateUsername(String email) {
        String base = email.split("@")[0].toLowerCase(Locale.ROOT).replaceAll("[^a-z0-9]", "");
        if (base.length() < 3) base = "user";
        if (base.length() > 14) base = base.substring(0, 14);
        String candidate;
        do { candidate = base + (1000 + Texts.randomInt(9000)); } while (users.existsByUsernameIgnoreCase(candidate));
        return candidate;
    }

    private static ApiException invalidCredentials() { return new ApiException(HttpStatus.UNAUTHORIZED, "INVALID_CREDENTIALS"); }
}
