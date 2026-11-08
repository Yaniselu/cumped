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
        return Map.of(
                "googleLogin", !props.googleClientIdList().isEmpty(),
                "appleLogin", !props.appleClientIdList().isEmpty(),
                "veloAi", props.aiEnabled() ? "AI" : "RULES",
                "devMode", props.devMode(),
                "freeActiveListings", 2,
                "referralBonusListings", 5,
                "referralsNeeded", 10);
    }
}
