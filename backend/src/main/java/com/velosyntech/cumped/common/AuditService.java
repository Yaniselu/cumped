package com.velosyntech.cumped.common;

import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Service;

import java.util.UUID;

/** Jurnal de audit pentru acțiuni sensibile (fără date personale în clar). */
@Service
public class AuditService {
    private final JdbcClient jdbc;

    public AuditService(JdbcClient jdbc) { this.jdbc = jdbc; }

    public void log(UUID actor, String action, String target) {
        jdbc.sql("INSERT INTO audit_log(id, actor_id, action, target) VALUES (?, ?, ?, ?)")
                .params(UUID.randomUUID(), actor, action, target)
                .update();
    }
}
