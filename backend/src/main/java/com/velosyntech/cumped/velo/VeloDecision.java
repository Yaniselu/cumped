package com.velosyntech.cumped.velo;

import com.fasterxml.jackson.annotation.JsonPropertyDescription;

import java.util.List;

/** Decizia structurată a lui Velo AI pentru un mesaj (validată pe server înainte de orice acțiune). */
public record VeloDecision(
        @JsonPropertyDescription("Reply shown to the user, in the user's language. Friendly, short, practical. No links.")
        String reply,
        @JsonPropertyDescription("One of: FAQ, REPORT, SMALLTALK")
        String intent,
        @JsonPropertyDescription("One of: FRAUD, DELIVERY, PAYMENT, ACCOUNT, LISTING, OTHER")
        String category,
        @JsonPropertyDescription("One of: LOW, MEDIUM, HIGH, URGENT")
        String priority,
        @JsonPropertyDescription("Estimated fraud/abuse risk 0-100 based only on facts in the conversation")
        int risk,
        @JsonPropertyDescription("True when there is enough detail to open a support ticket for the human team")
        boolean createTicket,
        @JsonPropertyDescription("Neutral 1-3 sentence summary of the problem for the support team, in Romanian")
        String summary,
        @JsonPropertyDescription("Up to 3 short quick-reply suggestions for the user, in the user's language")
        List<String> suggestions) {}
