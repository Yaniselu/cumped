package com.velosyntech.cumped.auth;

import com.velosyntech.cumped.common.Texts;
import com.velosyntech.cumped.notification.NotificationService;
import com.velosyntech.cumped.user.User;
import com.velosyntech.cumped.velo.MailOutbox;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Component;

import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.time.format.DateTimeFormatter;
import java.util.Locale;
import java.util.Map;

/**
 * Alerte de securitate: când cineva intră în cont de pe un dispozitiv nou sau parola e schimbată,
 * utilizatorul primește notificare (în aplicație, push pe toate dispozitivele) și email.
 */
@Component
public class LoginAlerts {
    private final JdbcClient jdbc;
    private final NotificationService notifications;
    private final MailOutbox mail;

    public LoginAlerts(JdbcClient jdbc, NotificationService notifications, MailOutbox mail) {
        this.jdbc = jdbc;
        this.notifications = notifications;
        this.mail = mail;
    }

    /** Înregistrează dispozitivul; dacă e nou (și contul avea deja alte dispozitive), trimite alertă. */
    public void onLogin(User u, String userAgent) {
        String label = label(userAgent);
        String hash = Texts.sha256(u.getId() + "|" + label);
        int known = jdbc.sql("SELECT count(*) FROM login_devices WHERE user_id = ?").param(u.getId()).query(Integer.class).single();
        int updated = jdbc.sql("UPDATE login_devices SET last_seen = now() WHERE user_id = ? AND device_hash = ?").params(u.getId(), hash).update();
        if (updated > 0) return;
        jdbc.sql("INSERT INTO login_devices(user_id, device_hash, label) VALUES (?, ?, ?) ON CONFLICT DO NOTHING").params(u.getId(), hash, label).update();
        if (known == 0) return; // primul dispozitiv (contul tocmai a fost creat)
        String when = ZonedDateTime.now(ZoneId.of("Europe/Bucharest")).format(DateTimeFormatter.ofPattern("d MMM yyyy, HH:mm", Locale.forLanguageTag(u.getLocale())));
        notifications.notify(u.getId(), "SECURITY_NEW_LOGIN", Map.of("device", label, "when", when), "/settings");
        mail.enqueue(u.getEmail(), "Cumped: " + subject(u.getLocale(), true),
                body(u.getLocale(), true).replace("{device}", label).replace("{when}", when));
    }

    public void onPasswordChanged(User u) {
        notifications.notify(u.getId(), "SECURITY_PASSWORD_CHANGED", Map.of(), "/settings");
        mail.enqueue(u.getEmail(), "Cumped: " + subject(u.getLocale(), false), body(u.getLocale(), false));
    }

    /** „Chrome pe Android”, „Aplicația Cumped pe iPhone” etc. Fără versiuni, ca actualizările de browser să nu dea alerte false. */
    static String label(String ua) {
        if (ua == null) return "?";
        String os = ua.contains("iPhone") ? "iPhone" : ua.contains("iPad") ? "iPad" : ua.contains("Android") ? "Android"
                : ua.contains("Windows") ? "Windows" : ua.contains("Mac OS X") || ua.contains("Macintosh") ? "Mac" : ua.contains("Linux") ? "Linux" : "?";
        String app = ua.contains("CumpedApp") ? "Cumped" : ua.contains("Edg/") ? "Edge" : ua.contains("OPR/") ? "Opera"
                : ua.contains("SamsungBrowser") ? "Samsung Internet" : ua.contains("Firefox/") || ua.contains("FxiOS") ? "Firefox"
                : ua.contains("CriOS") || ua.contains("Chrome/") ? "Chrome" : ua.contains("Safari/") ? "Safari" : "Browser";
        return app + " · " + os;
    }

    private static String subject(String lang, boolean login) {
        return "ro".equals(lang) ? (login ? "autentificare nouă în cont" : "parola a fost schimbată")
                : (login ? "new sign-in to your account" : "your password was changed");
    }

    private static String body(String lang, boolean login) {
        if ("ro".equals(lang)) return login
                ? "Cineva a intrat în contul tău Cumped de pe {device}, pe {when}.\n\nDacă ai fost tu, nu trebuie să faci nimic.\nDacă nu ai fost tu, schimbă parola imediat din Setări și apasă „Ieși de pe toate dispozitivele”."
                : "Parola contului tău Cumped a fost schimbată și toate sesiunile vechi au fost închise.\n\nDacă nu ai fost tu, scrie-ne imediat la contact@velosyntech.com.";
        return login
                ? "Someone signed in to your Cumped account from {device} on {when}.\n\nIf it was you, there's nothing to do.\nIf it wasn't, change your password right away in Settings and tap \"Sign out of all devices\"."
                : "Your Cumped password was changed and all old sessions were closed.\n\nIf it wasn't you, contact us right away at contact@velosyntech.com.";
    }
}
