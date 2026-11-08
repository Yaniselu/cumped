package com.velosyntech.cumped.user;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.UUID;

public interface ReferralRepository extends JpaRepository<Referral, UUID> {
    long countByInviterIdAndQualifiedTrue(UUID inviterId);
    long countByInviterId(UUID inviterId);
}
