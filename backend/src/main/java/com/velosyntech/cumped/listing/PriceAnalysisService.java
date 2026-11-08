package com.velosyntech.cumped.listing;

import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Service;

import java.util.*;

/**
 * Compară prețul cu anunțuri similare (aceeași categorie, aceeași monedă, titlu asemănător)
 * și spune dacă e sub medie, corect sau peste medie. Fără destule comparații, nu ghicim.
 */
@Service
public class PriceAnalysisService {
    private static final Set<String> STOP = Set.of("de", "la", "si", "și", "cu", "in", "în", "pentru", "the", "and",
            "with", "for", "nou", "noua", "nouă", "new", "vand", "vând", "vanzare", "vânzare", "stare", "buna", "bună");
    private static final int MIN_COMPARABLES = 3;

    private final JdbcClient jdbc;

    public PriceAnalysisService(JdbcClient jdbc) { this.jdbc = jdbc; }

    public ListingDtos.PriceAnalysis analyze(Listing l) {
        return analyze(l.getId(), l.getTitle(), l.getCategory(), l.getCurrency(), l.getPriceCents());
    }

    public ListingDtos.PriceAnalysis analyze(UUID excludeId, String title, Category category, String currency, long price) {
        List<String> tokens = new ArrayList<>();
        for (String t : title.toLowerCase(Locale.ROOT).split("[^\\p{L}\\p{N}]+")) {
            if (t.length() >= 2 && !STOP.contains(t) && tokens.size() < 2) tokens.add(t + ":*");
        }
        if (tokens.isEmpty()) return new ListingDtos.PriceAnalysis("UNKNOWN", null, 0, currency);
        var row = jdbc.sql("""
                SELECT percentile_cont(0.5) WITHIN GROUP (ORDER BY price_cents) AS median, count(*) AS n
                FROM listings
                WHERE category = :category AND currency = :currency AND status IN ('ACTIVE','SOLD')
                  AND id <> CAST(:id AS uuid) AND price_cents > 0
                  AND search_vector @@ to_tsquery('simple', :tsq)
                """)
                .param("category", category.name()).param("currency", currency)
                .param("id", excludeId).param("tsq", String.join(" & ", tokens))
                .query((rs, i) -> new double[]{rs.getDouble("median"), rs.getLong("n")})
                .single();
        int n = (int) row[1];
        if (n < MIN_COMPARABLES || row[0] <= 0) return new ListingDtos.PriceAnalysis("UNKNOWN", null, n, currency);
        long median = Math.round(row[0]);
        String verdict = price < median * 0.85 ? "BELOW" : price > median * 1.15 ? "ABOVE" : "FAIR";
        return new ListingDtos.PriceAnalysis(verdict, median, n, currency);
    }
}
