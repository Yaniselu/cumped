package com.velosyntech.cumped.user;

import com.velosyntech.cumped.common.ApiException;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Service;

import java.util.UUID;

/** Blocarea utilizatorilor: fără mesaje, oferte sau anunțuri vizibile între cei doi. */
@Service
public class BlockService {
    private final JdbcClient jdbc;

    public BlockService(JdbcClient jdbc) { this.jdbc = jdbc; }

    public boolean eitherBlocked(UUID a, UUID b) {
        if (a == null || b == null) return false;
        return jdbc.sql("SELECT count(*) FROM user_blocks WHERE (blocker_id = ? AND blocked_id = ?) OR (blocker_id = ? AND blocked_id = ?)")
                .params(a, b, b, a).query(Integer.class).single() > 0;
    }

    public void requireNotBlocked(UUID a, UUID b) {
        if (eitherBlocked(a, b)) throw new ApiException(HttpStatus.FORBIDDEN, "USER_BLOCKED");
    }

    public void block(UUID blocker, UUID blocked) {
        if (blocker.equals(blocked)) throw ApiException.badRequest("CANNOT_BLOCK_SELF");
        jdbc.sql("INSERT INTO user_blocks(blocker_id, blocked_id) VALUES (?, ?) ON CONFLICT DO NOTHING").params(blocker, blocked).update();
    }

    public void unblock(UUID blocker, UUID blocked) {
        jdbc.sql("DELETE FROM user_blocks WHERE blocker_id = ? AND blocked_id = ?").params(blocker, blocked).update();
    }
}
