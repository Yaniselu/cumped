package com.velosyntech.cumped.notification;

import com.velosyntech.cumped.common.CurrentUser;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/me")
public class NotificationController {
    private final NotificationService notifications;
    private final JdbcClient jdbc;

    public NotificationController(NotificationService notifications, JdbcClient jdbc) {
        this.notifications = notifications;
        this.jdbc = jdbc;
    }

    @GetMapping("/notifications")
    List<NotificationService.Notification> list() { return notifications.list(CurrentUser.id(), 100); }

    @PostMapping("/notifications/read-all")
    void readAll() { notifications.markAllRead(CurrentUser.id()); }

    /** Contoare pentru insigne (badge) în meniu: notificări și mesaje necitite. */
    @GetMapping("/badges")
    Map<String, Integer> badges() {
        UUID me = CurrentUser.id();
        int messages = jdbc.sql("""
                SELECT count(*) FROM messages m JOIN conversations c ON c.id = m.conversation_id
                WHERE (c.buyer_id = :me OR c.seller_id = :me) AND m.sender_id <> :me AND m.read_at IS NULL""")
                .param("me", me).query(Integer.class).single();
        int offers = jdbc.sql("""
                SELECT count(*) FROM offers o JOIN listings l ON l.id = o.listing_id
                WHERE l.seller_id = ? AND o.status = 'PENDING'""").param(me).query(Integer.class).single();
        return Map.of("notifications", notifications.unread(me), "messages", messages, "offers", offers);
    }
}
