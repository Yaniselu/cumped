package com.velosyntech.cumped.config;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

/** Ce funcții sunt active pe server, ca aplicația să știe ce butoane să arate. Fără secrete. */
@RestController
public class ConfigController {
    private final AppProperties props;

    public ConfigController(AppProperties props) { this.props = props; }

    @GetMapping("/api/config")
    Map<String, Object> config() {
        Map<String, Object> company = new java.util.LinkedHashMap<>();
        company.put("name", props.companyName());
        company.put("address", props.companyAddress());
        company.put("regNo", props.companyRegNo());
        company.put("vat", props.companyVat());
        company.put("email", props.companyEmail());
        company.put("dpoEmail", props.dpoEmail());
        Map<String, Object> out = new java.util.LinkedHashMap<>();
        out.put("company", company);
        out.put("termsVersion", com.velosyntech.cumped.auth.AuthService.TERMS_VERSION);
        // Plățile digitale în aplicațiile iOS/Android trebuie făcute prin App Store / Google Play (IAP).
        out.put("inAppPurchases", false);
        out.put("googleLogin", !props.googleClientIdList().isEmpty());
        out.put("appleLogin", !props.appleClientIdList().isEmpty());
        out.put("veloAi", props.aiEnabled() ? "AI" : "RULES");
        out.put("devMode", props.devMode());
        out.put("freeActiveListings", 2);
        out.put("referralBonusListings", 5);
        out.put("referralsNeeded", 10);
        // cheia PUBLICĂ Turnstile (cea secretă rămâne doar pe server)
        out.put("captchaSiteKey", props.captchaEnabled() ? props.turnstileSiteKey() : null);
        return out;
    }
}
