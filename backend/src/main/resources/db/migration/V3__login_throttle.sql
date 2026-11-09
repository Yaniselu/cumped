-- Limitarea încercărilor de autentificare, comună tuturor instanțelor serverului.
-- Cheia e un hash (SHA-256) al emailului sau al IP-ului: nu păstrăm adrese în clar.
CREATE TABLE login_throttle (
    k             VARCHAR(80) PRIMARY KEY,
    failures      INT         NOT NULL DEFAULT 0,
    window_start  TIMESTAMPTZ NOT NULL DEFAULT now(),
    locked_until  TIMESTAMPTZ,
    lock_count    INT         NOT NULL DEFAULT 0,
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_login_throttle_updated ON login_throttle(updated_at);
