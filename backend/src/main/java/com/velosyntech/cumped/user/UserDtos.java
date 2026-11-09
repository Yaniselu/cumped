package com.velosyntech.cumped.user;

import java.time.Instant;
import java.util.UUID;

public final class UserDtos {
    private UserDtos() {}

    /** Profilul propriu: singurul loc unde apare email-ul. */
    public record Me(UUID id, String email, String username, String displayName, User.DisplayMode displayMode,
                     String legalName, boolean idVerified, boolean phoneVerified, String phoneLast2,
                     String role, String plan, Instant planUntil, String referralCode, String country, String city,
                     String locale, int avatarHue, String bio, Instant createdAt, double rating, int ratingCount,
                     QuotaService.Quota quota, boolean hasPassword, String accountType, Business business,
                     String termsVersion) {}

    /** Datele firmei: obligatorii pentru vânzătorii profesioniști (DSA art. 30) și afișate cumpărătorilor. */
    public record Business(String name, String regNo, String vat, String address, String email, String phone) {}

    /** Profil public: fără email, fără telefon, fără numele complet. */
    public record PublicUser(UUID id, String username, String displayName, boolean idVerified, boolean phoneVerified,
                             String country, String city, int avatarHue, String bio, Instant memberSince,
                             double rating, int ratingCount, int trustScore, boolean realNameAvailable,
                             String accountType, Business business) {}

    public record RealName(String fullName) {}

    public static Business business(User u) {
        if (!u.isBusiness()) return null;
        return new Business(u.getBusinessName(), u.getBusinessRegNo(), u.getBusinessVat(), u.getBusinessAddress(),
                u.getBusinessEmail(), u.getBusinessPhone());
    }

    public static String displayName(User u) {
        if (u.isBusiness()) return u.getBusinessName();
        if (u.getDisplayMode() == User.DisplayMode.REAL_NAME && u.isIdVerified() && u.getLegalFirstName() != null) {
            String last = u.getLegalLastName();
            return u.getLegalFirstName() + (last != null && !last.isEmpty() ? " " + last.charAt(0) + "." : "");
        }
        return u.getUsername();
    }

    /** Scor de încredere 0-100: verificare, recenzii și vechime. */
    public static int trustScore(User u) {
        int s = 10;
        if (u.isIdVerified()) s += 40;
        if (u.isPhoneVerified()) s += 15;
        if (u.getRatingCount() > 0) s += (int) Math.min(25, u.ratingAverage() * 4 + Math.min(5, u.getRatingCount()));
        long days = java.time.Duration.between(u.getCreatedAt(), Instant.now()).toDays();
        s += (int) Math.min(10, days / 30);
        if (u.isSuspended()) s = 0;
        return Math.min(100, s);
    }

    public static PublicUser toPublic(User u) {
        return new PublicUser(u.getId(), u.getUsername(), displayName(u), u.isIdVerified(), u.isPhoneVerified(),
                u.getCountry(), u.getCity(), u.getAvatarHue(), u.getBio(), u.getCreatedAt(), u.ratingAverage(),
                u.getRatingCount(), trustScore(u), u.isIdVerified(), u.getAccountType().name(), business(u));
    }

    public static Me toMe(User u, QuotaService.Quota quota) {
        return new Me(u.getId(), u.getEmail(), u.getUsername(), displayName(u), u.getDisplayMode(), u.legalFullName(),
                u.isIdVerified(), u.isPhoneVerified(), u.getPhoneLast2(), u.getRole().name(), u.effectivePlan().name(),
                u.getPlanUntil(), u.getReferralCode(), u.getCountry(), u.getCity(), u.getLocale(), u.getAvatarHue(),
                u.getBio(), u.getCreatedAt(), u.ratingAverage(), u.getRatingCount(), quota, u.getPasswordHash() != null,
                u.getAccountType().name(), business(u), u.getTermsVersion());
    }
}
