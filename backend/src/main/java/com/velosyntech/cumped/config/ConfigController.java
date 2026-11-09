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
        return Map.of(
                "company", company,
                "termsVersion", com.velosyntech.cumped.auth.AuthService.TERMS_VERSION,
                // Plățile digitale în aplicațiile iOS/Android trebuie făcute prin App Store / Google Play (IAP).
                "inAppPurchases", false,
                "googleLogin", !props.googleClientIdList().isEmpty(),
                "appleLogin", !props.appleClientIdList().isEmpty(),
                "veloAi", props.aiEnabled() ? "AI" : "RULES",
                "devMode", props.devMode(),
                "freeActiveListings", 2,
                "referralBonusListings", 5,
                "referralsNeeded", 10);
    }
}
