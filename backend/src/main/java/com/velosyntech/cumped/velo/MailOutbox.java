package com.velosyntech.cumped.velo;

import com.velosyntech.cumped.config.AppProperties;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.UUID;

/**
 * Email-urile pleacă printr-un „outbox” în baza de date: nimic nu se pierde dacă serverul de mail e căzut,
 * iar trimiterea se reîncearcă automat. Fără SMTP configurat, mesajele rămân în coadă și pot fi văzute în admin.
 */
@Service
public class MailOutbox {
    private static final Logger log = LoggerFactory.getLogger(MailOutbox.class);

    private final JdbcClient jdbc;
    private final ObjectProvider<JavaMailSender> mailSender;
    private final AppProperties props;
    private final String smtpHost;
    private boolean warned;

    public MailOutbox(JdbcClient jdbc, ObjectProvider<JavaMailSender> mailSender, AppProperties props,
                      @org.springframework.beans.factory.annotation.Value("${spring.mail.host:}") String smtpHost) {
        this.jdbc = jdbc;
        this.mailSender = mailSender;
        this.props = props;
        this.smtpHost = smtpHost;
    }

    public void enqueue(String to, String subject, String body) {
        String safeSubject = subject.replaceAll("[\\r\\n]", " ");
        jdbc.sql("INSERT INTO mail_outbox(id, to_addr, subject, body) VALUES (?, ?, ?, ?)")
                .params(UUID.randomUUID(), to, safeSubject.length() > 200 ? safeSubject.substring(0, 200) : safeSubject, body)
                .update();
    }

    @Scheduled(fixedDelay = 30_000)
    public void flush() {
        JavaMailSender sender = mailSender.getIfAvailable();
        if (sender == null || smtpHost == null || smtpHost.isBlank()) {
            if (!warned) {
                log.warn("SMTP nu e configurat: email-urile (ex. tichetele către {}) rămân în coadă.", props.supportEmail());
                warned = true;
            }
            return;
        }
        record Mail(UUID id, String to, String subject, String body) {}
        List<Mail> pending = jdbc.sql("SELECT id, to_addr, subject, body FROM mail_outbox WHERE sent_at IS NULL AND attempts < 10 ORDER BY created_at LIMIT 20")
                .query((rs, i) -> new Mail(rs.getObject(1, UUID.class), rs.getString(2), rs.getString(3), rs.getString(4))).list();
        for (Mail m : pending) {
            try {
                SimpleMailMessage msg = new SimpleMailMessage();
                msg.setFrom(props.mailFrom());
                msg.setTo(m.to());
                msg.setSubject(m.subject());
                msg.setText(m.body());
                sender.send(msg);
                jdbc.sql("UPDATE mail_outbox SET sent_at = now(), attempts = attempts + 1 WHERE id = ?").param(m.id()).update();
            } catch (Exception e) {
                jdbc.sql("UPDATE mail_outbox SET attempts = attempts + 1, last_error = ? WHERE id = ?")
                        .params(e.getClass().getSimpleName(), m.id()).update();
            }
        }
    }
}
