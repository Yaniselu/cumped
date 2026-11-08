package com.velosyntech.cumped.velo;

import com.velosyntech.cumped.common.ApiException;
import com.velosyntech.cumped.common.AuditService;
import com.velosyntech.cumped.common.Texts;
import com.velosyntech.cumped.config.AppProperties;
import com.velosyntech.cumped.config.UserStatusCache;
import com.velosyntech.cumped.listing.Listing;
import com.velosyntech.cumped.listing.ListingRepository;
import com.velosyntech.cumped.notification.NotificationService;
import com.velosyntech.cumped.user.User;
import com.velosyntech.cumped.user.UserRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.event.EventListener;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.*;

/**
 * Velo AI: asistentul de suport. Răspunde la întrebări, strânge detaliile unei probleme, deschide tichete
 * trimise pe email la echipa de suport și, în cazurile clar suspecte, acționează singur temporar
 * (ascunde anunțul / suspendă contul) până la verificarea umană din panoul de admin.
 */
@Service
public class VeloService {
    private static final Logger log = LoggerFactory.getLogger(VeloService.class);
    private static final Set<String> CATEGORIES = Set.of("FRAUD", "DELIVERY", "PAYMENT", "ACCOUNT", "LISTING", "OTHER");
    private static final Set<String> PRIORITIES = Set.of("LOW", "MEDIUM", "HIGH", "URGENT");
    private static final int MAX_TURNS = 30;
    /** Praguri pentru acțiuni automate. Riscul estimat singur nu e suficient: cerem și dovezi independente. */
    private static final int AUTO_HIDE_RISK = 70;
    private static final int SUSPEND_DISTINCT_REPORTERS = 3;

    public record Reply(UUID sessionId, String reply, List<String> suggestions, Ticket ticket, String mode) {}
    public record Ticket(UUID id, String code, String category, String priority, String status, String autoAction,
                         String summary, Instant createdAt) {}

    private final JdbcClient jdbc;
    private final VeloAiClient ai;
    private final VeloRules rules;
    private final ScamDetector scam;
    private final MailOutbox mail;
    private final UserRepository users;
    private final ListingRepository listings;
    private final NotificationService notifications;
    private final AuditService audit;
    private final UserStatusCache statusCache;
    private final AppProperties props;

    public VeloService(JdbcClient jdbc, VeloAiClient ai, VeloRules rules, ScamDetector scam, MailOutbox mail,
                       UserRepository users, ListingRepository listings, NotificationService notifications,
                       AuditService audit, UserStatusCache statusCache, AppProperties props) {
        this.jdbc = jdbc;
        this.ai = ai;
        this.rules = rules;
        this.scam = scam;
        this.mail = mail;
        this.users = users;
        this.listings = listings;
        this.notifications = notifications;
        this.audit = audit;
        this.statusCache = statusCache;
        this.props = props;
    }

    @Transactional
    public Reply message(UUID userId, UUID sessionId, String rawMessage, UUID listingId, UUID reportedUserId) {
        User user = users.findById(userId).orElseThrow(ApiException::notFound);
        String message = Texts.clean(rawMessage);
        if (message == null || message.isEmpty() || message.length() > 1500) throw ApiException.badRequest("VALIDATION");

        record Session(UUID id, String transcript, int turns, UUID ticketId) {}
        Session s = sessionId == null ? null : jdbc.sql("SELECT id, transcript, turns, ticket_id FROM velo_sessions WHERE id = ? AND user_id = ?")
                .params(sessionId, userId)
                .query((rs, i) -> new Session(rs.getObject(1, UUID.class), rs.getString(2), rs.getInt(3), rs.getObject(4, UUID.class)))
                .optional().orElse(null);
        if (s == null) {
            UUID id = UUID.randomUUID();
            jdbc.sql("INSERT INTO velo_sessions(id, user_id) VALUES (?, ?)").params(id, userId).update();
            s = new Session(id, "", 0, null);
        }
        if (s.turns() >= MAX_TURNS) throw ApiException.badRequest("SESSION_TOO_LONG");

        // Datele sensibile (card, coduri) nu ajung nici în transcript, nici la AI, nici în email.
        String safeMessage = redactSecrets(message);
        Listing listing = listingId == null ? null : listings.findById(listingId).orElse(null);
        UUID reported = reportedUserId != null ? reportedUserId : listing != null ? listing.getSellerId() : null;
        if (reported != null && reported.equals(userId)) reported = null;

        String transcript = s.transcript() + "USER: " + safeMessage + "\n";
        int userTurns = s.turns() + 1;

        String context = contextFor(listing, reported, userId);
        boolean hasContext = listing != null || reported != null;
        VeloDecision d = ai.decide(transcript, user.getLocale(), context)
                .map(this::sanitize)
                .orElseGet(() -> rules.decide(safeMessage, userTurns, hasContext, user.getLocale()));
        String mode = ai.enabled() ? "AI" : "RULES";

        transcript += "VELO: " + d.reply() + "\n";
        Ticket ticket = null;
        UUID ticketId = s.ticketId();
        if (ticketId == null && d.createTicket() && "REPORT".equals(d.intent())) {
            ticket = openTicket(user, d, transcript, listing, reported, "VELO");
            ticketId = ticket.id();
        } else if (ticketId != null) {
            jdbc.sql("UPDATE support_tickets SET transcript = ?, updated_at = now() WHERE id = ?").params(transcript, ticketId).update();
            ticket = loadTicket(ticketId);
        }
        jdbc.sql("UPDATE velo_sessions SET transcript = ?, turns = ?, ticket_id = ?, updated_at = now() WHERE id = ?")
                .params(transcript, userTurns, ticketId, s.id()).update();
        return new Reply(s.id(), d.reply(), d.suggestions() == null ? List.of() : d.suggestions(), ticket, mode);
    }

    @Transactional(readOnly = true)
    public List<Ticket> myTickets(UUID userId) {
        return jdbc.sql("SELECT id FROM support_tickets WHERE reporter_id = ? ORDER BY created_at DESC LIMIT 50")
                .param(userId).query(UUID.class).list().stream().map(this::loadTicket).toList();
    }

    /** Raport automat de la sistem (ex.: tentative repetate de phishing blocate în chat). */
    @EventListener
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void onSuspicious(SuspiciousActivityEvent e) {
        int open = jdbc.sql("SELECT count(*) FROM support_tickets WHERE related_user_id = ? AND source = 'SYSTEM' AND status = 'OPEN' AND created_at > now() - interval '24 hours'")
                .param(e.suspectId()).query(Integer.class).single();
        if (open > 0) return;
        Listing listing = e.listingId() == null ? null : listings.findById(e.listingId()).orElse(null);
        VeloDecision d = new VeloDecision("", "REPORT", "FRAUD", "URGENT", 90, true,
                "Detectare automată: utilizatorul a încercat de mai multe ori să trimită în chat mesaje blocate (" +
                        String.join(", ", e.reasons()) + ").", List.of());
        String evidence = "SYSTEM: mesaj blocat (redactat): " + redactSecrets(e.evidence()) + "\n";
        openTicket(null, d, evidence, listing, e.suspectId(), "SYSTEM");
    }

    private Ticket openTicket(User reporter, VeloDecision d, String transcript, Listing listing, UUID reported, String source) {
        UUID id = UUID.randomUUID();
        String code;
        do { code = "CMP-" + Texts.randomCode(6); }
        while (jdbc.sql("SELECT count(*) FROM support_tickets WHERE code = ?").param(code).query(Integer.class).single() > 0);
        String summary = d.summary() == null || d.summary().isBlank() ? "Raport " + d.category() : d.summary();

        // --- Acțiune automată, doar cu dovezi independente de afirmațiile reclamantului ---
        String autoAction = null;
        if ("FRAUD".equals(d.category()) && d.risk() >= AUTO_HIDE_RISK && reported != null) {
            int flaggedFromSuspect = reporter == null ? 0 : jdbc.sql("""
                    SELECT count(*) FROM messages m JOIN conversations c ON c.id = m.conversation_id
                    WHERE m.sender_id = :suspect AND m.flagged = true AND (c.buyer_id = :reporter OR c.seller_id = :reporter)""")
                    .param("suspect", reported).param("reporter", reporter.getId()).query(Integer.class).single();
            int blockedAttempts = jdbc.sql("SELECT count(*) FROM audit_log WHERE actor_id = ? AND action = 'MSG_BLOCKED' AND created_at > now() - interval '7 days'")
                    .param(reported).query(Integer.class).single();
            int otherReporters = jdbc.sql("""
                    SELECT count(DISTINCT reporter_id) FROM support_tickets
                    WHERE related_user_id = ? AND category = 'FRAUD' AND created_at > now() - interval '30 days'
                      AND reporter_id IS NOT NULL AND reporter_id <> CAST(? AS uuid)""")
                    .params(reported, reporter == null ? null : reporter.getId()).query(Integer.class).single();
            boolean corroborated = flaggedFromSuspect > 0 || blockedAttempts > 0 || otherReporters >= 1 || "SYSTEM".equals(source);

            if (corroborated && otherReporters + 1 >= SUSPEND_DISTINCT_REPORTERS) {
                users.findById(reported).filter(u -> !u.isSuspended() && u.getRole() != User.Role.ADMIN).ifPresent(u -> {
                    u.setSuspended(true);
                    u.setSuspendedReason("VELO_AUTO_REVIEW");
                    users.save(u);
                    statusCache.evict(u.getId());
                    audit.log(null, "VELO_AUTO_SUSPEND", u.getId().toString());
                });
                autoAction = "SUSPEND_USER";
            } else if (corroborated && listing != null && listing.getStatus() == Listing.Status.ACTIVE
                    && listing.getSellerId().equals(reported)) {
                listing.setStatus(Listing.Status.HIDDEN_BY_AI);
                listing.touch();
                listings.save(listing);
                notifications.notify(listing.getSellerId(), "LISTING_UNDER_REVIEW", Map.of("title", listing.getTitle()), "/my-listings");
                audit.log(null, "VELO_AUTO_HIDE", listing.getId().toString());
                autoAction = "HIDE_LISTING";
            }
        }

        jdbc.sql("""
                INSERT INTO support_tickets(id, code, reporter_id, category, priority, risk_score, summary, transcript,
                    related_listing_id, related_user_id, auto_action, auto_action_state, source)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""")
                .params(id, code, reporter == null ? null : reporter.getId(), d.category(), d.priority(), d.risk(), summary,
                        transcript, listing == null ? null : listing.getId(), reported, autoAction,
                        autoAction == null ? null : "APPLIED", source)
                .update();
        if (reporter != null) {
            notifications.notify(reporter.getId(), "TICKET_OPENED", Map.of("code", code), "/support");
        }
        mail.enqueue(props.supportEmail(), "[Cumped][" + d.priority() + "][" + d.category() + "] Tichet " + code,
                ticketEmail(code, reporter, d, summary, transcript, listing, reported, autoAction, source));
        log.info("Ticket {} opened category={} priority={} autoAction={}", code, d.category(), d.priority(), autoAction);
        return loadTicket(id);
    }

    private String ticketEmail(String code, User reporter, VeloDecision d, String summary, String transcript,
                               Listing listing, UUID reported, String autoAction, String source) {
        StringBuilder b = new StringBuilder();
        b.append("Tichet nou: ").append(code).append('\n');
        b.append("Sursă: ").append(source).append(" | Categorie: ").append(d.category())
                .append(" | Prioritate: ").append(d.priority()).append(" | Risc estimat: ").append(d.risk()).append("/100\n\n");
        b.append("REZUMAT\n").append(summary).append("\n\n");
        if (reporter != null) {
            b.append("RECLAMANT\n").append("Username: ").append(reporter.getUsername()).append(" | ID: ").append(reporter.getId())
                    .append(" | Email: ").append(reporter.getEmail()).append(" | Verificat: ").append(reporter.isIdVerified() ? "da" : "nu").append("\n\n");
        }
        if (reported != null) {
            users.findById(reported).ifPresent(u -> b.append("PERSOANA RAPORTATĂ\n").append("Username: ").append(u.getUsername())
                    .append(" | ID: ").append(u.getId()).append(" | Verificat: ").append(u.isIdVerified() ? "da" : "nu")
                    .append(" | Cont creat: ").append(u.getCreatedAt()).append("\n\n"));
        }
        if (listing != null) {
            b.append("ANUNȚ\n").append(listing.getTitle()).append(" | ").append(props.publicUrl()).append("/listing/").append(listing.getId())
                    .append(" | Status: ").append(listing.getStatus()).append("\n\n");
        }
        if (autoAction != null) {
            b.append("ACȚIUNE AUTOMATĂ VELO: ").append(autoAction)
                    .append(" (temporară; confirmă sau anulează din panoul de admin)\n\n");
        }
        if (reporter != null && reported != null) {
            List<String> evidence = jdbc.sql("""
                    SELECT m.created_at, m.sender_id = :reported AS from_reported, m.body, m.flagged FROM messages m
                    JOIN conversations c ON c.id = m.conversation_id
                    WHERE ((c.buyer_id = :reporter AND c.seller_id = :reported) OR (c.buyer_id = :reported AND c.seller_id = :reporter))
                    ORDER BY m.created_at DESC LIMIT 15""")
                    .param("reporter", reporter.getId()).param("reported", reported)
                    .query((rs, i) -> rs.getTimestamp(1).toInstant() + (rs.getBoolean(2) ? " [RAPORTAT] " : " [RECLAMANT] ")
                            + (rs.getBoolean(4) ? "(semnalat) " : "") + rs.getString(3)).list();
            if (!evidence.isEmpty()) {
                b.append("ULTIMELE MESAJE DIN CHAT (cele mai noi primele)\n");
                evidence.forEach(e -> b.append(e).append('\n'));
                b.append('\n');
            }
        }
        b.append("CONVERSAȚIA CU VELO\n").append(transcript);
        return b.toString();
    }

    Ticket loadTicket(UUID id) {
        return jdbc.sql("SELECT id, code, category, priority, status, auto_action, summary, created_at FROM support_tickets WHERE id = ?")
                .param(id)
                .query((rs, i) -> new Ticket(rs.getObject(1, UUID.class), rs.getString(2), rs.getString(3), rs.getString(4),
                        rs.getString(5), rs.getString(6), rs.getString(7), rs.getTimestamp(8).toInstant()))
                .single();
    }

    private String contextFor(Listing listing, UUID reported, UUID me) {
        StringBuilder b = new StringBuilder();
        if (listing != null) b.append("Context: the user opened Velo from listing \"").append(listing.getTitle()).append("\".\n");
        if (reported != null) {
            int flagged = jdbc.sql("""
                    SELECT count(*) FROM messages m JOIN conversations c ON c.id = m.conversation_id
                    WHERE m.sender_id = ? AND m.flagged = true AND (c.buyer_id = ? OR c.seller_id = ?)""")
                    .params(reported, me, me).query(Integer.class).single();
            if (flagged > 0) b.append("System fact: the reported user sent ").append(flagged)
                    .append(" message(s) to this user that our scam filter flagged (links/off-platform contact).\n");
        }
        return b.toString();
    }

    /** Nu avem încredere oarbă în ieșirea modelului: normalizăm valorile și limităm lungimile. */
    private VeloDecision sanitize(VeloDecision d) {
        String category = d.category() != null && CATEGORIES.contains(d.category()) ? d.category() : "OTHER";
        String priority = d.priority() != null && PRIORITIES.contains(d.priority()) ? d.priority() : "MEDIUM";
        String intent = Set.of("FAQ", "REPORT", "SMALLTALK").contains(d.intent()) ? d.intent() : "SMALLTALK";
        String reply = d.reply() == null || d.reply().isBlank() ? "…" : VeloRules.truncate(scam.analyze(d.reply()).sanitized(), 1500);
        List<String> sugg = d.suggestions() == null ? List.of() : d.suggestions().stream().filter(Objects::nonNull)
                .map(x -> VeloRules.truncate(x, 60)).limit(3).toList();
        return new VeloDecision(reply, intent, category, priority, Math.clamp(d.risk(), 0, 100), d.createTicket(),
                d.summary() == null ? "" : VeloRules.truncate(d.summary(), 1500), sugg);
    }

    static String redactSecrets(String s) {
        if (s == null) return "";
        return s.replaceAll("(?<!\\d)(?:\\d[ -]?){13,19}(?!\\d)", "[număr card ascuns]")
                .replaceAll("(?i)(cvv|cvc|pin|cod|code)\\s*[:=]?\\s*\\d{3,8}", "$1 [ascuns]");
    }
}
