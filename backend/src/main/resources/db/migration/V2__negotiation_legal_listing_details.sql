-- Negociere: ofertele devin fire de negociere între cumpărător și vânzător
ALTER TABLE offers ADD COLUMN proposer   VARCHAR(8)  NOT NULL DEFAULT 'BUYER';
ALTER TABLE offers ADD COLUMN parent_id  UUID REFERENCES offers(id) ON DELETE SET NULL;
ALTER TABLE offers ADD COLUMN round      INT         NOT NULL DEFAULT 1;
ALTER TABLE offers ADD COLUMN expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '48 hours');
ALTER TABLE offers ADD COLUMN thread_id  UUID;
UPDATE offers SET thread_id = id WHERE thread_id IS NULL;
ALTER TABLE offers ALTER COLUMN thread_id SET NOT NULL;
CREATE INDEX idx_offers_thread ON offers(thread_id, created_at);

-- Detalii suplimentare pentru anunțuri
ALTER TABLE listings ADD COLUMN negotiable       BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE listings ADD COLUMN min_price_cents  BIGINT CHECK (min_price_cents IS NULL OR min_price_cents >= 0);
ALTER TABLE listings ADD COLUMN quantity         INT     NOT NULL DEFAULT 1 CHECK (quantity BETWEEN 1 AND 999);
ALTER TABLE listings ADD COLUMN moderation_reason VARCHAR(40);
ALTER TABLE listings ALTER COLUMN attributes TYPE VARCHAR(8000);
ALTER TABLE listings DROP COLUMN search_vector;
ALTER TABLE listings ADD COLUMN search_vector TSVECTOR GENERATED ALWAYS AS (
    setweight(to_tsvector('simple', coalesce(title, '')), 'A') ||
    setweight(to_tsvector('simple', coalesce(attributes, '')), 'B') ||
    setweight(to_tsvector('simple', coalesce(description, '')), 'C')
) STORED;
CREATE INDEX idx_listings_search ON listings USING GIN(search_vector);

-- Vânzători profesioniști (DSA art. 30 / Directiva Omnibus) și acordul legal
ALTER TABLE users ADD COLUMN account_type      VARCHAR(10)  NOT NULL DEFAULT 'PRIVATE';
ALTER TABLE users ADD COLUMN business_name     VARCHAR(120);
ALTER TABLE users ADD COLUMN business_reg_no   VARCHAR(40);
ALTER TABLE users ADD COLUMN business_vat      VARCHAR(30);
ALTER TABLE users ADD COLUMN business_address  VARCHAR(250);
ALTER TABLE users ADD COLUMN business_email    VARCHAR(254);
ALTER TABLE users ADD COLUMN business_phone    VARCHAR(30);
ALTER TABLE users ADD COLUMN terms_version     VARCHAR(16);
ALTER TABLE users ADD COLUMN terms_accepted_at TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN adult_confirmed   BOOLEAN NOT NULL DEFAULT FALSE;

-- Blocarea utilizatorilor (cerință App Store pentru conținut generat de utilizatori)
CREATE TABLE user_blocks (
    blocker_id  UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    blocked_id  UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (blocker_id, blocked_id)
);
CREATE INDEX idx_blocks_blocked ON user_blocks(blocked_id);

-- Raportări (notificare și acțiune, DSA art. 16) și contestații (DSA art. 20)
ALTER TABLE support_tickets ADD COLUMN target_type VARCHAR(12);
ALTER TABLE support_tickets ADD COLUMN target_id   UUID;
ALTER TABLE support_tickets ADD COLUMN reason      VARCHAR(30);
