package com.velosyntech.cumped.listing;

import com.velosyntech.cumped.media.ListingImage;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Component;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.*;

/**
 * Interogări de citire pentru liste de anunțuri. SQL-ul e construit doar din fragmente fixe;
 * tot ce vine de la utilizator intră exclusiv ca parametri (fără SQL injection).
 */
@Component
public class ListingQueries {
    private static final String CARD_SELECT = """
            SELECT l.id, l.title, l.price_cents, l.currency, l.city, l.country, l.category, l.item_condition,
                   l.accepts_swap, l.status, l.created_at, (l.promoted_until > now()) AS promoted,
                   u.id_verified, (u.account_type = 'BUSINESS') AS seller_business, l.negotiable,
                   img.id AS img_id, img.storage_key AS img_key,
                   (SELECT max(ph.price_cents) FROM price_history ph
                     WHERE ph.listing_id = l.id AND ph.changed_at > now() - interval '30 days') AS prev_max,
                   EXISTS (SELECT 1 FROM favorites f WHERE f.listing_id = l.id AND f.user_id = CAST(:viewer AS uuid)) AS fav
            FROM listings l
            JOIN users u ON u.id = l.seller_id
            LEFT JOIN LATERAL (SELECT li.id, li.storage_key FROM listing_images li
                               WHERE li.listing_id = l.id ORDER BY li.position LIMIT 1) img ON true
            """;

    /** Anunțurile utilizatorilor blocați (în orice sens) nu apar. */
    private static final String BLOCK_FILTER = " AND NOT EXISTS (SELECT 1 FROM user_blocks b WHERE (b.blocker_id = CAST(:viewer AS uuid) AND b.blocked_id = l.seller_id)"
            + " OR (b.blocked_id = CAST(:viewer AS uuid) AND b.blocker_id = l.seller_id))";

    private final JdbcClient jdbc;

    public ListingQueries(JdbcClient jdbc) { this.jdbc = jdbc; }

    public record Suggestion(String text, String category, int count) {}

    /**
     * Sugestii pentru căutare (combobox): expresii scurte din titlurile anunțurilor active care conțin textul scris.
     * Interogare parametrizată; caracterele speciale din LIKE (% _ \) sunt neutralizate.
     */
    public List<Suggestion> suggest(String raw) {
        String q = raw == null ? "" : raw.trim().toLowerCase(Locale.ROOT);
        if (q.length() < 2 || q.length() > 60) return List.of();
        String like = "%" + escapeLike(q) + "%";
        record Row(String title, String category) {}
        List<Row> rows = jdbc.sql("""
                SELECT title, category FROM listings WHERE status = 'ACTIVE' AND title ILIKE ? ESCAPE '\\'
                ORDER BY view_count DESC, created_at DESC LIMIT 60""")
                .param(like).query((rs, i) -> new Row(rs.getString(1), rs.getString(2))).list();
        Map<String, int[]> counts = new LinkedHashMap<>();
        Map<String, String> cats = new HashMap<>();
        for (Row r : rows) {
            String phrase = phrase(r.title().toLowerCase(Locale.ROOT), q);
            if (phrase == null) continue;
            counts.computeIfAbsent(phrase, k -> new int[1])[0]++;
            cats.putIfAbsent(phrase, r.category());
        }
        return counts.entrySet().stream().sorted((a, b) -> b.getValue()[0] - a.getValue()[0]).limit(6)
                .map(e -> new Suggestion(e.getKey(), cats.get(e.getKey()), e.getValue()[0])).toList();
    }

    /** Din „iphone 13 pro max 256gb albastru” și „iph” → „iphone 13 pro”: cuvântul potrivit plus maximum două după el. */
    private static String phrase(String title, String q) {
        String[] words = title.replaceAll("[^\\p{L}\\p{N} ]", " ").trim().split("\\s+");
        String first = q.split("\\s+")[0];
        for (int i = 0; i < words.length; i++) {
            if (words[i].contains(first)) {
                StringBuilder sb = new StringBuilder();
                for (int j = i; j < Math.min(words.length, i + 3); j++) { if (sb.length() > 0) sb.append(' '); sb.append(words[j]); }
                String p = sb.toString();
                return !q.contains(" ") || p.contains(q) ? p : null;
            }
        }
        return null;
    }

    public ListingDtos.Page<ListingDtos.Card> search(ListingDtos.SearchParams p, UUID viewer) {
        StringBuilder where = new StringBuilder(" WHERE l.status = 'ACTIVE' AND u.suspended = false");
        Map<String, Object> params = new HashMap<>();
        params.put("viewer", viewer);
        if (viewer != null) where.append(BLOCK_FILTER);
        String tsq = toPrefixQuery(p.q(), " & ", 6);
        if (tsq != null) {
            where.append(" AND (l.search_vector @@ to_tsquery('simple', :tsq) OR l.title ILIKE :like ESCAPE '\\')");
            params.put("tsq", tsq);
            params.put("like", "%" + escapeLike(p.q().strip()) + "%");
        }
        if (p.category() != null) { where.append(" AND l.category = :category"); params.put("category", p.category().name()); }
        if (p.minPrice() != null) { where.append(" AND l.price_cents >= :minPrice"); params.put("minPrice", p.minPrice()); }
        if (p.maxPrice() != null) { where.append(" AND l.price_cents <= :maxPrice"); params.put("maxPrice", p.maxPrice()); }
        if (p.country() != null) { where.append(" AND l.country = :country"); params.put("country", p.country()); }
        if (p.city() != null) { where.append(" AND lower(l.city) = lower(:city)"); params.put("city", p.city()); }
        if (p.conditions() != null && !p.conditions().isEmpty()) {
            where.append(" AND l.item_condition IN (:conditions)");
            params.put("conditions", p.conditions().stream().map(Enum::name).toList());
        }
        if (Boolean.TRUE.equals(p.swapOnly())) where.append(" AND l.accepts_swap = true");
        if (Boolean.TRUE.equals(p.verifiedOnly())) where.append(" AND u.id_verified = true");
        if (p.shipsTo() != null) {
            where.append(" AND (l.country = :shipsTo OR l.ships_to = '*' OR (',' || l.ships_to || ',') LIKE :shipsToLike)");
            params.put("shipsTo", p.shipsTo());
            params.put("shipsToLike", "%," + p.shipsTo() + ",%");
        }
        String order = switch (p.sort() == null ? "newest" : p.sort()) {
            case "price_asc" -> " ORDER BY promoted DESC, l.price_cents ASC, l.created_at DESC";
            case "price_desc" -> " ORDER BY promoted DESC, l.price_cents DESC, l.created_at DESC";
            case "relevance" -> tsq != null
                    ? " ORDER BY promoted DESC, ts_rank(l.search_vector, to_tsquery('simple', :tsq)) DESC, l.created_at DESC"
                    : " ORDER BY promoted DESC, GREATEST(l.created_at, COALESCE(l.bumped_at, l.created_at)) DESC";
            default -> " ORDER BY promoted DESC, GREATEST(l.created_at, COALESCE(l.bumped_at, l.created_at)) DESC";
        };
        int size = Math.clamp(p.size(), 1, 40);
        int page = Math.clamp(p.page(), 0, 200);
        params.put("limit", size + 1);
        params.put("offset", page * size);
        List<ListingDtos.Card> rows = jdbc.sql(CARD_SELECT + where + order + " LIMIT :limit OFFSET :offset")
                .params(params).query(this::card).list();
        boolean more = rows.size() > size;
        return new ListingDtos.Page<>(more ? rows.subList(0, size) : rows, page, more);
    }

    public List<ListingDtos.Card> bySeller(UUID sellerId, UUID viewer, boolean includeAll) {
        String status = includeAll ? "l.status NOT IN ('DELETED')" : "l.status IN ('ACTIVE','SOLD')";
        return jdbc.sql(CARD_SELECT + " WHERE l.seller_id = :seller AND " + status + " ORDER BY l.created_at DESC LIMIT 100")
                .param("viewer", viewer).param("seller", sellerId).query(this::card).list();
    }

    public List<ListingDtos.Card> favorites(UUID userId) {
        return jdbc.sql(CARD_SELECT + " JOIN favorites fv ON fv.listing_id = l.id AND fv.user_id = :viewer " +
                        " WHERE l.status NOT IN ('DELETED','REMOVED') ORDER BY fv.created_at DESC LIMIT 200")
                .param("viewer", userId).query(this::card).list();
    }

    public List<ListingDtos.Card> byIds(Collection<UUID> ids, UUID viewer) {
        if (ids.isEmpty()) return List.of();
        List<ListingDtos.Card> rows = jdbc.sql(CARD_SELECT + " WHERE l.id IN (:ids)")
                .param("viewer", viewer).param("ids", ids).query(this::card).list();
        Map<UUID, ListingDtos.Card> map = new HashMap<>();
        rows.forEach(c -> map.put(c.id(), c));
        return ids.stream().map(map::get).filter(Objects::nonNull).toList();
    }

    public List<ListingDtos.Card> similar(Listing l, UUID viewer) {
        String tsq = toPrefixQuery(l.getTitle(), " | ", 4);
        Map<String, Object> params = new HashMap<>();
        params.put("viewer", viewer);
        params.put("id", l.getId());
        params.put("category", l.getCategory().name());
        String rank = "l.created_at DESC";
        if (tsq != null) {
            params.put("tsq", tsq);
            rank = "ts_rank(l.search_vector, to_tsquery('simple', :tsq)) DESC, l.created_at DESC";
        }
        return jdbc.sql(CARD_SELECT + " WHERE l.status = 'ACTIVE' AND u.suspended = false AND l.category = :category AND l.id <> :id"
                        + (viewer != null ? BLOCK_FILTER : "") + " ORDER BY " + rank + " LIMIT 8")
                .params(params).query(this::card).list();
    }

    private ListingDtos.Card card(ResultSet rs, int i) throws SQLException {
        long price = rs.getLong("price_cents");
        long prevMax = rs.getLong("prev_max");
        Long previous = (!rs.wasNull() && prevMax > price) ? prevMax : null;
        UUID imgId = rs.getObject("img_id", UUID.class);
        String key = rs.getString("img_key");
        return new ListingDtos.Card(
                rs.getObject("id", UUID.class), rs.getString("title"), price, rs.getString("currency"), previous,
                rs.getString("city"), rs.getString("country"), imgId == null ? null : ListingImage.thumbUrl(imgId, key),
                rs.getString("category"), rs.getString("item_condition"), rs.getBoolean("id_verified"),
                rs.getBoolean("promoted"), rs.getBoolean("accepts_swap"), rs.getBoolean("fav"),
                rs.getString("status"), rs.getTimestamp("created_at").toInstant(), rs.getBoolean("seller_business"),
                rs.getBoolean("negotiable"));
    }

    /** Transformă textul căutat în interogare full-text cu prefix: doar litere și cifre, fără operatori injectați. */
    static String toPrefixQuery(String q, String joiner, int maxTokens) {
        if (q == null || q.isBlank()) return null;
        List<String> tokens = new ArrayList<>();
        for (String t : q.toLowerCase(Locale.ROOT).split("[^\\p{L}\\p{N}]+")) {
            if (t.length() >= 2 && tokens.size() < maxTokens) tokens.add(t + ":*");
        }
        return tokens.isEmpty() ? null : String.join(joiner, tokens);
    }

    static String escapeLike(String s) {
        String v = s.length() > 80 ? s.substring(0, 80) : s;
        return v.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_");
    }
}
