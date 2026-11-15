package com.velosyntech.cumped.user;

import com.velosyntech.cumped.common.ApiException;
import com.velosyntech.cumped.common.AuditService;
import com.velosyntech.cumped.common.FieldCrypto;
import com.velosyntech.cumped.common.Fx;
import com.velosyntech.cumped.common.Texts;
import com.velosyntech.cumped.config.AppProperties;
import com.velosyntech.cumped.listing.Category;
import com.velosyntech.cumped.notification.NotificationService;
import com.velosyntech.cumped.velo.MailOutbox;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.sql.Timestamp;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.Period;
import java.time.ZoneOffset;
import java.util.EnumSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

/**
 * Conturi pentru 16–17 ani, gestionate de un părinte sau tutore.
 *
 * Temeiul: între 14 și 18 ani, actele juridice se încheie cu încuviințarea părinților (Codul civil, art. 41).
 * Părintele își dă acordul o singură dată, cu identitatea verificată, pentru tranzacțiile din limitele de mai jos;
 * acordul (cine, când, ce versiune de declarație, ce limită) se păstrează ca dovadă în guardian_consents.
 *
 * Limitele contului (verificate pe server, nu doar în aplicație):
 *  - fără acordul părintelui: doar navigare și favorite (fără anunțuri, oferte, comenzi sau mesaje);
 *  - cel mult {@link #MAX_EUR_CENTS} pe produs / tranzacție (în moneda anunțului);
 *  - fără categoriile auto, imobiliare, locuri de muncă, servicii și animale;
 *  - doar livrare prin curier (fără întâlniri pentru predare);
 *  - banii din vânzări ajung la părinte; părintele e anunțat la fiecare comandă;
 *  - în conversații nu se pot trimite telefoane, emailuri, linkuri sau invitații pe alte aplicații;
 *  - numele real și orașul nu apar public;
 *  - părintele poate opri temporar contul sau își poate retrage acordul oricând;
 *  - la 18 ani, limitele dispar singure, iar legătura cu părintele se încheie.
 */
@Service
public class Guardianship {
    public static final int MIN_AGE = 16;
    public static final long MAX_EUR_CENTS = 6000; // 60 € (≈ 300 lei)
    public static final Set<Category> BLOCKED = EnumSet.of(Category.VEHICLES, Category.REAL_ESTATE, Category.JOBS, Category.SERVICES, Category.PETS);
    public static final String DECLARATION_VERSION = "2026-11";
    static final Duration INVITE_TTL = Duration.ofDays(14);
    static final int INVITES_PER_DAY = 3;
    private static final List<String> CURRENCIES = List.of("RON", "EUR", "USD", "GBP", "PLN", "HUF", "BGN", "CZK", "CHF", "TRY", "UAH", "MDL");

    public record Supervision(String status, long maxEurCents, Map<String, Long> caps, List<String> blockedCategories,
                              LocalDate adultAt, boolean courierOnly) {}
    public record InviteView(String teenUsername, int teenAge, int avatarHue, long maxEurCents, Map<String, Long> caps,
                             List<String> blockedCategories, Instant expiresAt, String declarationVersion) {}
    public record ChildOrder(UUID id, String code, String title, long totalCents, String currency, String status, String role, Instant createdAt) {}
    public record Child(UUID id, String username, int avatarHue, int age, String status, LocalDate adultAt,
                        int activeListings, int openOrders, List<ChildOrder> recentOrders) {}

    private final UserRepository users;
    private final JdbcClient jdbc;
    private final MailOutbox mail;
    private final NotificationService notifications;
    private final AuditService audit;
    private final AppProperties props;
    private final QuotaService quota;

    public Guardianship(UserRepository users, JdbcClient jdbc, MailOutbox mail, NotificationService notifications,
                        AuditService audit, AppProperties props, QuotaService quota) {
        this.users = users;
        this.jdbc = jdbc;
        this.mail = mail;
        this.notifications = notifications;
        this.audit = audit;
        this.props = props;
        this.quota = quota;
    }

    // ---------------- vârsta ----------------

    public static LocalDate today() { return LocalDate.now(ZoneOffset.UTC); }

    public static int age(LocalDate birth) { return Period.between(birth, today()).getYears(); }

    static int ageFromAdultAt(LocalDate adultAt) { return Math.max(MIN_AGE, Math.min(17, age(adultAt.minusYears(18)))); }

    // ---------------- regulile contului ----------------

    public static long capFor(String currency) { return Fx.fromEurCents(MAX_EUR_CENTS, currency == null ? "EUR" : currency); }

    public static Map<String, Long> capsMap() { return caps(); }

    private static Map<String, Long> caps() {
        Map<String, Long> m = new LinkedHashMap<>();
        for (String c : CURRENCIES) m.put(c, capFor(c));
        return m;
    }

    private static List<String> blocked() { return BLOCKED.stream().map(Enum::name).toList(); }

    public Supervision supervision(User u) {
        if (!u.isMinorAccount()) return null;
        return new Supervision(u.getGuardianStatus(), MAX_EUR_CENTS, caps(), blocked(), u.getAdultAt(), true);
    }

    /** Anunțuri, oferte, comenzi și mesaje: doar cu acordul activ al părintelui. */
    public void requireCanTransact(User u) {
        if (!u.isMinorAccount()) return;
        String s = u.getGuardianStatus();
        if ("APPROVED".equals(s)) return;
        throw new ApiException(HttpStatus.FORBIDDEN, "PAUSED".equals(s) ? "GUARDIAN_PAUSED" : "GUARDIAN_APPROVAL_REQUIRED");
    }

    public void checkListing(User seller, Category category, long priceCents, String currency, String shipsTo) {
        if (!seller.isMinorAccount()) return;
        requireCanTransact(seller);
        if (category != null && BLOCKED.contains(category)) throw ApiException.badRequest("MINOR_CATEGORY");
        if (priceCents > capFor(currency)) throw ApiException.badRequest("MINOR_PRICE_LIMIT");
        if (shipsTo == null || shipsTo.isBlank()) throw ApiException.badRequest("MINOR_COURIER_ONLY");
    }

    /** Cumpărare (comandă sau ofertă) făcută de un minor. */
    public void checkPurchase(User buyer, long amountCents, String currency, String delivery) {
        if (!buyer.isMinorAccount()) return;
        requireCanTransact(buyer);
        if (amountCents > capFor(currency)) throw ApiException.badRequest("MINOR_PRICE_LIMIT");
        if (delivery != null && !"COURIER".equals(delivery)) throw ApiException.badRequest("MINOR_COURIER_ONLY");
    }

    /** Vânzare către un cumpărător: dacă vânzătorul e minor, doar prin curier. */
    public void checkSale(User seller, String delivery) {
        if (seller.isMinorAccount() && !"COURIER".equals(delivery)) throw ApiException.badRequest("MINOR_COURIER_ONLY");
    }

    public boolean courierOnly(User seller) { return seller != null && seller.isMinorAccount(); }

    /** Cine primește banii dintr-o vânzare: la conturile supravegheate, părintele. */
    public UUID payoutFor(User seller) {
        return seller.isMinorAccount() && seller.getGuardianId() != null ? seller.getGuardianId() : seller.getId();
    }

    public boolean involvesMinor(UUID a, UUID b) {
        return users.findById(a).map(User::isMinorAccount).orElse(false) || users.findById(b).map(User::isMinorAccount).orElse(false);
    }

    /** Părintele află de fiecare comandă a contului supravegheat. */
    public void notifyGuardianOfOrder(User teen, String role, String title, long amountCents, String currency, String link) {
        if (!teen.isMinorAccount() || teen.getGuardianId() == null) return;
        notifications.notify(teen.getGuardianId(), "CHILD_ORDER",
                Map.of("name", teen.getUsername(), "role", role, "title", title, "amount", amountCents, "currency", currency), link);
    }

    // ---------------- invitația către părinte ----------------

    @Transactional
    public void invite(User teen, String parentEmail) {
        String email = Texts.clean(parentEmail).toLowerCase(java.util.Locale.ROOT);
        if (!email.matches("^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$") || email.length() > 254) throw ApiException.badRequest("INVALID_PARENT_EMAIL");
        if (email.equalsIgnoreCase(teen.getEmail())) throw ApiException.badRequest("PARENT_EMAIL_SAME");
        int recent = jdbc.sql("SELECT count(*) FROM guardian_invites WHERE teen_id = ? AND created_at > now() - interval '24 hours'")
                .param(teen.getId()).query(Integer.class).single();
        if (recent >= INVITES_PER_DAY) throw ApiException.tooManyRequests("TOO_MANY_INVITES", 3600);
        users.flush(); // contul tocmai creat (JPA) trebuie să existe în tabel înainte de invitație (cheie străină)
        String token = Texts.randomToken(32);
        jdbc.sql("INSERT INTO guardian_invites(id, teen_id, parent_email, token_hash, expires_at) VALUES (?, ?, ?, ?, ?)")
                .params(UUID.randomUUID(), teen.getId(), FieldCrypto.encrypt(email), Texts.sha256("guardian|" + token),
                        Timestamp.from(Instant.now().plus(INVITE_TTL))).update();
        String link = props.publicUrl() + "/guardian/" + token;
        boolean ro = "ro".equals(teen.getLocale());
        mail.enqueue(email, ro ? "Cumped: @" + teen.getUsername() + " îți cere acordul" : "Cumped: @" + teen.getUsername() + " asks for your consent",
                (ro ? """
                        Bună ziua,

                        @%s (16–17 ani) și-a făcut cont pe Cumped, platforma de anunțuri, și v-a trecut ca părinte sau tutore.
                        Contul funcționează doar cu acordul dumneavoastră și are limite: cel mult 60 € (≈ 300 lei) pe tranzacție,
                        doar livrare prin curier, fără auto, imobiliare, servicii sau animale; banii din vânzări ajung la dumneavoastră.

                        Dacă sunteți părintele sau tutorele, deschideți linkul (valabil 14 zile):
                        %s

                        Dacă nu îl cunoașteți pe @%s, ignorați acest email: contul rămâne blocat.
                        """ : """
                        Hello,

                        @%s (aged 16–17) created a Cumped account and named you as their parent or guardian.
                        The account only works with your consent and has limits: at most €60 per transaction, courier delivery only,
                        no vehicles, property, services or pets; money from sales goes to you.

                        If you are their parent or guardian, open this link (valid for 14 days):
                        %s

                        If you don't know @%s, ignore this email: the account stays locked.
                        """).formatted(teen.getUsername(), link, teen.getUsername()));
        audit.log(teen.getId(), "GUARDIAN_INVITE_SENT", null);
    }

    @Transactional
    public void resend(UUID teenId, String parentEmail) {
        User teen = users.findById(teenId).orElseThrow(ApiException::notFound);
        if (!teen.isMinorAccount() || "APPROVED".equals(teen.getGuardianStatus()) || "PAUSED".equals(teen.getGuardianStatus()))
            throw ApiException.conflict("INVALID_STATE");
        String email = parentEmail;
        if (email == null || email.isBlank()) {
            email = jdbc.sql("SELECT parent_email FROM guardian_invites WHERE teen_id = ? ORDER BY created_at DESC LIMIT 1")
                    .param(teenId).query(String.class).optional().map(FieldCrypto::decrypt).orElseThrow(() -> ApiException.badRequest("INVALID_PARENT_EMAIL"));
        }
        if (!"PENDING".equals(teen.getGuardianStatus())) { teen.setGuardianStatus("PENDING"); users.save(teen); }
        invite(teen, email);
    }

    private record Invite(UUID id, UUID teenId, Instant expiresAt, Instant usedAt) {}

    private Invite findInvite(String token) {
        if (token == null || token.length() > 100) throw ApiException.notFound();
        Invite inv = jdbc.sql("SELECT id, teen_id, expires_at, used_at FROM guardian_invites WHERE token_hash = ?")
                .param(Texts.sha256("guardian|" + token))
                .query((rs, i) -> new Invite(rs.getObject(1, UUID.class), rs.getObject(2, UUID.class), rs.getTimestamp(3).toInstant(),
                        rs.getTimestamp(4) == null ? null : rs.getTimestamp(4).toInstant()))
                .optional().orElseThrow(ApiException::notFound);
        if (inv.usedAt() != null || inv.expiresAt().isBefore(Instant.now())) throw ApiException.notFound();
        return inv;
    }

    public InviteView inviteView(String token) {
        Invite inv = findInvite(token);
        User teen = users.findById(inv.teenId()).orElseThrow(ApiException::notFound);
        if (!teen.isMinorAccount()) throw ApiException.notFound();
        return new InviteView(teen.getUsername(), ageFromAdultAt(teen.getAdultAt()), teen.getAvatarHue(), MAX_EUR_CENTS, caps(), blocked(),
                inv.expiresAt(), DECLARATION_VERSION);
    }

    @Transactional
    public void accept(String token, UUID parentId, boolean declaration) {
        if (!declaration) throw ApiException.badRequest("DECLARATION_REQUIRED");
        Invite inv = findInvite(token);
        User parent = users.findById(parentId).orElseThrow(ApiException::notFound);
        User teen = users.findById(inv.teenId()).orElseThrow(ApiException::notFound);
        if (parent.getId().equals(teen.getId())) throw ApiException.badRequest("PARENT_SAME");
        if (parent.isMinorAccount() || !parent.isAdultConfirmed() || parent.isSuspended()) throw new ApiException(HttpStatus.FORBIDDEN, "PARENT_NOT_ADULT");
        if (!parent.isIdVerified()) throw new ApiException(HttpStatus.FORBIDDEN, "PARENT_NOT_VERIFIED");
        if (!teen.isMinorAccount()) throw ApiException.conflict("INVALID_STATE");
        teen.setGuardianId(parent.getId());
        teen.setGuardianStatus("APPROVED");
        teen.setGuardianApprovedAt(Instant.now());
        users.save(teen);
        jdbc.sql("UPDATE guardian_invites SET used_at = now() WHERE teen_id = ? AND used_at IS NULL").param(teen.getId()).update();
        consent(teen.getId(), parent.getId(), "APPROVED");
        audit.log(parent.getId(), "GUARDIAN_APPROVED", teen.getId().toString());
        notifications.notify(teen.getId(), "GUARDIAN_APPROVED", Map.of("name", parent.getUsername()), "/profile");
        // Pentru programul de invitații, contul supravegheat contează ca verificat (prin părinte).
        quota.markReferralQualified(teen.getId());
    }

    @Transactional
    public void decline(String token) {
        Invite inv = findInvite(token);
        User teen = users.findById(inv.teenId()).orElseThrow(ApiException::notFound);
        teen.setGuardianStatus("DECLINED");
        users.save(teen);
        jdbc.sql("UPDATE guardian_invites SET used_at = now() WHERE teen_id = ? AND used_at IS NULL").param(teen.getId()).update();
        consent(teen.getId(), null, "DECLINED");
        notifications.notify(teen.getId(), "GUARDIAN_DECLINED", Map.of(), "/profile");
    }

    // ---------------- panoul părintelui ----------------

    public List<Child> children(UUID parentId) {
        return users.findByGuardianId(parentId).stream().filter(User::isMinorAccount).map(t -> {
            int active = jdbc.sql("SELECT count(*) FROM listings WHERE seller_id = ? AND status IN ('ACTIVE','PAUSED')").param(t.getId()).query(Integer.class).single();
            int open = jdbc.sql("SELECT count(*) FROM orders WHERE (buyer_id = ? OR seller_id = ?) AND status IN ('PAID','SHIPPED','DISPUTED','RETURN_REQUESTED')")
                    .params(t.getId(), t.getId()).query(Integer.class).single();
            List<ChildOrder> recent = jdbc.sql("""
                    SELECT o.id, o.code, l.title, o.total_cents, o.currency, o.status, CASE WHEN o.seller_id = :t THEN 'SELLER' ELSE 'BUYER' END, o.created_at
                    FROM orders o JOIN listings l ON l.id = o.listing_id WHERE o.buyer_id = :t OR o.seller_id = :t ORDER BY o.created_at DESC LIMIT 5""")
                    .param("t", t.getId())
                    .query((rs, i) -> new ChildOrder(rs.getObject(1, UUID.class), rs.getString(2), rs.getString(3), rs.getLong(4), rs.getString(5),
                            rs.getString(6), rs.getString(7), rs.getTimestamp(8).toInstant())).list();
            return new Child(t.getId(), t.getUsername(), t.getAvatarHue(), ageFromAdultAt(t.getAdultAt()), t.getGuardianStatus(), t.getAdultAt(),
                    active, open, recent);
        }).toList();
    }

    /** PAUSE: contul nu mai poate vinde, cumpăra sau scrie (anunțurile active trec pe pauză). RESUME: revine. REVOKE: acordul e retras. */
    @Transactional
    public void control(UUID parentId, UUID teenId, String action) {
        User teen = users.findById(teenId).orElseThrow(ApiException::notFound);
        if (!parentId.equals(teen.getGuardianId()) || !teen.isMinorAccount()) throw ApiException.notFound();
        String s = teen.getGuardianStatus();
        switch (action) {
            case "PAUSE" -> {
                if (!"APPROVED".equals(s)) throw ApiException.conflict("INVALID_STATE");
                teen.setGuardianStatus("PAUSED");
                pauseListings(teenId);
            }
            case "RESUME" -> {
                if (!"PAUSED".equals(s)) throw ApiException.conflict("INVALID_STATE");
                teen.setGuardianStatus("APPROVED");
            }
            case "REVOKE" -> {
                teen.setGuardianStatus("REVOKED");
                teen.setGuardianId(null);
                pauseListings(teenId);
            }
            default -> throw ApiException.badRequest("VALIDATION");
        }
        users.save(teen);
        String done = switch (action) { case "PAUSE" -> "PAUSED"; case "RESUME" -> "RESUMED"; default -> "REVOKED"; };
        consent(teenId, parentId, done);
        audit.log(parentId, "GUARDIAN_" + done, teenId.toString());
        notifications.notify(teenId, "GUARDIAN_" + done, Map.of(), "/profile");
    }

    private void pauseListings(UUID teenId) {
        jdbc.sql("UPDATE listings SET status = 'PAUSED', updated_at = now() WHERE seller_id = ? AND status = 'ACTIVE'").param(teenId).update();
    }

    private void consent(UUID teenId, UUID parentId, String action) {
        jdbc.sql("INSERT INTO guardian_consents(id, teen_id, parent_id, action, declaration_version, max_eur_cents) VALUES (?, ?, ?, ?, ?, ?)")
                .params(UUID.randomUUID(), teenId, parentId, action, DECLARATION_VERSION, (int) MAX_EUR_CENTS).update();
    }

    // ---------------- majoratul ----------------

    /** Zilnic: cine a împlinit 18 ani devine cont obișnuit, iar legătura cu părintele se încheie. */
    @Scheduled(cron = "0 23 4 * * *")
    @Transactional
    public void graduate() {
        for (User u : users.findByAdultAtLessThanEqual(today())) {
            UUID guardian = u.getGuardianId();
            consent(u.getId(), guardian, "ADULT");
            u.setAdultAt(null);
            u.setGuardianId(null);
            u.setGuardianStatus(null);
            u.acceptTerms(u.getTermsVersion());
            users.save(u);
            notifications.notify(u.getId(), "ACCOUNT_ADULT", Map.of(), "/profile");
            if (guardian != null) notifications.notify(guardian, "CHILD_ADULT", Map.of("name", u.getUsername()), "/profile");
        }
    }
}
