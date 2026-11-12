package com.velosyntech.cumped.user;

import jakarta.persistence.*;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "users")
public class User {
    public enum Role { USER, ADMIN }
    public enum Plan { FREE, PLUS, PRO }
    public enum DisplayMode { USERNAME, REAL_NAME }
    public enum AccountType { PRIVATE, BUSINESS }

    @Id private UUID id = UUID.randomUUID();
    @Column(nullable = false, unique = true) private String email;
    private String passwordHash;
    @Column(nullable = false, unique = true) private String username;
    @Enumerated(EnumType.STRING) private DisplayMode displayMode = DisplayMode.USERNAME;
    /** Numele de pe act: criptate în baza de date (AES-256-GCM). */
    @jakarta.persistence.Convert(converter = com.velosyntech.cumped.common.EncryptedString.class)
    private String legalFirstName;
    @jakarta.persistence.Convert(converter = com.velosyntech.cumped.common.EncryptedString.class)
    private String legalLastName;
    private boolean idVerified;
    private Instant idVerifiedAt;
    private String phoneHash;
    private String phoneLast2;
    private boolean phoneVerified;
    @Enumerated(EnumType.STRING) private Role role = Role.USER;
    @Enumerated(EnumType.STRING) private Plan plan = Plan.FREE;
    private Instant planUntil;
    @Column(nullable = false, unique = true) private String referralCode;
    private UUID referredBy;
    private String country;
    private String city;
    private String locale = "en";
    private int avatarHue = 260;
    private String bio;
    private String googleSub;
    private String appleSub;
    private int failedLogins;
    private Instant lockedUntil;
    private boolean suspended;
    private String suspendedReason;
    private int ratingSum;
    private int ratingCount;
    private int tokenVersion;
    @Enumerated(EnumType.STRING) private AccountType accountType = AccountType.PRIVATE;
    private String businessName;
    private String businessRegNo;
    private String businessVat;
    private String businessAddress;
    private String businessEmail;
    private String businessPhone;
    private String termsVersion;
    private Instant termsAcceptedAt;
    private boolean adultConfirmed;
    private Instant createdAt = Instant.now();

    public UUID getId() { return id; }
    public String getEmail() { return email; }
    public void setEmail(String email) { this.email = email; }
    public String getPasswordHash() { return passwordHash; }
    public void setPasswordHash(String passwordHash) { this.passwordHash = passwordHash; }
    public String getUsername() { return username; }
    public void setUsername(String username) { this.username = username; }
    public DisplayMode getDisplayMode() { return displayMode; }
    public void setDisplayMode(DisplayMode displayMode) { this.displayMode = displayMode; }
    public String getLegalFirstName() { return legalFirstName; }
    public void setLegalFirstName(String v) { this.legalFirstName = v; }
    public String getLegalLastName() { return legalLastName; }
    public void setLegalLastName(String v) { this.legalLastName = v; }
    public boolean isIdVerified() { return idVerified; }
    public void setIdVerified(boolean idVerified) { this.idVerified = idVerified; }
    public Instant getIdVerifiedAt() { return idVerifiedAt; }
    public void setIdVerifiedAt(Instant idVerifiedAt) { this.idVerifiedAt = idVerifiedAt; }
    public String getPhoneHash() { return phoneHash; }
    public void setPhoneHash(String phoneHash) { this.phoneHash = phoneHash; }
    public String getPhoneLast2() { return phoneLast2; }
    public void setPhoneLast2(String phoneLast2) { this.phoneLast2 = phoneLast2; }
    public boolean isPhoneVerified() { return phoneVerified; }
    public void setPhoneVerified(boolean phoneVerified) { this.phoneVerified = phoneVerified; }
    public Role getRole() { return role; }
    public void setRole(Role role) { this.role = role; }
    public Plan getPlan() { return plan; }
    public void setPlan(Plan plan) { this.plan = plan; }
    public Instant getPlanUntil() { return planUntil; }
    public void setPlanUntil(Instant planUntil) { this.planUntil = planUntil; }
    public String getReferralCode() { return referralCode; }
    public void setReferralCode(String referralCode) { this.referralCode = referralCode; }
    public UUID getReferredBy() { return referredBy; }
    public void setReferredBy(UUID referredBy) { this.referredBy = referredBy; }
    public String getCountry() { return country; }
    public void setCountry(String country) { this.country = country; }
    public String getCity() { return city; }
    public void setCity(String city) { this.city = city; }
    public String getLocale() { return locale; }
    public void setLocale(String locale) { this.locale = locale; }
    public int getAvatarHue() { return avatarHue; }
    public void setAvatarHue(int avatarHue) { this.avatarHue = avatarHue; }
    public String getBio() { return bio; }
    public void setBio(String bio) { this.bio = bio; }
    public String getGoogleSub() { return googleSub; }
    public void setGoogleSub(String googleSub) { this.googleSub = googleSub; }
    public String getAppleSub() { return appleSub; }
    public void setAppleSub(String appleSub) { this.appleSub = appleSub; }
    public int getFailedLogins() { return failedLogins; }
    public void setFailedLogins(int failedLogins) { this.failedLogins = failedLogins; }
    public Instant getLockedUntil() { return lockedUntil; }
    public void setLockedUntil(Instant lockedUntil) { this.lockedUntil = lockedUntil; }
    public boolean isSuspended() { return suspended; }
    public void setSuspended(boolean suspended) { this.suspended = suspended; }
    public String getSuspendedReason() { return suspendedReason; }
    public void setSuspendedReason(String suspendedReason) { this.suspendedReason = suspendedReason; }
    public int getRatingSum() { return ratingSum; }
    public void setRatingSum(int ratingSum) { this.ratingSum = ratingSum; }
    public int getRatingCount() { return ratingCount; }
    public void setRatingCount(int ratingCount) { this.ratingCount = ratingCount; }
    public int getTokenVersion() { return tokenVersion; }
    public void bumpTokenVersion() { this.tokenVersion++; }
    public AccountType getAccountType() { return accountType; }
    public void setAccountType(AccountType accountType) { this.accountType = accountType; }
    public String getBusinessName() { return businessName; }
    public void setBusinessName(String v) { this.businessName = v; }
    public String getBusinessRegNo() { return businessRegNo; }
    public void setBusinessRegNo(String v) { this.businessRegNo = v; }
    public String getBusinessVat() { return businessVat; }
    public void setBusinessVat(String v) { this.businessVat = v; }
    public String getBusinessAddress() { return businessAddress; }
    public void setBusinessAddress(String v) { this.businessAddress = v; }
    public String getBusinessEmail() { return businessEmail; }
    public void setBusinessEmail(String v) { this.businessEmail = v; }
    public String getBusinessPhone() { return businessPhone; }
    public void setBusinessPhone(String v) { this.businessPhone = v; }
    public String getTermsVersion() { return termsVersion; }
    public Instant getTermsAcceptedAt() { return termsAcceptedAt; }
    public boolean isAdultConfirmed() { return adultConfirmed; }
    public void acceptTerms(String version) { this.termsVersion = version; this.termsAcceptedAt = Instant.now(); this.adultConfirmed = true; }
    public boolean isBusiness() { return accountType == AccountType.BUSINESS && businessName != null; }
    public Instant getCreatedAt() { return createdAt; }
    public void setCreatedAt(Instant createdAt) { this.createdAt = createdAt; }

    public Plan effectivePlan() {
        if (plan != Plan.FREE && planUntil != null && planUntil.isBefore(Instant.now())) return Plan.FREE;
        return plan;
    }

    public double ratingAverage() { return ratingCount == 0 ? 0 : Math.round(ratingSum * 10.0 / ratingCount) / 10.0; }

    public String legalFullName() {
        if (!idVerified || legalFirstName == null) return null;
        return legalFirstName + " " + legalLastName;
    }
}
