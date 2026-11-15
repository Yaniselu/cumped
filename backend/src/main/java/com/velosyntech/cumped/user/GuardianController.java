package com.velosyntech.cumped.user;

import com.velosyntech.cumped.common.CurrentUser;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.Size;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Acordul părintelui pentru conturile 16–17 ani și panoul lui de control.
 * Linkul din email e secret (token de 32 de octeți, păstrat doar ca hash); acceptarea cere cont adult cu identitate verificată.
 */
@RestController
@RequestMapping("/api/guardian")
public class GuardianController {
    public record Accept(Boolean declaration) {}
    public record Resend(@Email @Size(max = 254) String parentEmail) {}

    private final Guardianship guardianship;

    public GuardianController(Guardianship guardianship) { this.guardianship = guardianship; }

    /** Public (doar cu tokenul din email): ce cont cere acordul și ce limite are. */
    @GetMapping("/invites/{token}")
    Guardianship.InviteView invite(@PathVariable String token) { return guardianship.inviteView(token); }

    @PostMapping("/invites/{token}/accept")
    Map<String, Object> accept(@PathVariable String token, @RequestBody Accept r) {
        guardianship.accept(token, CurrentUser.id(), Boolean.TRUE.equals(r.declaration()));
        return Map.of("ok", true);
    }

    /** Refuzul nu cere cont: părintele poate refuza direct din email. */
    @PostMapping("/invites/{token}/decline")
    Map<String, Object> decline(@PathVariable String token) {
        guardianship.decline(token);
        return Map.of("ok", true);
    }

    /** Contul minorului retrimite invitația (opțional către alt email). */
    @PostMapping("/resend")
    Map<String, Object> resend(@Valid @RequestBody Resend r) {
        guardianship.resend(CurrentUser.id(), r.parentEmail());
        return Map.of("ok", true);
    }

    @GetMapping("/children")
    List<Guardianship.Child> children() { return guardianship.children(CurrentUser.id()); }

    @PostMapping("/children/{id}/{action}")
    Map<String, Object> control(@PathVariable UUID id, @PathVariable String action) {
        guardianship.control(CurrentUser.id(), id, action.toUpperCase(java.util.Locale.ROOT));
        return Map.of("ok", true);
    }
}
