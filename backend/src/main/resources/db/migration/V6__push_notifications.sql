-- Notificări push (site: Web Push; aplicație: Firebase Cloud Messaging), preferințe și alerte de securitate.

CREATE TABLE push_subscriptions (
    id           UUID PRIMARY KEY,
    user_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    kind         VARCHAR(8)  NOT NULL,          -- WEB | FCM
    endpoint     TEXT        NOT NULL,          -- WEB: adresa serviciului push; FCM: token-ul dispozitivului
    p256dh       VARCHAR(120),
    auth_secret  VARCHAR(60),
    platform     VARCHAR(12) NOT NULL DEFAULT 'web',
    device_label VARCHAR(80),
    failures     INT         NOT NULL DEFAULT 0,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    last_used_at TIMESTAMPTZ
);
CREATE UNIQUE INDEX uq_push_endpoint ON push_subscriptions(endpoint);
CREATE INDEX idx_push_user ON push_subscriptions(user_id);

-- Ce alerte vrea utilizatorul (alertele de securitate nu se pot opri).
CREATE TABLE notification_prefs (
    user_id    UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    messages   BOOLEAN NOT NULL DEFAULT true,
    offers     BOOLEAN NOT NULL DEFAULT true,
    orders     BOOLEAN NOT NULL DEFAULT true,
    alerts     BOOLEAN NOT NULL DEFAULT true,
    account    BOOLEAN NOT NULL DEFAULT true,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Dispozitivele de pe care s-a intrat în cont: la unul nou, utilizatorul primește alertă.
CREATE TABLE login_devices (
    user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    device_hash VARCHAR(64) NOT NULL,
    label       VARCHAR(80) NOT NULL,
    first_seen  TIMESTAMPTZ NOT NULL DEFAULT now(),
    last_seen   TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, device_hash)
);

-- Chei generate de server (ex. cheile VAPID pentru Web Push), păstrate criptate.
CREATE TABLE app_keys (
    name       VARCHAR(40) PRIMARY KEY,
    value      TEXT        NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
