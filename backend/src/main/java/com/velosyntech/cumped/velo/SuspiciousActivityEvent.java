package com.velosyntech.cumped.velo;

import java.util.List;
import java.util.UUID;

/** Emis când sistemul detectează automat un comportament suspect (ex.: tentative repetate de phishing în chat). */
public record SuspiciousActivityEvent(UUID suspectId, UUID listingId, UUID victimId, List<String> reasons, String evidence) {}
