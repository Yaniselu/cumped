package com.velosyntech.cumped;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.test.context.TestPropertySource;
import tools.jackson.databind.json.JsonMapper;

import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

@IntegrationTest
@TestPropertySource(properties = "cumped.rate-limit=true")
class RateLimitIT {
    @Value("${local.server.port}") int port;
    @Autowired JsonMapper json;

    @Test
    void bruteForceOnLoginIsThrottled() {
        TestClient c = new TestClient(port, json);
        int last = 0;
        for (int i = 0; i < 12; i++) {
            last = c.post("/api/auth/login", Map.of("email", "victim@test.dev", "password", "guess-" + i + "-xyz")).status();
        }
        assertThat(last).isEqualTo(429);
    }
}
