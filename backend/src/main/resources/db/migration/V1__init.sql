-- Cumped: schema inițială
CREATE TABLE users (
    id                UUID PRIMARY KEY,
    email             VARCHAR(254) NOT NULL UNIQUE,
    password_hash     VARCHAR(100),
    username          VARCHAR(24)  NOT NULL UNIQUE,
    display_mode      VARCHAR(16)  NOT NULL DEFAULT 'USERNAME',
    legal_first_name  VARCHAR(80),
    legal_last_name   VARCHAR(80),
    id_verified       BOOLEAN      NOT NULL DEFAULT FALSE,
    id_verified_at    TIMESTAMPTZ,
    phone_hash        VARCHAR(64),
    phone_last2       VARCHAR(2),
    phone_verified    BOOLEAN      NOT NULL DEFAULT FALSE,
    role              VARCHAR(16)  NOT NULL DEFAULT 'USER',
    plan              VARCHAR(16)  NOT NULL DEFAULT 'FREE',
    plan_until        TIMESTAMPTZ,
    referral_code     VARCHAR(12)  NOT NULL UNIQUE,
    referred_by       UUID REFERENCES users(id),
    country           VARCHAR(2),
    city              VARCHAR(80),
    locale            VARCHAR(8)   NOT NULL DEFAULT 'en',
    avatar_hue        INT          NOT NULL DEFAULT 260,
    bio               VARCHAR(400),
    google_sub        VARCHAR(255) UNIQUE,
    apple_sub         VARCHAR(255) UNIQUE,
    failed_logins     INT          NOT NULL DEFAULT 0,
    locked_until      TIMESTAMPTZ,
    suspended         BOOLEAN      NOT NULL DEFAULT FALSE,
    suspended_reason  VARCHAR(200),
    rating_sum        INT          NOT NULL DEFAULT 0,
    rating_count      INT          NOT NULL DEFAULT 0,
    token_version     INT          NOT NULL DEFAULT 0,
    created_at        TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE TABLE refresh_tokens (
    id          UUID PRIMARY KEY,
    user_id     UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash  VARCHAR(64) NOT NULL UNIQUE,
    family      UUID        NOT NULL,
    expires_at  TIMESTAMPTZ NOT NULL,
    revoked_at  TIMESTAMPTZ,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_refresh_family ON refresh_tokens(family);

CREATE TABLE referrals (
    invitee_id  UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    inviter_id  UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    qualified   BOOLEAN NOT NULL DEFAULT FALSE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_referrals_inviter ON referrals(inviter_id, qualified);

CREATE TABLE listings (
    id              UUID PRIMARY KEY,
    seller_id       UUID         NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title           VARCHAR(90)  NOT NULL,
    description     VARCHAR(4000) NOT NULL,
    category        VARCHAR(24)  NOT NULL,
    item_condition  VARCHAR(16)  NOT NULL,
    price_cents     BIGINT       NOT NULL CHECK (price_cents >= 0),
    currency        VARCHAR(3)   NOT NULL,
    country         VARCHAR(2)   NOT NULL,
    city            VARCHAR(80)  NOT NULL,
    ships_to        VARCHAR(400) NOT NULL DEFAULT '',
    weight_grams    INT          NOT NULL DEFAULT 1000,
    accepts_offers  BOOLEAN      NOT NULL DEFAULT TRUE,
    accepts_swap    BOOLEAN      NOT NULL DEFAULT FALSE,
    attributes      VARCHAR(2000) NOT NULL DEFAULT '',
    status          VARCHAR(16)  NOT NULL DEFAULT 'ACTIVE',
    sold_to_id      UUID REFERENCES users(id),
    promoted_until  TIMESTAMPTZ,
    bumped_at       TIMESTAMPTZ,
    view_count      INT          NOT NULL DEFAULT 0,
    fav_count       INT          NOT NULL DEFAULT 0,
    msg_count       INT          NOT NULL DEFAULT 0,
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ  NOT NULL DEFAULT now(),
    expires_at      TIMESTAMPTZ  NOT NULL,
    search_vector   TSVECTOR GENERATED ALWAYS AS (
        setweight(to_tsvector('simple', coalesce(title, '')), 'A') ||
        setweight(to_tsvector('simple', coalesce(description, '')), 'B')
    ) STORED
);
CREATE INDEX idx_listings_search ON listings USING GIN(search_vector);
CREATE INDEX idx_listings_status_created ON listings(status, created_at DESC);
CREATE INDEX idx_listings_seller ON listings(seller_id, status);
CREATE INDEX idx_listings_category ON listings(category, status);

CREATE TABLE purchased_slots (
    id          UUID PRIMARY KEY,
    user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    expires_at  TIMESTAMPTZ NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_slots_user ON purchased_slots(user_id, expires_at);

CREATE TABLE listing_images (
    id            UUID PRIMARY KEY,
    listing_id    UUID        REFERENCES listings(id) ON DELETE CASCADE,
    owner_id      UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    position      INT         NOT NULL DEFAULT 0,
    storage_key   VARCHAR(120) NOT NULL,
    content_type  VARCHAR(40) NOT NULL,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_images_listing ON listing_images(listing_id, position);

CREATE TABLE price_history (
    id          UUID PRIMARY KEY,
    listing_id  UUID        NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
    price_cents BIGINT      NOT NULL,
    changed_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_price_history ON price_history(listing_id, changed_at);

CREATE TABLE listing_views_daily (
    listing_id  UUID NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
    day         DATE NOT NULL,
    views       INT  NOT NULL DEFAULT 0,
    PRIMARY KEY (listing_id, day)
);

CREATE TABLE favorites (
    user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    listing_id  UUID NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, listing_id)
);

CREATE TABLE saved_searches (
    id                UUID PRIMARY KEY,
    user_id           UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    query             VARCHAR(80),
    category          VARCHAR(24),
    max_price_cents   BIGINT,
    country           VARCHAR(2),
    created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_saved_searches_user ON saved_searches(user_id);

CREATE TABLE conversations (
    id               UUID PRIMARY KEY,
    listing_id       UUID NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
    buyer_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    seller_id        UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    last_message_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (listing_id, buyer_id)
);
CREATE INDEX idx_conv_buyer ON conversations(buyer_id, last_message_at DESC);
CREATE INDEX idx_conv_seller ON conversations(seller_id, last_message_at DESC);

CREATE TABLE messages (
    id               UUID PRIMARY KEY,
    conversation_id  UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    sender_id        UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    body             VARCHAR(2000) NOT NULL,
    flagged          BOOLEAN NOT NULL DEFAULT FALSE,
    flag_reason      VARCHAR(40),
    read_at          TIMESTAMPTZ,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_messages_conv ON messages(conversation_id, created_at);

CREATE TABLE offers (
    id               UUID PRIMARY KEY,
    listing_id       UUID NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
    buyer_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    kind             VARCHAR(8)  NOT NULL,
    amount_cents     BIGINT,
    swap_listing_id  UUID REFERENCES listings(id) ON DELETE SET NULL,
    message          VARCHAR(400),
    status           VARCHAR(12) NOT NULL DEFAULT 'PENDING',
    created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    decided_at       TIMESTAMPTZ
);
CREATE INDEX idx_offers_listing ON offers(listing_id, status);
CREATE INDEX idx_offers_buyer ON offers(buyer_id);

CREATE TABLE reviews (
    id           UUID PRIMARY KEY,
    reviewer_id  UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    reviewee_id  UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    listing_id   UUID NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
    rating       INT  NOT NULL CHECK (rating BETWEEN 1 AND 5),
    comment      VARCHAR(600),
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (reviewer_id, listing_id)
);
CREATE INDEX idx_reviews_reviewee ON reviews(reviewee_id, created_at DESC);

CREATE TABLE notifications (
    id          UUID PRIMARY KEY,
    user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type        VARCHAR(32)  NOT NULL,
    params      VARCHAR(1000) NOT NULL DEFAULT '{}',
    link        VARCHAR(200),
    read_at     TIMESTAMPTZ,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_notifications_user ON notifications(user_id, created_at DESC);

CREATE TABLE support_tickets (
    id                    UUID PRIMARY KEY,
    code                  VARCHAR(16) NOT NULL UNIQUE,
    reporter_id           UUID REFERENCES users(id) ON DELETE SET NULL,
    category              VARCHAR(16) NOT NULL,
    priority              VARCHAR(8)  NOT NULL,
    risk_score            INT         NOT NULL DEFAULT 0,
    status                VARCHAR(16) NOT NULL DEFAULT 'OPEN',
    summary               VARCHAR(2000) NOT NULL,
    transcript            TEXT        NOT NULL,
    related_listing_id    UUID REFERENCES listings(id) ON DELETE SET NULL,
    related_user_id       UUID REFERENCES users(id) ON DELETE SET NULL,
    auto_action           VARCHAR(24),
    auto_action_state     VARCHAR(12),
    source                VARCHAR(12) NOT NULL DEFAULT 'VELO',
    created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_tickets_status ON support_tickets(status, created_at DESC);
CREATE INDEX idx_tickets_reporter ON support_tickets(reporter_id, created_at DESC);

CREATE TABLE velo_sessions (
    id          UUID PRIMARY KEY,
    user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    transcript  TEXT NOT NULL DEFAULT '',
    turns       INT  NOT NULL DEFAULT 0,
    ticket_id   UUID REFERENCES support_tickets(id) ON DELETE SET NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE mail_outbox (
    id          UUID PRIMARY KEY,
    to_addr     VARCHAR(254) NOT NULL,
    subject     VARCHAR(200) NOT NULL,
    body        TEXT NOT NULL,
    attempts    INT  NOT NULL DEFAULT 0,
    last_error  VARCHAR(300),
    sent_at     TIMESTAMPTZ,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_outbox_pending ON mail_outbox(sent_at) WHERE sent_at IS NULL;

CREATE TABLE audit_log (
    id          UUID PRIMARY KEY,
    actor_id    UUID,
    action      VARCHAR(40) NOT NULL,
    target      VARCHAR(80),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_audit_actor ON audit_log(actor_id, created_at DESC);
