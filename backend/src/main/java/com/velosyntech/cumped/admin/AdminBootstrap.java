package com.velosyntech.cumped.admin;

import com.velosyntech.cumped.common.Texts;
import com.velosyntech.cumped.config.AppProperties;
import com.velosyntech.cumped.user.User;
import com.velosyntech.cumped.user.UserRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.core.annotation.Order;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;

import java.util.Locale;

/** Creează contul de admin la pornire din ADMIN_EMAIL/ADMIN_PASSWORD (dacă sunt setate). */
@Component
@Order(1)
public class AdminBootstrap implements ApplicationRunner {
    private static final Logger log = LoggerFactory.getLogger(AdminBootstrap.class);

    private final AppProperties props;
    private final UserRepository users;
    private final PasswordEncoder encoder;

    public AdminBootstrap(AppProperties props, UserRepository users, PasswordEncoder encoder) {
        this.props = props;
        this.users = users;
        this.encoder = encoder;
    }

    @Override
    public void run(ApplicationArguments args) {
        String email = props.adminEmail();
        String password = props.adminPassword();
        if (email == null || email.isBlank() || password == null || password.isBlank()) return;
        if (password.length() < 12) {
            log.warn("ADMIN_PASSWORD trebuie să aibă minim 12 caractere; contul de admin nu a fost creat.");
            return;
        }
        String e = email.trim().toLowerCase(Locale.ROOT);
        User u = users.findByEmail(e).orElseGet(() -> {
            User n = new User();
            n.setEmail(e);
            n.setUsername("cumped_admin");
            n.setReferralCode(Texts.randomCode(8));
            n.setLocale("ro");
            n.setCountry("RO");
            return n;
        });
        u.setRole(User.Role.ADMIN);
        if (u.getPasswordHash() == null) u.setPasswordHash(encoder.encode(password));
        users.save(u);
        log.info("Cont de admin pregătit.");
    }
}
