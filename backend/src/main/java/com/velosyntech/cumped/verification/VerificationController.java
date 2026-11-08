package com.velosyntech.cumped.verification;

import com.velosyntech.cumped.common.ApiException;
import com.velosyntech.cumped.common.AuditService;
import com.velosyntech.cumped.common.CurrentUser;
import com.velosyntech.cumped.common.Texts;
import com.velosyntech.cumped.config.AppProperties;
import com.velosyntech.cumped.user.QuotaService;
import com.velosyntech.cumped.user.User;
import com.velosyntech.cumped.user.UserRepository;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import org.springframework.http.HttpStatus;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.time.Instant;
import java.util.HashMap;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Verificarea identității și a telefonului.
 * În producție: identitatea prin Stripe Identity (pozele documentelor nu ajung la noi, primim doar numele și rezultatul),
 * telefonul prin SMS. Până sunt configurate, în DEV_MODE fluxurile sunt simulate, ca să se poată testa aplicația.
 */
@RestController
@RequestMapping("/api/verification")
public class VerificationController {
    public record DevIdentity(@NotBlank @Pattern(regexp = "^[\\p{L}' -]{2,40}$") String firstName,
                              @NotBlank @Pattern(regexp = "^[\\p{L}' -]{2,40}$") String lastName) {}
    public record PhoneStart(@NotBlank @Pattern(regexp = "^\\+[1-9]\\d{7,14}$") String phone) {}
    public record PhoneConfirm(@NotBlank @Pattern(regexp = "^\\d{6}$") String code) {}

    private record PendingCode(String phoneHash, String last2, String codeHash, Instant expiresAt, int attempts) {}

    private final UserRepository users;
    private final QuotaService quota;
    private final AuditService audit;
    private final AppProperties props;
    private final Map<UUID, PendingCode> pending = new ConcurrentHashMap<>();

    public VerificationController(UserRepository users, QuotaService quota, AuditService audit, AppProperties props) {
        this.users = users;
        this.quota = quota;
        this.audit = audit;
        this.props = props;
    }

    @PostMapping("/identity/start")
    Map<String, Object> startIdentity() {
        User u = users.findById(CurrentUser.id()).orElseThrow(ApiException::notFound);
        if (u.isIdVerified()) throw ApiException.conflict("ALREADY_VERIFIED");
        if (props.devMode()) return Map.of("mode", "DEV");
        throw new ApiException(HttpStatus.SERVICE_UNAVAILABLE, "VERIFICATION_NOT_CONFIGURED");
    }

    @PostMapping("/identity/dev-complete")
    @Transactional
    Map<String, Object> devComplete(@Valid @RequestBody DevIdentity r) {
        if (!props.devMode()) throw ApiException.notFound();
        User u = users.findById(CurrentUser.id()).orElseThrow(ApiException::notFound);
        if (u.isIdVerified()) throw ApiException.conflict("ALREADY_VERIFIED");
        u.setLegalFirstName(capitalize(Texts.clean(r.firstName())));
        u.setLegalLastName(capitalize(Texts.clean(r.lastName())));
        u.setIdVerified(true);
        u.setIdVerifiedAt(Instant.now());
        users.save(u);
        quota.markReferralQualified(u.getId());
        audit.log(u.getId(), "ID_VERIFIED_DEV", null);
        return Map.of("verified", true);
    }

    @PostMapping("/phone/start")
    Map<String, Object> startPhone(@Valid @RequestBody PhoneStart r) {
        UUID me = CurrentUser.id();
        String hash = Texts.sha256("phone|" + r.phone());
        if (users.existsByPhoneHashAndPhoneVerifiedTrue(hash)) throw ApiException.conflict("PHONE_IN_USE");
        String code = String.format("%06d", Texts.randomInt(1_000_000));
        pending.put(me, new PendingCode(hash, r.phone().substring(r.phone().length() - 2), Texts.sha256(me + "|" + code),
                Instant.now().plusSeconds(600), 0));
        Map<String, Object> out = new HashMap<>();
        if (props.devMode()) {
            out.put("mode", "DEV");
            out.put("devCode", code); // DOAR în DEV_MODE: în producție codul pleacă prin SMS
            return out;
        }
        pending.remove(me);
        throw new ApiException(HttpStatus.SERVICE_UNAVAILABLE, "SMS_NOT_CONFIGURED");
    }

    @PostMapping("/phone/confirm")
    @Transactional
    Map<String, Object> confirmPhone(@Valid @RequestBody PhoneConfirm r) {
        UUID me = CurrentUser.id();
        PendingCode p = pending.get(me);
        if (p == null || p.expiresAt().isBefore(Instant.now())) throw ApiException.badRequest("CODE_EXPIRED");
        if (p.attempts() >= 5) { pending.remove(me); throw ApiException.badRequest("TOO_MANY_ATTEMPTS"); }
        if (!p.codeHash().equals(Texts.sha256(me + "|" + r.code()))) {
            pending.put(me, new PendingCode(p.phoneHash(), p.last2(), p.codeHash(), p.expiresAt(), p.attempts() + 1));
            throw ApiException.badRequest("INVALID_CODE");
        }
        pending.remove(me);
        if (users.existsByPhoneHashAndPhoneVerifiedTrue(p.phoneHash())) throw ApiException.conflict("PHONE_IN_USE");
        User u = users.findById(me).orElseThrow(ApiException::notFound);
        u.setPhoneHash(p.phoneHash());
        u.setPhoneLast2(p.last2());
        u.setPhoneVerified(true);
        users.save(u);
        quota.markReferralQualified(me);
        audit.log(me, "PHONE_VERIFIED", null);
        return Map.of("verified", true);
    }

    private static String capitalize(String s) {
        StringBuilder b = new StringBuilder();
        for (String part : s.toLowerCase().split(" ")) {
            if (part.isEmpty()) continue;
            if (!b.isEmpty()) b.append(' ');
            b.append(Character.toUpperCase(part.charAt(0))).append(part.substring(1));
        }
        return b.toString();
    }
}
