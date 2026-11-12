package com.velosyntech.cumped.config;

import jakarta.annotation.PostConstruct;
import org.springframework.stereotype.Component;

/**
 * Verificări la pornire: în producție (DEV_MODE=false) refuzăm să pornim cu setări nesigure,
 * ca o greșeală de configurare să nu ajungă niciodată la utilizatori.
 */
@Component
public class ProductionChecks {
    private final AppProperties props;

    public ProductionChecks(AppProperties props) { this.props = props; }

    @PostConstruct
    void verify() {
        if (props.devMode()) return;
        if (!props.cookieSecure()) fail("COOKIE_SECURE trebuie să fie true în producție (cookie doar prin HTTPS).");
        if (props.corsOriginList().stream().anyMatch(o -> o.equals("*") || o.startsWith("http://")))
            fail("CORS_ORIGINS acceptă doar origini https:// explicite în producție.");
        if (props.publicUrl() != null && !props.publicUrl().isBlank() && !props.publicUrl().startsWith("https://"))
            fail("PUBLIC_URL trebuie să înceapă cu https:// în producție.");
        if (props.demoData()) fail("DEMO_DATA nu poate fi activ în producție.");
    }

    private static void fail(String msg) { throw new IllegalStateException(msg); }
}
