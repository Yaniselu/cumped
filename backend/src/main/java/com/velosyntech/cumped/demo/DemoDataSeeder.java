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
        auto.setBio("Dealer auto autorizat. Mașini verificate tehnic, cu istoric complet și garanție.");
        auto.setAccountType(User.AccountType.BUSINESS);
        auto.setBusinessName("AutoCenter Timișoara SRL");
        auto.setBusinessRegNo("J35/1234/2015");
        auto.setBusinessVat("RO12345678");
        auto.setBusinessAddress("Calea Aradului 100, Timișoara, Timiș");
        auto.setBusinessEmail("vanzari@autocenter-demo.ro");
        auto.setBusinessPhone("+40 256 000 000");
        users.save(auto);
        User radu = user("radu@example.com", "radu1998", null, null, false, false, "Iași", 140, User.DisplayMode.USERNAME, 3);
        User elena = user("elena@example.com", "elena.home", "Elena", "Marin", true, false, "Brașov", 300, User.DisplayMode.REAL_NAME, 300);

        rate(andrei, 5, 5, 4, 5, 5, 5);
        rate(maria, 5, 4, 5, 5);
        rate(auto, 5, 5, 5, 4, 5, 5, 5, 5);
        rate(elena, 5, 5);

        record L(User seller, String title, String desc, Category cat, Listing.Condition cond, long price, String cur,
                 String city, List<String> imgs, Long oldPrice, boolean swap, int daysAgo, Map<String, String> attrs, boolean promoted) {}
        List<L> data = List.of(
                new L(andrei, "iPhone 15 Pro 256GB Natural Titanium", "Folosit 8 luni, mereu cu husă și folie de sticlă. Sănătatea bateriei 94%. Vine în cutia originală, cu cablul USB-C și factura de la eMAG. Fără zgârieturi pe ecran sau pe ramă.\n\nPredare personală în București (Floreasca) sau livrare prin curier cu plata sigură în aplicație.", Category.PHONES, Listing.Condition.LIKE_NEW, 429900, "RON", "București", List.of("iphone-pro-1", "iphone-pro-2"), 479900L, false, 2, attrs("brand", "Apple", "model", "iPhone 15 Pro", "storage", "256", "ram", "8", "color", "Natural Titanium", "battery_health", "94", "network_lock", "unlocked", "dual_sim", "yes", "invoice", "yes", "original_box", "yes", "warranty", "Până în martie 2026", "accessories", "Cablu USB-C, husă MagSafe"), true),
                new L(maria, "iPhone 15 Pro 128GB, ca nou", "Telefon impecabil, folosit cu grijă, mereu în husă. Garanție până în martie. Predare personală în Cluj sau curier.", Category.PHONES, Listing.Condition.LIKE_NEW, 409900, "RON", "Cluj-Napoca", List.of("iphone-hand"), null, false, 5, attrs("brand", "Apple", "model", "iPhone 15 Pro", "storage", "128", "color", "Albastru", "battery_health", "97", "network_lock", "unlocked", "invoice", "yes", "original_box", "yes"), false),
                new L(elena, "iPhone 15 Pro Max 256GB", "Stare foarte bună, mici urme fine pe ramă, ecranul fără zgârieturi. Vând pentru că am primit telefon de serviciu.", Category.PHONES, Listing.Condition.GOOD, 519900, "RON", "Brașov", List.of("iphone-pro-2", "iphone-pro-1"), null, false, 9, attrs("brand", "Apple", "model", "iPhone 15 Pro Max", "storage", "256", "battery_health", "91", "network_lock", "unlocked", "defects", "Urme fine pe ramă, vizibile doar de aproape"), false),
                new L(radu, "iPhone 15 Pro 256GB sigilat", "Telefon nou sigilat, preț mic, doar azi. Livrare prin curier.", Category.PHONES, Listing.Condition.NEW, 239900, "RON", "Iași", List.of("phone-screen"), null, false, 1, Map.of(), false),
                new L(maria, "Samsung Galaxy S24 Ultra 256GB", "Folosit 6 luni, cu S Pen și încărcător rapid de 45W. Perfect funcțional, fără probleme. Accept și schimb cu un iPhone.", Category.PHONES, Listing.Condition.GOOD, 415000, "RON", "Cluj-Napoca", List.of("samsung-1"), null, true, 4, attrs("brand", "Samsung", "model", "Galaxy S24 Ultra", "storage", "256", "ram", "12", "color", "Titanium Black", "battery_health", "95", "dual_sim", "yes", "accessories", "S Pen, încărcător 45W"), false),
                new L(demo, "MacBook Air M3 13\" 16GB / 512GB", "Cumpărat în ianuarie, 42 de cicluri de baterie. Tastatură US-RO, fără urme de folosire. Vine cu încărcătorul original și cutia.", Category.COMPUTERS, Listing.Condition.LIKE_NEW, 549900, "RON", "Cluj-Napoca", List.of("macbook-1", "macbook-2"), 589900L, false, 3, attrs("brand", "Apple", "model", "MacBook Air 13 (M3, 2024)", "device_type", "laptop", "processor", "Apple M3, 8 nuclee", "ram", "16", "storage", "512", "storage_type", "ssd", "screen_size", "13.6", "battery_cycles", "42", "os", "macOS", "invoice", "yes", "original_box", "yes", "warranty", "Garanție Apple până în ianuarie 2026"), false),
                new L(andrei, "Sony WH-1000XM4 căști noise cancelling", "Căști în stare excelentă, folosite doar acasă. Bateria ține ~30 de ore. Vin cu husa de transport și cablul. Accept schimb cu AirPods Pro.", Category.ELECTRONICS, Listing.Condition.LIKE_NEW, 89000, "RON", "București", List.of("headphones-1", "headphones-2"), null, true, 6, attrs("brand", "Sony", "model", "WH-1000XM4", "color", "Negru", "connectivity", "Bluetooth 5.0, jack 3.5 mm", "battery_life", "30 h", "original_box", "yes", "accessories", "Husă, cablu audio, cablu USB-C"), false),
                new L(elena, "PlayStation 5 + 2 controllere DualSense", "Consola merge perfect, vine cu două controllere DualSense și jocul EA FC 25. Curățată recent, fără zgomote.", Category.ELECTRONICS, Listing.Condition.GOOD, 210000, "RON", "Brașov", List.of("ps5-1", "ps5-2"), 235000L, true, 2, attrs("brand", "Sony", "model", "PlayStation 5 (disc)", "storage", "1000", "accessories", "2 controllere, cablu HDMI, joc EA FC 25", "invoice", "yes"), true),
                new L(maria, "Bicicletă cursieră carbon, mărime 56", "Grup Shimano 105, roți recent schimbate, revizie completă făcută luna trecută. Ușoară și rapidă, ideală pentru ture lungi.", Category.SPORTS, Listing.Condition.GOOD, 540000, "RON", "Cluj-Napoca", List.of("bike-1", "bike-2"), null, false, 12, attrs("brand", "Cube", "model", "Attain GTC", "frame_size", "56 cm", "material", "Carbon", "weight_kg", "8.9", "color", "Negru mat"), false),
                new L(elena, "Canapea extensibilă 3 locuri, gri deschis", "Canapea comodă, tapițerie din stofă, cu ladă de depozitare. Se ridică din Brașov, ajut la încărcare.", Category.HOME_GARDEN, Listing.Condition.GOOD, 120000, "RON", "Brașov", List.of("sofa-1", "sofa-2"), null, false, 7, attrs("brand", "IKEA", "material", "Stofă", "dimensions", "220 × 95 × 85 cm", "color", "Gri deschis", "assembly_required", "no"), false),
                new L(auto, "BMW Seria 4 Gran Coupé 420d xDrive 2020", "Mașină verificată tehnic, istoric de service complet la reprezentanță, 98.000 km reali. Garanție 12 luni. Posibilitate de leasing și buy-back.", Category.VEHICLES, Listing.Condition.GOOD, 2990000, "EUR", "Timișoara", List.of("bmw-1", "bmw-2"), null, false, 3, attrs("brand", "BMW", "model", "420d xDrive Gran Coupé", "year", "2020", "mileage_km", "98000", "fuel", "diesel", "gearbox", "automatic", "body_type", "coupe", "engine_cc", "1995", "power_hp", "190", "drive", "awd", "emission_class", "euro6", "first_owner", "yes", "service_book", "yes", "accident_free", "yes", "registered_ro", "yes", "color", "Gri Brooklyn"), true),
                new L(auto, "Tesla Model 3 Long Range 2023", "Autopilot, încărcare rapidă, garanție baterie 8 ani. Interior alb, jante 19\". Ca nouă.", Category.VEHICLES, Listing.Condition.LIKE_NEW, 3350000, "EUR", "Timișoara", List.of("tesla-1"), 3590000L, false, 1, attrs("brand", "Tesla", "model", "Model 3 Long Range", "year", "2023", "mileage_km", "21000", "fuel", "electric", "gearbox", "automatic", "body_type", "sedan", "power_hp", "498", "drive", "awd", "range_km", "602", "first_owner", "yes", "accident_free", "yes", "registered_ro", "yes", "color", "Alb perlat"), true),
                new L(andrei, "Apartament 2 camere, 54 mp, Floreasca", "Apartament renovat complet în 2023, etaj 3/8, centrală proprie, aproape de metrou și parc. Mobilat și utilat, se vinde cu tot mobilierul.", Category.REAL_ESTATE, Listing.Condition.GOOD, 15900000, "EUR", "București", List.of("apartment-1", "apartment-2"), null, false, 10, attrs("offer_type", "sale", "property_type", "apartment", "rooms", "2", "area_sqm", "54", "floor", "3", "total_floors", "8", "year_built", "2008", "heating", "own_boiler", "furnished", "yes", "partition", "detached", "balcony", "yes", "parking", "no", "energy_class", "B"), false),
                new L(maria, "Nike Air Max 1, mărimea 42", "Purtați de câteva ori, curați, în cutia originală. Fără urme pe talpă.", Category.FASHION, Listing.Condition.LIKE_NEW, 38000, "RON", "Cluj-Napoca", List.of("nike-1"), null, true, 3, attrs("brand", "Nike", "model", "Air Max 1", "size", "42", "gender", "unisex", "color", "Alb / portocaliu", "original_box", "yes"), false),
                new L(elena, "Geacă din piele naturală, mărimea M", "Geacă din piele de miel, model biker, foarte puțin purtată. Căptușeală intactă.", Category.FASHION, Listing.Condition.LIKE_NEW, 45000, "RON", "Brașov", List.of("jacket-1"), null, false, 14, attrs("size", "M", "gender", "women", "material", "Piele naturală de miel", "color", "Negru"), false),
                new L(andrei, "Adidași Puma, mărimea 38", "Adidași damă, purtați de două ori. Comozi, perfecți pentru alergare ușoară.", Category.FASHION, Listing.Condition.LIKE_NEW, 24000, "RON", "București", List.of("puma-1"), 29000L, false, 8, attrs("brand", "Puma", "size", "38", "gender", "women", "color", "Alb / roz"), false),
                new L(demo, "Chitară acustică Yamaha F310", "Ideală pentru începători, corzi noi, cu husă și capodastru. Accept schimb.", Category.HOBBY, Listing.Condition.GOOD, 52000, "RON", "Cluj-Napoca", List.of("guitar-1"), null, true, 5, attrs("brand", "Yamaha", "model", "F310", "accessories", "Husă, capodastru, corzi de rezervă"), false),
                new L(maria, "Apple Watch Series 9, 45mm", "Ceas cu încărcător și două curele. Sănătatea bateriei 100%.", Category.ELECTRONICS, Listing.Condition.LIKE_NEW, 135000, "RON", "Cluj-Napoca", List.of("watch-1", "watch-2"), null, false, 2, attrs("brand", "Apple", "model", "Watch Series 9 GPS", "screen_size", "45 mm", "battery_health", "100", "accessories", "Încărcător, 2 curele"), false),
                new L(andrei, "Canon EOS 600D + obiectiv 18-55mm", "Aparat foto DSLR, 12.000 de cadre. Perfect pentru începători, vine cu geantă și card de 32 GB.", Category.ELECTRONICS, Listing.Condition.GOOD, 160000, "RON", "București", List.of("camera-1", "camera-2"), null, false, 11, attrs("brand", "Canon", "model", "EOS 600D", "shutter_count", "12000", "accessories", "Obiectiv 18-55 mm, geantă, card 32 GB"), false),
                new L(elena, "Parfum Chanel Coco Noir 100 ml, sigilat", "Parfum original, sigilat, primit cadou. Am bonul de la Sephora.", Category.OTHER, Listing.Condition.NEW, 65000, "RON", "Brașov", List.of("perfume-1"), null, true, 4, attrs("brand", "Chanel", "model", "Coco Noir EDP", "volume_ml", "100", "invoice", "yes"), false),
                new L(maria, "Set 10 cărți business și dezvoltare personală", "Zero to One, The Lean Startup și alte 8 titluri, în engleză. Stare foarte bună, fără sublinieri.", Category.BOOKS_MUSIC, Listing.Condition.GOOD, 25000, "RON", "Cluj-Napoca", List.of("books-1"), null, true, 6, attrs("language", "Engleză", "format", "Paperback"), false),
                new L(elena, "Lampă de birou cu braț articulat", "Lampă metalică, gri, bec LED inclus. Se poate prinde și pe perete.", Category.HOME_GARDEN, Listing.Condition.LIKE_NEW, 18000, "RON", "Brașov", List.of("lamp-1"), null, false, 9, attrs("material", "Metal", "color", "Gri"), false),
                new L(andrei, "AirPods Pro 2 (USB-C)", "Cumpărate acum 3 luni, în garanție, vin cu toate dopurile de rezervă și cutia.", Category.ELECTRONICS, Listing.Condition.LIKE_NEW, 79000, "RON", "București", List.of("airpods-1", "airpods-2"), null, false, 1, attrs("brand", "Apple", "model", "AirPods Pro 2 (USB-C)", "invoice", "yes", "original_box", "yes", "warranty", "Până în august 2026"), false));

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
            l.setWeightGrams(switch (d.cat()) { case HOME_GARDEN -> 30000; case SPORTS -> 11000; case COMPUTERS -> 1800; default -> 900; });
            l.setAcceptsSwap(d.swap());
            l.setAcceptsOffers(true);
            Instant created = Instant.now().minus(Duration.ofDays(d.daysAgo())).minus(Duration.ofHours(Texts.randomInt(20)));
            l.setCreatedAt(created);
            l.setExpiresAt(created.plus(Listing.LIFETIME));
            if (d.promoted()) l.setPromotedUntil(Instant.now().plus(Duration.ofDays(5)));
            if (!d.attrs().isEmpty()) {
                StringBuilder sb = new StringBuilder("{");
                d.attrs().forEach((k, v) -> sb.append(sb.length() > 1 ? "," : "").append('"').append(k).append("\":\"").append(v.replace("\"", "\\\"")).append('"'));
                l.setAttributes(sb.append('}').toString());
            }
            if (d.cat() == Category.VEHICLES || d.cat() == Category.REAL_ESTATE) l.setMinPriceCents(Math.round(d.price() * 0.92));
            listings.saveAndFlush(l);
            ids.put(d.title(), l.getId());
            for (int pos = 0; pos < d.imgs().size(); pos++) {
                jdbc.sql("INSERT INTO listing_images(id, listing_id, owner_id, position, storage_key, content_type) VALUES (?, ?, ?, ?, ?, 'image/jpeg')")
                        .params(UUID.randomUUID(), l.getId(), d.seller().getId(), pos, "demo:photos/" + d.imgs().get(pos) + ".jpg").update();
            }
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
        for (String t : List.of("iPhone 15 Pro 256GB Natural Titanium", "Tesla Model 3 Long Range 2023", "PlayStation 5 + 2 controllere DualSense", "Sony WH-1000XM4 căști noise cancelling")) {
            jdbc.sql("INSERT INTO favorites(user_id, listing_id) VALUES (?, ?)").params(demo.getId(), ids.get(t)).update();
        }

        // Conversație normală: demo cumpără căștile lui Andrei.
        UUID c1 = conversation(ids.get("Sony WH-1000XM4 căști noise cancelling"), demo, andrei);
        msg(c1, demo, "Bună! Căștile mai sunt disponibile? Le pot vedea mâine în București?", 50, false, null);
        msg(c1, andrei, "Salut! Da, sunt disponibile. Ne putem vedea mâine la 18:00 la Mall Băneasa, la intrare.", 45, false, null);
        msg(c1, demo, "Perfect, ne vedem acolo. Mersi!", 40, false, null);

        // Conversație cu tentativă de țeapă: Radu îi scrie lui demo despre MacBook; mesajele sunt semnalate de filtru.
        UUID c2 = conversation(ids.get("MacBook Air M3 13\" 16GB / 512GB"), radu, demo);
        msg(c2, radu, "Salut, îl iau acum la prețul din anunț, trimit curierul azi.", 30, false, null);
        msg(c2, radu, "Am făcut plata, ca să primești banii completează datele pe [link]", 28, true, "PAYMENT_LINK");
        msg(c2, radu, "Scrie-mi pe WhatsApp că e mai rapid", 27, true, "OFF_PLATFORM_CHAT");

        // Oferte pentru anunțurile contului demo.
        UUID o1 = UUID.randomUUID();
        jdbc.sql("INSERT INTO offers(id, thread_id, listing_id, buyer_id, kind, amount_cents, message, proposer, round) VALUES (?, ?, ?, ?, 'PRICE', ?, ?, 'BUYER', 1)")
                .params(o1, o1, ids.get("MacBook Air M3 13\" 16GB / 512GB"), maria.getId(), 520000L, "Bună! Ați accepta 5.200 lei? Pot veni azi.").update();
        UUID o2 = UUID.randomUUID();
        jdbc.sql("INSERT INTO offers(id, thread_id, listing_id, buyer_id, kind, swap_listing_id, message, proposer, round) VALUES (?, ?, ?, ?, 'SWAP', ?, ?, 'BUYER', 1)")
                .params(o2, o2, ids.get("Chitară acustică Yamaha F310"), maria.getId(), ids.get("Set 10 cărți business și dezvoltare personală"), "Schimb chitara cu setul de cărți?").update();
        // Negociere în desfășurare: demo a oferit pentru căștile lui Andrei, Andrei a făcut contraofertă.
        UUID o3 = UUID.randomUUID(), o4 = UUID.randomUUID();
        jdbc.sql("INSERT INTO offers(id, thread_id, listing_id, buyer_id, kind, amount_cents, message, proposer, round, status) VALUES (?, ?, ?, ?, 'PRICE', 75000, 'Ați lăsa la 750 lei?', 'BUYER', 1, 'COUNTERED')")
                .params(o3, o3, ids.get("Sony WH-1000XM4 căști noise cancelling"), demo.getId()).update();
        jdbc.sql("INSERT INTO offers(id, thread_id, parent_id, listing_id, buyer_id, kind, amount_cents, message, proposer, round) VALUES (?, ?, ?, ?, ?, 'PRICE', 83000, 'Pot să las la 830, sunt aproape noi.', 'SELLER', 2)")
                .params(o4, o3, o3, ids.get("Sony WH-1000XM4 căști noise cancelling"), demo.getId()).update();

        notify(demo, "PRICE_DROP", "{\"title\":\"Tesla Model 3 Long Range 2023\",\"old\":3590000,\"new\":3350000,\"currency\":\"EUR\"}", "/listing/" + ids.get("Tesla Model 3 Long Range 2023"));
        notify(demo, "OFFER_RECEIVED", "{\"title\":\"MacBook Air M3 13\\\" 16GB / 512GB\",\"amount\":520000,\"currency\":\"RON\"}", "/offers");
        notify(demo, "PRICE_DROP", "{\"title\":\"iPhone 15 Pro 256GB Natural Titanium\",\"old\":479900,\"new\":429900,\"currency\":\"RON\"}", "/listing/" + ids.get("iPhone 15 Pro 256GB Natural Titanium"));

        log.info("Date demo create. Cont demo: {} / {}", DEMO_EMAIL, DEMO_PASSWORD);
    }

    /** Map ordonat din perechi cheie/valoare. */
    private static Map<String, String> attrs(String... kv) {
        Map<String, String> m = new LinkedHashMap<>();
        for (int i = 0; i + 1 < kv.length; i += 2) m.put(kv[i], kv[i + 1]);
        return m;
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
        u.acceptTerms(com.velosyntech.cumped.auth.AuthService.TERMS_VERSION);
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
