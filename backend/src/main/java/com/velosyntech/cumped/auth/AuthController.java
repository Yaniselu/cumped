package com.velosyntech.cumped.auth;

import com.velosyntech.cumped.common.ApiException;
import com.velosyntech.cumped.common.CurrentUser;
import com.velosyntech.cumped.config.AppProperties;
import com.velosyntech.cumped.user.*;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseCookie;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.Duration;

@RestController
@RequestMapping("/api/auth")
public class AuthController {
    static final String COOKIE = "cmp_rt";
    private static final String CSRF_HEADER = "X-Requested-With";

    private final AuthService auth;
    private final TokenService tokens;
    private final SocialTokenVerifier social;
    private final UserRepository users;
    private final QuotaService quota;
    private final AppProperties props;

    public AuthController(AuthService auth, TokenService tokens, SocialTokenVerifier social, UserRepository users,
                          QuotaService quota, AppProperties props) {
        this.auth = auth;
        this.tokens = tokens;
        this.social = social;
        this.users = users;
        this.quota = quota;
        this.props = props;
    }

    @PostMapping("/register")
    ResponseEntity<AuthDtos.AuthResponse> register(@Valid @RequestBody AuthDtos.RegisterRequest r) {
        return respond(auth.register(r), HttpStatus.CREATED);
    }

    @PostMapping("/login")
    ResponseEntity<AuthDtos.AuthResponse> login(@Valid @RequestBody AuthDtos.LoginRequest r) {
        return respond(auth.login(r), HttpStatus.OK);
    }

    @PostMapping("/google")
    ResponseEntity<AuthDtos.AuthResponse> google(@Valid @RequestBody AuthDtos.SocialRequest r) {
        return respond(auth.social("google", social.verifyGoogle(r.idToken()), r), HttpStatus.OK);
    }

    @PostMapping("/apple")
    ResponseEntity<AuthDtos.AuthResponse> apple(@Valid @RequestBody AuthDtos.SocialRequest r) {
        return respond(auth.social("apple", social.verifyApple(r.idToken()), r), HttpStatus.OK);
    }

    @PostMapping("/refresh")
    ResponseEntity<AuthDtos.AuthResponse> refresh(HttpServletRequest req, @CookieValue(name = COOKIE, required = false) String raw) {
        requireCsrfHeader(req);
        RefreshToken old = tokens.rotate(raw);
        User u = users.findById(old.getUserId()).orElseThrow(() -> new ApiException(HttpStatus.UNAUTHORIZED, "SESSION_EXPIRED"));
        if (u.isSuspended()) throw new ApiException(HttpStatus.FORBIDDEN, "ACCOUNT_SUSPENDED");
        TokenService.Issued issued = tokens.issueInFamily(u, old.getFamily());
        return build(u, issued, HttpStatus.OK);
    }

    @PostMapping("/logout")
    ResponseEntity<Void> logout(HttpServletRequest req, @CookieValue(name = COOKIE, required = false) String raw) {
        requireCsrfHeader(req);
        tokens.revoke(raw);
        return ResponseEntity.noContent().header(HttpHeaders.SET_COOKIE, cookie("", Duration.ZERO).toString()).build();
    }

    @PostMapping("/logout-all")
    ResponseEntity<Void> logoutAll(HttpServletRequest req) {
        requireCsrfHeader(req);
        auth.logoutEverywhere(CurrentUser.id());
        return ResponseEntity.noContent().header(HttpHeaders.SET_COOKIE, cookie("", Duration.ZERO).toString()).build();
    }

    @PostMapping("/change-password")
    ResponseEntity<Void> changePassword(@Valid @RequestBody AuthDtos.ChangePasswordRequest r) {
        auth.changePassword(CurrentUser.id(), r);
        return ResponseEntity.noContent().build();
    }

    private ResponseEntity<AuthDtos.AuthResponse> respond(User u, HttpStatus status) {
        return build(u, tokens.issue(u), status);
    }

    private ResponseEntity<AuthDtos.AuthResponse> build(User u, TokenService.Issued issued, HttpStatus status) {
        return ResponseEntity.status(status)
                .header(HttpHeaders.SET_COOKIE, cookie(issued.refreshToken(), props.refreshTokenTtl()).toString())
                .header(HttpHeaders.CACHE_CONTROL, "no-store")
                .body(new AuthDtos.AuthResponse(issued.accessToken(), issued.expiresInSeconds(),
                        UserDtos.toMe(u, quota.quotaFor(u))));
    }

    private ResponseCookie cookie(String value, Duration maxAge) {
        return ResponseCookie.from(COOKIE, value)
                .httpOnly(true)
                .secure(props.cookieSecure())
                .sameSite("Strict")
                .path("/api/auth")
                .maxAge(maxAge)
                .build();
    }

    /** Cookie-ul de sesiune poate fi folosit doar de aplicația noastră: browserul nu trimite acest header cross-site fără CORS. */
    private static void requireCsrfHeader(HttpServletRequest req) {
        if (!"cumped".equals(req.getHeader(CSRF_HEADER))) throw ApiException.forbidden();
    }
}
