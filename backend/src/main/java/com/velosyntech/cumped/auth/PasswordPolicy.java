package com.velosyntech.cumped.auth;

import com.velosyntech.cumped.common.ApiException;

import java.util.Locale;
import java.util.Set;

final class PasswordPolicy {
    /** bcrypt folosește doar primii 72 de octeți: o parolă mai lungă ar fi trunchiată în tăcere (sau respinsă cu eroare). */
    static final int MAX_BYTES = 72;

    private static final Set<String> COMMON = Set.of(
            "1234567890", "12345678910", "0123456789", "password123", "parola1234", "parolamea123", "qwertyuiop",
            "1q2w3e4r5t", "iloveyou12", "password12", "abcdefghij", "1111111111", "0000000000", "qwerty1234",
            "asdfghjkl1", "aaaaaaaaaa", "passw0rd12", "letmein123", "welcome123", "admin12345");

    private PasswordPolicy() {}

    static boolean tooLong(String password) {
        return password.getBytes(java.nio.charset.StandardCharsets.UTF_8).length > MAX_BYTES;
    }

    static void check(String password, String email, String username) {
        String p = password.toLowerCase(Locale.ROOT);
        if (password.length() < 10) throw ApiException.badRequest("WEAK_PASSWORD");
        if (tooLong(password)) throw ApiException.badRequest("PASSWORD_TOO_LONG");
        if (COMMON.contains(p)) throw ApiException.badRequest("WEAK_PASSWORD");
        if (p.chars().distinct().count() < 5) throw ApiException.badRequest("WEAK_PASSWORD");
        String local = email == null ? "" : email.split("@")[0].toLowerCase(Locale.ROOT);
        if (local.length() >= 4 && p.contains(local)) throw ApiException.badRequest("WEAK_PASSWORD");
        if (username != null && username.length() >= 4 && p.contains(username.toLowerCase(Locale.ROOT)))
            throw ApiException.badRequest("WEAK_PASSWORD");
        boolean letter = password.chars().anyMatch(Character::isLetter);
        boolean other = password.chars().anyMatch(c -> !Character.isLetter(c));
        if (!letter || !other) throw ApiException.badRequest("WEAK_PASSWORD");
    }
}
