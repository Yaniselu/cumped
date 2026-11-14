package com.velosyntech.cumped.notification.push;

import com.velosyntech.cumped.common.ApiException;
import com.velosyntech.cumped.common.CurrentUser;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

/** Abonarea dispozitivelor la alerte și alegerea categoriilor. */
@RestController
@RequestMapping("/api/me")
public class PushController {
    public record WebKeys(@NotBlank @Size(max = 120) String p256dh, @NotBlank @Size(max = 60) String auth) {}
    public record Subscribe(@NotBlank @Pattern(regexp = "WEB|FCM") String kind, @Size(max = 1000) String endpoint, WebKeys keys,
                            @Size(max = 4096) String token, @Pattern(regexp = "web|android|ios") String platform, @Size(max = 80) String device) {}
    public record Unsubscribe(@NotBlank @Size(max = 4096) String endpoint) {}
    public record Prefs(@NotNull Boolean messages, @NotNull Boolean offers, @NotNull Boolean orders, @NotNull Boolean alerts, @NotNull Boolean account) {}

    private final PushService push;

    public PushController(PushService push) { this.push = push; }

    @PostMapping("/push/subscriptions")
    Map<String, Object> subscribe(@Valid @RequestBody Subscribe r) {
        if ("WEB".equals(r.kind())) {
            if (r.endpoint() == null || r.keys() == null) throw ApiException.badRequest("VALIDATION");
            push.subscribeWeb(CurrentUser.id(), r.endpoint(), r.keys().p256dh(), r.keys().auth(), r.device());
        } else {
            push.subscribeNative(CurrentUser.id(), r.token(), r.platform(), r.device());
        }
        return Map.of("ok", true, "devices", push.devices(CurrentUser.id()));
    }

    @PostMapping("/push/unsubscribe")
    Map<String, Object> unsubscribe(@Valid @RequestBody Unsubscribe r) {
        push.unsubscribe(CurrentUser.id(), r.endpoint());
        return Map.of("ok", true);
    }

    @PostMapping("/push/test")
    Map<String, Object> test() {
        return Map.of("delivered", push.deliver(CurrentUser.id(), "PUSH_TEST", Map.of(), "/settings"));
    }

    @GetMapping("/notification-prefs")
    PushService.Prefs prefs() { return push.prefs(CurrentUser.id()); }

    @PutMapping("/notification-prefs")
    PushService.Prefs save(@Valid @RequestBody Prefs p) {
        return push.savePrefs(CurrentUser.id(), new PushService.Prefs(p.messages(), p.offers(), p.orders(), p.alerts(), p.account()));
    }
}
