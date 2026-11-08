package com.velosyntech.cumped.common;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.text.Normalizer;
import java.util.HexFormat;
import java.util.regex.Pattern;

public final class Texts {
    private static final SecureRandom RANDOM = new SecureRandom();
    private static final Pattern CONTROL = Pattern.compile("[\\p{Cntrl}&&[^\\n\\t]]");
    private static final char[] CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789".toCharArray();

    private Texts() {}

    /** Curăță textul primit de la utilizator: normalizare Unicode, fără caractere de control, fără spații inutile. */
    public static String clean(String s) {
        if (s == null) return null;
        String n = Normalizer.normalize(s, Normalizer.Form.NFC);
        n = CONTROL.matcher(n).replaceAll("");
        n = n.replace("‮", "").replace("‭", "").replace("​", "");
        return n.strip();
    }

    public static String sha256(String s) {
        try {
            MessageDigest md = MessageDigest.getInstance("SHA-256");
            return HexFormat.of().formatHex(md.digest(s.getBytes(StandardCharsets.UTF_8)));
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException(e);
        }
    }

    public static String randomToken(int bytes) {
        byte[] b = new byte[bytes];
        RANDOM.nextBytes(b);
        return java.util.Base64.getUrlEncoder().withoutPadding().encodeToString(b);
    }

    public static String randomCode(int len) {
        StringBuilder sb = new StringBuilder(len);
        for (int i = 0; i < len; i++) sb.append(CODE_ALPHABET[RANDOM.nextInt(CODE_ALPHABET.length)]);
        return sb.toString();
    }

    public static int randomInt(int bound) { return RANDOM.nextInt(bound); }
}
