package com.velosyntech.cumped.listing;

import com.velosyntech.cumped.common.ApiException;
import com.velosyntech.cumped.common.CurrentUser;
import com.velosyntech.cumped.common.Texts;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.PositiveOrZero;
import jakarta.validation.constraints.Size;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.web.bind.annotation.*;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/me/saved-searches")
public class SavedSearchController {
    public record SavedSearch(UUID id, String query, String category, Long maxPriceCents, String country, Instant createdAt) {}
    public record Create(@Size(max = 80) String query, Category category, @PositiveOrZero Long maxPriceCents,
                         @Pattern(regexp = "^[A-Z]{2}$") String country) {}

    private final JdbcClient jdbc;

    public SavedSearchController(JdbcClient jdbc) { this.jdbc = jdbc; }

    @GetMapping
    List<SavedSearch> list() {
        return jdbc.sql("SELECT id, query, category, max_price_cents, country, created_at FROM saved_searches WHERE user_id = ? ORDER BY created_at DESC")
                .param(CurrentUser.id())
                .query((rs, i) -> new SavedSearch(rs.getObject(1, UUID.class), rs.getString(2), rs.getString(3),
                        (Long) rs.getObject(4), rs.getString(5), rs.getTimestamp(6).toInstant()))
                .list();
    }

    @PostMapping
    Map<String, Object> create(@Valid @RequestBody Create r) {
        UUID me = CurrentUser.id();
        int count = jdbc.sql("SELECT count(*) FROM saved_searches WHERE user_id = ?").param(me).query(Integer.class).single();
        if (count >= 20) throw ApiException.badRequest("TOO_MANY_SAVED_SEARCHES");
        UUID id = UUID.randomUUID();
        jdbc.sql("INSERT INTO saved_searches(id, user_id, query, category, max_price_cents, country) VALUES (?, ?, ?, ?, ?, ?)")
                .params(id, me, Texts.clean(r.query()), r.category() == null ? null : r.category().name(), r.maxPriceCents(), r.country())
                .update();
        return Map.of("id", id);
    }

    @DeleteMapping("/{id}")
    void delete(@PathVariable UUID id) {
        jdbc.sql("DELETE FROM saved_searches WHERE id = ? AND user_id = ?").params(id, CurrentUser.id()).update();
    }
}
