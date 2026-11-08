package com.velosyntech.cumped.demo;

import com.velosyntech.cumped.common.Texts;
import com.velosyntech.cumped.config.AppProperties;
import com.velosyntech.cumped.listing.Category;
import com.velosyntech.cumped.listing.Listing;
import com.velosyntech.cumped.listing.ListingRepository;
import com.velosyntech.cumped.user.User;
import com.velosyntech.cumped.user.UserRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.core.annotation.Order;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.sql.Timestamp;
import java.time.Duration;
import java.time.Instant;
import java.util.*;

/**
 * Date demo pentru prototip (DEMO_DATA=true). Nu rulează niciodată dacă există deja anunțuri.
 * Imaginile sunt ilustrații din frontend (assets/demo/*.svg).
 */
@Component
@Order(2)
public class DemoDataSeeder implements ApplicationRunner {
    private static final Logger log = LoggerFactory.getLogger(DemoDataSeeder.class);
    public static final String DEMO_EMAIL = "demo@cumped.com";
    public static final String DEMO_PASSWORD = "Cumped-Demo-2026";

    private final AppProperties props;
    private final UserRepository users;
    private final ListingRepository listings;
    private final JdbcClient jdbc;
    private final PasswordEncoder encoder;

    public DemoDataSeeder(AppProperties props, UserRepository users, ListingRepository listings, JdbcClient jdbc, PasswordEncoder encoder) {
        this.props = props;
        this.users = users;
        this.listings = listings;
        this.jdbc = jdbc;
        this.encoder = encoder;
    }

    @Override
    @Transactional
    public void run(ApplicationArguments args) {
        if (!props.demoData() || listings.count() > 0) return;

        User demo = user(DEMO_EMAIL, "alex.demo", "Alexandru", "Ionescu", true, true, "Cluj-Napoca", 255, User.DisplayMode.USERNAME, 400);
        demo.setPasswordHash(encoder.encode(DEMO_PASSWORD));
        users.saveAndFlush(demo);
        User andrei = user("andrei@example.com", "andrei.p", "Andrei", "Popescu", true, true, "București", 200, User.DisplayMode.REAL_NAME, 800);
        User maria = user("maria@example.com", "maria_vinde", "Maria", "Dumitrescu", true, true, "Cluj-Napoca", 330, User.DisplayMode.USERNAME, 600);
        User auto = user("auto@example.com", "autocenter", "Mihai", "Stan", true, true, "Timișoara", 20, User.DisplayMode.USERNAME, 900);
        auto.setPlan(User.Plan.PRO);
        auto.setPlanUntil(Instant.now().plus(Duration.ofDays(25)));
        auto.setBio("Dealer auto verificat. Mașini verificate tehnic, cu istoric complet.");
        users.save(auto);
        User radu = user("radu@example.com", "radu1998", null, null, false, false, "Iași", 140, User.DisplayMode.USERNAME, 3);
        User elena = user("elena@example.com", "elena.home", "Elena", "Marin", true, false, "Brașov", 300, User.DisplayMode.REAL_NAME, 300);

        rate(andrei, 5, 5, 4, 5, 5, 5);
        rate(maria, 5, 4, 5, 5);
        rate(auto, 5, 5, 5, 4, 5, 5, 5, 5);
        rate(elena, 5, 5);

        record L(User seller, String title, String desc, Category cat, Listing.Condition cond, long price, String cur,
                 String city, String img, Long oldPrice, boolean swap, int daysAgo, Map<String, String> attrs, boolean promoted) {}
        List<L> data = List.of(
                new L(andrei, "iPhone 15 Pro 256GB Natural Titanium", "Folosit 8 luni, mereu cu husă și folie. Baterie 94%. Vine în cutie, cu cablul original și factura. Fără zgârieturi.", Category.PHONES, Listing.Condition.LIKE_NEW, 429900, "RON", "București", "phone", 479900L, false, 2, Map.of("Stocare", "256 GB", "Baterie", "94%", "Culoare", "Natural Titanium"), true),
                new L(maria, "iPhone 15 Pro 128GB, ca nou", "Telefon impecabil, folosit cu grijă. Garanție până în martie. Predare personală în Cluj sau curier.", Category.PHONES, Listing.Condition.LIKE_NEW, 409900, "RON", "Cluj-Napoca", "phone", null, false, 5, Map.of("Stocare", "128 GB", "Baterie", "97%"), false),
                new L(elena, "iPhone 15 Pro Max 256GB albastru", "Stare foarte bună, mici urme pe ramă. Vând pentru că am primit telefon de serviciu.", Category.PHONES, Listing.Condition.GOOD, 519900, "RON", "Brașov", "phone", null, false, 9, Map.of("Stocare", "256 GB", "Baterie", "91%"), false),
                new L(radu, "iPhone 15 Pro 256GB sigilat", "Telefon nou sigilat, preț mic, doar azi. Livrare prin curier.", Category.PHONES, Listing.Condition.NEW, 239900, "RON", "Iași", "phone", null, false, 1, Map.of(), false),
                new L(maria, "Samsung Galaxy S24 128GB", "Folosit 6 luni, încărcător rapid inclus. Perfect funcțional, fără probleme.", Category.PHONES, Listing.Condition.GOOD, 315000, "RON", "Cluj-Napoca", "phone-android", null, true, 4, Map.of("Stocare", "128 GB"), false),
                new L(demo, "MacBook Air M3 13\" 16GB / 512GB", "Cumpărat în ianuarie, 42 de cicluri de baterie. Tastatură US-RO. Vine cu încărcătorul original și cutia.", Category.COMPUTERS, Listing.Condition.LIKE_NEW, 549900, "RON", "Cluj-Napoca", "laptop", 589900L, false, 3, Map.of("Procesor", "Apple M3", "RAM", "16 GB", "SSD", "512 GB"), false),
                new L(andrei, "Sony WH-1000XM5 căști noise cancelling", "Căști în stare excelentă, folosite doar acasă. Accept schimb cu AirPods Pro.", Category.ELECTRONICS, Listing.Condition.LIKE_NEW, 105000, "RON", "București", "headphones", null, true, 6, Map.of("Culoare", "Negru"), false),
                new L(elena, "PlayStation 5 Slim + 2 controllere", "Consola merge perfect, vine cu două controllere DualSense și jocul EA FC 25.", Category.ELECTRONICS, Listing.Condition.GOOD, 210000, "RON", "Brașov", "console", 235000L, true, 2, Map.of("Stocare", "1 TB"), true),
                new L(maria, "Bicicletă cursieră Cube Attain, mărime 56", "Grupul Shimano Claris, roți recent schimbate, revizie făcută luna trecută.", Category.SPORTS, Listing.Condition.GOOD, 340000, "RON", "Cluj-Napoca", "bike", null, false, 12, Map.of("Mărime cadru", "56 cm"), false),
                new L(elena, "Canapea extensibilă 3 locuri, gri", "Canapea comodă cu ladă de depozitare. Se ridică din Brașov, ajut la încărcare.", Category.HOME_GARDEN, Listing.Condition.GOOD, 120000, "RON", "Brașov", "sofa", null, false, 7, Map.of("Dimensiuni", "220 × 95 cm"), false),
                new L(auto, "BMW Seria 3 320d xDrive 2019", "Mașină verificată, istoric service complet la reprezentanță, 128.000 km reali. Posibilitate de leasing.", Category.VEHICLES, Listing.Condition.GOOD, 2190000, "EUR", "Timișoara", "car", null, false, 3, Map.of("An", "2019", "Kilometraj", "128.000 km", "Combustibil", "Diesel", "Cutie", "Automată"), true),
                new L(auto, "Tesla Model 3 Long Range 2023", "Autopilot, încărcare rapidă gratuită transferabilă, garanție baterie 8 ani. Ca nouă.", Category.VEHICLES, Listing.Condition.LIKE_NEW, 3350000, "EUR", "Timișoara", "car-ev", 3590000L, false, 1, Map.of("An", "2023", "Kilometraj", "21.000 km", "Combustibil", "Electric", "Autonomie", "602 km"), true),
                new L(andrei, "Apartament 2 camere, 54 mp, Floreasca", "Apartament renovat complet, etaj 3/8, centrală proprie, aproape de metrou și parc.", Category.REAL_ESTATE, Listing.Condition.GOOD, 15900000, "EUR", "București", "apartment", null, false, 10, Map.of("Suprafață", "54 mp", "Etaj", "3/8", "An construcție", "2008"), false),
                new L(maria, "Nike Air Max 90, mărimea 42", "Purtați de câteva ori, curați, în cutia originală.", Category.FASHION, Listing.Condition.LIKE_NEW, 38000, "RON", "Cluj-Napoca", "sneakers", null, true, 3, Map.of("Mărime", "42"), false),
                new L(elena, "Geacă din piele naturală, mărimea M", "Geacă din piele de miel, model biker, foarte puțin purtată.", Category.FASHION, Listing.Condition.LIKE_NEW, 45000, "RON", "Brașov", "jacket", null, false, 14, Map.of("Mărime", "M"), false),
                new L(andrei, "Cărucior Cybex Priam 3 în 1", "Folosit pentru un singur copil, complet cu landou, scoică auto și sport.", Category.KIDS, Listing.Condition.GOOD, 190000, "RON", "București", "stroller", 220000L, false, 8, Map.of(), false),
                new L(demo, "Chitară acustică Yamaha F310", "Ideală pentru începători, corzi noi, cu husă și capodastru. Accept schimb.", Category.HOBBY, Listing.Condition.GOOD, 52000, "RON", "Cluj-Napoca", "guitar", null, true, 5, Map.of(), false),
                new L(maria, "Apple Watch Series 9, 45mm", "Ceas cu încărcător și două curele. Sănătatea bateriei 100%.", Category.ELECTRONICS, Listing.Condition.LIKE_NEW, 135000, "RON", "Cluj-Napoca", "watch", null, false, 2, Map.of("Dimensiune", "45 mm"), false),
                new L(andrei, "Canon EOS R50 + obiectiv 18-45mm", "Aparat foto mirrorless, sub 3.000 de cadre. Perfect pentru vlogging.", Category.ELECTRONICS, Listing.Condition.LIKE_NEW, 330000, "RON", "București", "camera", null, false, 11, Map.of("Cadre", "2.800"), false),
                new L(elena, "Trotinetă electrică Xiaomi 4 Pro", "Autonomie 55 km, pneuri noi, aripă spate schimbată. Încărcător inclus.", Category.SPORTS, Listing.Condition.GOOD, 165000, "RON", "Brașov", "scooter", null, true, 4, Map.of("Autonomie", "55 km"), false),
                new L(maria, "Set complet cărți Harry Potter (7 volume)", "Ediția Arthur, stare foarte bună, fără sublinieri.", Category.BOOKS_MUSIC, Listing.Condition.GOOD, 25000, "RON", "Cluj-Napoca", "books", null, true, 6, Map.of(), false),
                new L(elena, "Lampă de birou design, lemn și metal", "Lampă cu braț articulat, bec LED inclus.", Category.HOME_GARDEN, Listing.Condition.LIKE_NEW, 18000, "RON", "Brașov", "lamp", null, false, 9, Map.of(), false),
                new L(andrei, "AirPods Pro 2 (USB-C)", "Cumpărate acum 3 luni, garanție, vin cu toate dopurile.", Category.ELECTRONICS, Listing.Condition.LIKE_NEW, 79000, "RON", "București", "earbuds", null, false, 1, Map.of(), false));

        Map<String, UUID> ids = new HashMap<>();
        for (L d : data) {
            Listing l = new Listing();
            l.setSellerId(d.seller().getId());
            l.setTitle(d.title());
            l.setDescription(d.desc());
            l.setCategory(d.cat());
            l.setCondition(d.cond());
            l.setPriceCents(d.price());
            l.setCurrency(d.cur());
            l.setCountry("RO");
            l.setCity(d.city());
            l.setShipsTo(d.cat() == Category.VEHICLES || d.cat() == Category.REAL_ESTATE ? "" : "RO,MD,HU,BG,DE,AT,IT");
            l.setWeightGrams(switch (d.img()) { case "sofa" -> 60000; case "bike" -> 11000; case "scooter" -> 18000; case "laptop" -> 1800; default -> 900; });
            l.setAcceptsSwap(d.swap());
            l.setAcceptsOffers(true);
            Instant created = Instant.now().minus(Duration.ofDays(d.daysAgo())).minus(Duration.ofHours(Texts.randomInt(20)));
            l.setCreatedAt(created);
            l.setExpiresAt(created.plus(Listing.LIFETIME));
            if (d.promoted()) l.setPromotedUntil(Instant.now().plus(Duration.ofDays(5)));
            if (!d.attrs().isEmpty()) {
                StringBuilder sb = new StringBuilder("{");
                d.attrs().forEach((k, v) -> sb.append(sb.length() > 1 ? "," : "").append('"').append(k).append("\":\"").append(v).append('"'));
                l.setAttributes(sb.append('}').toString());
            }
            listings.saveAndFlush(l);
            ids.put(d.title(), l.getId());
            jdbc.sql("INSERT INTO listing_images(id, listing_id, owner_id, position, storage_key, content_type) VALUES (?, ?, ?, 0, ?, 'image/svg+xml')")
                    .params(UUID.randomUUID(), l.getId(), d.seller().getId(), "demo:" + d.img()).update();
            if (d.oldPrice() != null) {
                price(l.getId(), d.oldPrice(), created);
                price(l.getId(), d.price(), Instant.now().minus(Duration.ofHours(10 + Texts.randomInt(30))));
            } else {
                price(l.getId(), d.price(), created);
            }
            int views = 40 + Texts.randomInt(400);
            jdbc.sql("UPDATE listings SET view_count = ?, fav_count = ? WHERE id = ?").params(views, 2 + Texts.randomInt(40), l.getId()).update();
            for (int i = 0; i < 14; i++) {
                jdbc.sql("INSERT INTO listing_views_daily(listing_id, day, views) VALUES (?, current_date - ?, ?) ON CONFLICT DO NOTHING")
                        .params(l.getId(), i, Texts.randomInt(Math.max(2, views / 10))).update();
            }
        }

        // Favorite ale contului demo (inclusiv anunțuri cu preț scăzut).
        for (String t : List.of("iPhone 15 Pro 256GB Natural Titanium", "Tesla Model 3 Long Range 2023", "PlayStation 5 Slim + 2 controllere", "Sony WH-1000XM5 căști noise cancelling")) {
            jdbc.sql("INSERT INTO favorites(user_id, listing_id) VALUES (?, ?)").params(demo.getId(), ids.get(t)).update();
        }

        // Conversație normală: demo cumpără căștile lui Andrei.
        UUID c1 = conversation(ids.get("Sony WH-1000XM5 căști noise cancelling"), demo, andrei);
        msg(c1, demo, "Bună! Căștile mai sunt disponibile? Le pot vedea mâine în București?", 50, false, null);
        msg(c1, andrei, "Salut! Da, sunt disponibile. Ne putem vedea mâine la 18:00 la Mall Băneasa, la intrare.", 45, false, null);
        msg(c1, demo, "Perfect, ne vedem acolo. Mersi!", 40, false, null);

        // Conversație cu tentativă de țeapă: Radu îi scrie lui demo despre MacBook; mesajele sunt semnalate de filtru.
        UUID c2 = conversation(ids.get("MacBook Air M3 13\" 16GB / 512GB"), radu, demo);
        msg(c2, radu, "Salut, îl iau acum la prețul din anunț, trimit curierul azi.", 30, false, null);
        msg(c2, radu, "Am făcut plata, ca să primești banii completează datele pe [link]", 28, true, "PAYMENT_LINK");
        msg(c2, radu, "Scrie-mi pe WhatsApp că e mai rapid", 27, true, "OFF_PLATFORM_CHAT");

        // Oferte pentru anunțurile contului demo.
        jdbc.sql("INSERT INTO offers(id, listing_id, buyer_id, kind, amount_cents, message) VALUES (?, ?, ?, 'PRICE', ?, ?)")
                .params(UUID.randomUUID(), ids.get("MacBook Air M3 13\" 16GB / 512GB"), maria.getId(), 520000L, "Bună! Ați accepta 5.200 lei? Pot veni azi.").update();
        jdbc.sql("INSERT INTO offers(id, listing_id, buyer_id, kind, swap_listing_id, message) VALUES (?, ?, ?, 'SWAP', ?, ?)")
                .params(UUID.randomUUID(), ids.get("Chitară acustică Yamaha F310"), maria.getId(), ids.get("Set complet cărți Harry Potter (7 volume)"), "Schimb chitara cu setul de cărți?").update();

        notify(demo, "PRICE_DROP", "{\"title\":\"Tesla Model 3 Long Range 2023\",\"old\":3590000,\"new\":3350000,\"currency\":\"EUR\"}", "/listing/" + ids.get("Tesla Model 3 Long Range 2023"));
        notify(demo, "OFFER_RECEIVED", "{\"title\":\"MacBook Air M3 13\\\" 16GB / 512GB\",\"amount\":520000,\"currency\":\"RON\"}", "/offers");
        notify(demo, "PRICE_DROP", "{\"title\":\"iPhone 15 Pro 256GB Natural Titanium\",\"old\":479900,\"new\":429900,\"currency\":\"RON\"}", "/listing/" + ids.get("iPhone 15 Pro 256GB Natural Titanium"));

        log.info("Date demo create. Cont demo: {} / {}", DEMO_EMAIL, DEMO_PASSWORD);
    }

    private User user(String email, String username, String first, String last, boolean idVerified, boolean phone,
                      String city, int hue, User.DisplayMode mode, int ageDays) {
        User u = new User();
        u.setEmail(email);
        u.setUsername(username);
        u.setReferralCode(Texts.randomCode(8));
        u.setCountry("RO");
        u.setCity(city);
        u.setLocale("ro");
        u.setAvatarHue(hue);
        u.setDisplayMode(mode);
        if (idVerified) {
            u.setIdVerified(true);
            u.setIdVerifiedAt(Instant.now().minus(Duration.ofDays(Math.max(1, ageDays - 2))));
            u.setLegalFirstName(first);
            u.setLegalLastName(last);
        }
        u.setPhoneVerified(phone);
        if (phone) u.setPhoneLast2(String.valueOf(10 + Texts.randomInt(89)));
        u.setCreatedAt(Instant.now().minus(Duration.ofDays(ageDays)));
        return users.saveAndFlush(u);
    }

    private void rate(User u, int... ratings) {
        for (int r : ratings) { u.setRatingSum(u.getRatingSum() + r); u.setRatingCount(u.getRatingCount() + 1); }
        users.save(u);
    }

    private void price(UUID listingId, long cents, Instant at) {
        jdbc.sql("INSERT INTO price_history(id, listing_id, price_cents, changed_at) VALUES (?, ?, ?, ?)")
                .params(UUID.randomUUID(), listingId, cents, Timestamp.from(at)).update();
    }

    private UUID conversation(UUID listingId, User buyer, User seller) {
        UUID id = UUID.randomUUID();
        jdbc.sql("INSERT INTO conversations(id, listing_id, buyer_id, seller_id) VALUES (?, ?, ?, ?)")
                .params(id, listingId, buyer.getId(), seller.getId()).update();
        return id;
    }

    private void msg(UUID conv, User sender, String body, int minutesAgo, boolean flagged, String reason) {
        Instant at = Instant.now().minus(Duration.ofMinutes(minutesAgo));
        jdbc.sql("INSERT INTO messages(id, conversation_id, sender_id, body, flagged, flag_reason, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)")
                .params(UUID.randomUUID(), conv, sender.getId(), body, flagged, reason, Timestamp.from(at)).update();
        jdbc.sql("UPDATE conversations SET last_message_at = GREATEST(last_message_at, ?) WHERE id = ?").params(Timestamp.from(at), conv).update();
    }

    private void notify(User u, String type, String params, String link) {
        jdbc.sql("INSERT INTO notifications(id, user_id, type, params, link) VALUES (?, ?, ?, ?, ?)")
                .params(UUID.randomUUID(), u.getId(), type, params, link).update();
    }
}
