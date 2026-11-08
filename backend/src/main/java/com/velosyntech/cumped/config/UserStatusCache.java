package com.velosyntech.cumped.config;

import com.velosyntech.cumped.user.UserRepository;
import org.springframework.stereotype.Component;

import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Verifică rapid dacă un token de acces mai e valid (cont suspendat, logout de pe toate dispozitivele).
 * Cache scurt (20s) ca să nu lovim baza de date la fiecare cerere.
 */
@Component
public class UserStatusCache {
    private record Entry(int tokenVersion, boolean suspended, long loadedAt) {}

    private final UserRepository users;
    private final Map<UUID, Entry> cache = new ConcurrentHashMap<>();

    public UserStatusCache(UserRepository users) { this.users = users; }

    public boolean isTokenValid(UUID userId, int tokenVersion) {
        Entry e = cache.get(userId);
        long now = System.currentTimeMillis();
        if (e == null || now - e.loadedAt > 20_000) {
            e = users.findById(userId)
                    .map(u -> new Entry(u.getTokenVersion(), u.isSuspended(), now))
                    .orElse(new Entry(-1, true, now));
            if (cache.size() > 50_000) cache.clear();
            cache.put(userId, e);
        }
        return !e.suspended && e.tokenVersion == tokenVersion;
    }

    public void evict(UUID userId) { cache.remove(userId); }
}
