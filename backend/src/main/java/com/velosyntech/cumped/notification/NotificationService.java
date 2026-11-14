package com.velosyntech.cumped.notification;

import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Service;
import tools.jackson.databind.json.JsonMapper;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Notificările se salvează ca tip + parametri; textul se traduce pe client, în limba utilizatorului.
 */
@Service
public class NotificationService {
    public record Notification(UUID id, String type, Map<String, Object> params, String link, boolean read, Instant createdAt) {}

    private final JdbcClient jdbc;
    private final JsonMapper json;
    private final com.velosyntech.cumped.notification.push.PushService push;

    public NotificationService(JdbcClient jdbc, JsonMapper json, com.velosyntech.cumped.notification.push.PushService push) {
        this.jdbc = jdbc;
        this.json = json;
        this.push = push;
    }

    /** Salvează notificarea (lista din aplicație) și trimite alerta pe dispozitivele utilizatorului (push). */
    public void notify(UUID userId, String type, Map<String, ?> params, String link) {
        jdbc.sql("INSERT INTO notifications(id, user_id, type, params, link) VALUES (?, ?, ?, ?, ?)")
                .params(UUID.randomUUID(), userId, type, json.writeValueAsString(params), link)
                .update();
        push.send(userId, type, params, link);
    }

    @SuppressWarnings("unchecked")
    public List<Notification> list(UUID userId, int limit) {
        return jdbc.sql("SELECT id, type, params, link, read_at, created_at FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT ?")
                .params(userId, limit)
                .query((rs, i) -> new Notification(
                        rs.getObject("id", UUID.class),
                        rs.getString("type"),
                        json.readValue(rs.getString("params"), Map.class),
                        rs.getString("link"),
                        rs.getTimestamp("read_at") != null,
                        rs.getTimestamp("created_at").toInstant()))
                .list();
    }

    public int unread(UUID userId) {
        return jdbc.sql("SELECT count(*) FROM notifications WHERE user_id = ? AND read_at IS NULL")
                .param(userId).query(Integer.class).single();
    }

    public void markAllRead(UUID userId) {
        jdbc.sql("UPDATE notifications SET read_at = now() WHERE user_id = ? AND read_at IS NULL").param(userId).update();
    }
}
