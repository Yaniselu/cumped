package com.velosyntech.cumped.user;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;
import java.util.UUID;

public interface UserRepository extends JpaRepository<User, UUID> {
    Optional<User> findByEmail(String email);
    Optional<User> findByUsernameIgnoreCase(String username);
    Optional<User> findByReferralCode(String code);
    Optional<User> findByGoogleSub(String sub);
    Optional<User> findByAppleSub(String sub);
    boolean existsByUsernameIgnoreCase(String username);
    boolean existsByEmail(String email);
    boolean existsByPhoneHashAndPhoneVerifiedTrue(String phoneHash);
}
