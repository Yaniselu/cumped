package com.velosyntech.cumped;

import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.TestPropertySource;

import java.lang.annotation.ElementType;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;

/** Rulează aplicația completă pe un port aleator, pe baza de date de test (PostgreSQL). */
@Target(ElementType.TYPE)
@Retention(RetentionPolicy.RUNTIME)
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@TestPropertySource(properties = {
        "spring.datasource.url=${TEST_DB_URL:jdbc:postgresql://localhost:5432/cumped_test}",
        "cumped.dev-mode=true",
        "cumped.demo-data=false",
        "cumped.rate-limit=false",
        "cumped.cookie-secure=false",
        "cumped.jwt-secret=test-secret-test-secret-test-secret-123456",
        "cumped.uploads-dir=build/test-uploads",
})
public @interface IntegrationTest {}
