package com.velosyntech.cumped.common;

import java.util.Map;

/**
 * Cursuri aproximative față de EUR, folosite DOAR pentru limitele comisionului (0,50 € – 20 €) și pentru
 * estimarea livrării în moneda anunțului. În producție se înlocuiesc cu cursul zilnic BCE/BNR de la procesatorul de plăți.
 */
public final class Fx {
    private static final Map<String, Double> PER_EUR = Map.ofEntries(
            Map.entry("EUR", 1.0), Map.entry("RON", 5.0), Map.entry("USD", 1.1), Map.entry("GBP", 0.85), Map.entry("PLN", 4.3),
            Map.entry("HUF", 400.0), Map.entry("BGN", 1.96), Map.entry("CZK", 25.0), Map.entry("CHF", 0.95), Map.entry("TRY", 38.0),
            Map.entry("UAH", 45.0), Map.entry("MDL", 19.5));

    private Fx() {}

    public static long fromEurCents(long eurCents, String currency) {
        return Math.round(eurCents * PER_EUR.getOrDefault(currency, 1.0));
    }
}
