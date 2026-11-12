package com.velosyntech.cumped.auth;

import com.velosyntech.cumped.user.UserDtos;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

public final class AuthDtos {
    private AuthDtos() {}

    public record RegisterRequest(
            @NotBlank @Email @Size(max = 254) String email,
            @NotBlank @Size(min = 10, max = 128) String password,
            @NotBlank @Pattern(regexp = "^[A-Za-z0-9_.]{3,20}$") String username,
            @Size(max = 12) String referralCode,
            @Pattern(regexp = "^[A-Za-z]{2}$") String country,
            @Size(max = 80) String city,
            @Pattern(regexp = "^[a-z]{2}$") String locale,
            Boolean acceptTerms,
            Boolean adultConfirmed,
            /** Câmp-capcană invizibil pentru oameni: dacă e completat, e un robot. */
            @Size(max = 200) String website,
            /** Cât a durat completarea formularului (ms). Roboții completează instant. */
            Long elapsedMs,
            /** Token Cloudflare Turnstile, când protecția e activată. */
            @Size(max = 4096) String captchaToken) {}

    public record LoginRequest(@NotBlank @Size(max = 254) String email, @NotBlank @Size(max = 128) String password) {}

    public record SocialRequest(@NotBlank @Size(max = 5000) String idToken,
                                @Size(max = 12) String referralCode,
                                @Pattern(regexp = "^[a-z]{2}$") String locale,
                                @Pattern(regexp = "^[A-Za-z]{2}$") String country,
                                Boolean acceptTerms,
                                Boolean adultConfirmed) {}

    public record AuthResponse(String accessToken, long expiresIn, UserDtos.Me user) {}

    public record ChangePasswordRequest(@Size(max = 128) String currentPassword,
                                        @NotBlank @Size(min = 10, max = 128) String newPassword) {}
}
