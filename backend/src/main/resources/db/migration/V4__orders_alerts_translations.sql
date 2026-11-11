-- Plata sigură (Protecția Cumped): banii sunt ținuți până când cumpărătorul confirmă primirea.
CREATE TABLE orders (
    id              UUID PRIMARY KEY,
    code            VARCHAR(16)  NOT NULL UNIQUE,
    listing_id      UUID         NOT NULL REFERENCES listings(id),
    buyer_id        UUID         NOT NULL REFERENCES users(id),
    seller_id       UUID         NOT NULL REFERENCES users(id),
    offer_id        UUID         REFERENCES offers(id),
    item_cents      BIGINT       NOT NULL,
    shipping_cents  BIGINT       NOT NULL DEFAULT 0,
    fee_cents       BIGINT       NOT NULL,
    total_cents     BIGINT       NOT NULL,
    currency        VARCHAR(3)   NOT NULL,
    delivery        VARCHAR(10)  NOT NULL,
    ship_name       VARCHAR(120),
    ship_address    VARCHAR(300),
    ship_city       VARCHAR(80),
    ship_postcode   VARCHAR(20),
    ship_country    VARCHAR(2),
    ship_phone      VARCHAR(30),
    carrier         VARCHAR(40),
    tracking_code   VARCHAR(60),
    status          VARCHAR(16)  NOT NULL,
    dispute_reason  VARCHAR(30),
    refund_reason   VARCHAR(30),
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT now(),
    paid_at         TIMESTAMPTZ,
    ship_by         TIMESTAMPTZ,
    shipped_at      TIMESTAMPTZ,
    auto_release_at TIMESTAMPTZ,
    completed_at    TIMESTAMPTZ,
    refunded_at     TIMESTAMPTZ,
    updated_at      TIMESTAMPTZ  NOT NULL DEFAULT now()
);
CREATE INDEX idx_orders_buyer ON orders(buyer_id, created_at DESC);
CREATE INDEX idx_orders_seller ON orders(seller_id, created_at DESC);
CREATE INDEX idx_orders_due ON orders(status, auto_release_at);

-- Alertă la preț țintă pe un anunț urmărit.
ALTER TABLE favorites ADD COLUMN target_price_cents BIGINT;

-- Traduceri de mesaje (făcute la cerere, păstrate ca să nu plătim de două ori).
CREATE TABLE message_translations (
    message_id  UUID        NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
    lang        VARCHAR(5)  NOT NULL,
    body        TEXT        NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (message_id, lang)
);
