package com.velosyntech.cumped.ai;

import com.fasterxml.jackson.annotation.JsonPropertyDescription;

import java.util.List;

/** Anunțul propus de Velo din poze (ieșire structurată; serverul îl verifică înainte să-l arate). */
public record ListingDraft(
        @JsonPropertyDescription("Short, specific listing title: brand + model + the most important detail. Max 80 characters. In the requested language.")
        String title,
        @JsonPropertyDescription("Exactly one of the allowed category codes given in the prompt")
        String category,
        @JsonPropertyDescription("One of: NEW, LIKE_NEW, GOOD, FAIR, FOR_PARTS - judged only from what is visible; GOOD if unsure")
        String condition,
        @JsonPropertyDescription("Honest description for buyers, 3-6 short sentences, in the requested language. Mention visible wear. Never invent accessories, invoices or warranty.")
        String description,
        @JsonPropertyDescription("Specifications you can identify with reasonable confidence, using only the allowed keys for the chosen category")
        List<Attribute> attributes,
        @JsonPropertyDescription("Typical second-hand price range for this item in the requested currency, whole units; 0 if you cannot tell")
        long priceLow,
        @JsonPropertyDescription("Upper end of the typical second-hand price range, whole units; 0 if you cannot tell")
        long priceHigh,
        @JsonPropertyDescription("One of: LOW, MEDIUM, HIGH - how sure you are about the identification")
        String confidence,
        @JsonPropertyDescription("Short notes for the seller in the requested language, e.g. what to photograph next or details to check. Empty list if none.")
        List<String> tips) {

    public record Attribute(
            @JsonPropertyDescription("One of the allowed attribute keys") String key,
            @JsonPropertyDescription("Value; for yes/no fields use yes or no; numbers without units") String value) {}
}
