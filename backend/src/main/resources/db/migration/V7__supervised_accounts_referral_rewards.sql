-- Conturi 16–17 ani, supravegheate de un părinte / tutore (Codul civil art. 41: actele minorului de 14–18 ani
-- se încheie cu încuviințarea părinților). Acordul părintelui, dat cu identitatea verificată, acoperă tranzacțiile
-- din limitele contului; dovada acordului se păstrează în guardian_consents.

-- Ziua în care titularul împlinește 18 ani (doar la conturile supravegheate; după această dată limitele dispar singure).
ALTER TABLE users ADD COLUMN adult_at DATE;
ALTER TABLE users ADD COLUMN guardian_id UUID REFERENCES users(id) ON DELETE SET NULL;
-- PENDING (așteaptă acordul), APPROVED, PAUSED (oprit temporar de părinte), REVOKED, DECLINED
ALTER TABLE users ADD COLUMN guardian_status VARCHAR(16);
ALTER TABLE users ADD COLUMN guardian_approved_at TIMESTAMPTZ;
CREATE INDEX idx_users_guardian ON users(guardian_id) WHERE guardian_id IS NOT NULL;
CREATE INDEX idx_users_adult_at ON users(adult_at) WHERE adult_at IS NOT NULL;

-- Invitația trimisă pe emailul părintelui (emailul e criptat; tokenul se păstrează doar ca hash).
CREATE TABLE guardian_invites (
    id           UUID PRIMARY KEY,
    teen_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    parent_email VARCHAR(600) NOT NULL,
    token_hash   VARCHAR(64) NOT NULL UNIQUE,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    expires_at   TIMESTAMPTZ NOT NULL,
    used_at      TIMESTAMPTZ
);
CREATE INDEX idx_guardian_invites_teen ON guardian_invites(teen_id, created_at DESC);

-- Dovada: cine, când, ce a acceptat (versiunea declarației și limitele de atunci). Nu se șterge la retragere.
CREATE TABLE guardian_consents (
    id                  UUID PRIMARY KEY,
    teen_id             UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    parent_id           UUID REFERENCES users(id) ON DELETE SET NULL,
    action              VARCHAR(16) NOT NULL,
    declaration_version VARCHAR(16),
    max_eur_cents       INT,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_guardian_consents_teen ON guardian_consents(teen_id, created_at DESC);

-- Banii dintr-o vânzare făcută de un cont supravegheat ajung la părinte.
ALTER TABLE orders ADD COLUMN payout_user_id UUID REFERENCES users(id) ON DELETE SET NULL;

-- Program de invitații: recompensele câștigate (o singură dată pe prag) și creditele gratuite (promovare, ridicare).
ALTER TABLE purchased_slots ADD COLUMN source VARCHAR(16) NOT NULL DEFAULT 'PURCHASE';
CREATE TABLE referral_rewards (
    id         UUID PRIMARY KEY,
    user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    milestone  INT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (user_id, milestone)
);
CREATE TABLE user_credits (
    id         UUID PRIMARY KEY,
    user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    product    VARCHAR(24) NOT NULL,
    source     VARCHAR(24) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    expires_at TIMESTAMPTZ NOT NULL,
    used_at    TIMESTAMPTZ,
    listing_id UUID
);
CREATE INDEX idx_user_credits_user ON user_credits(user_id, product) WHERE used_at IS NULL;
-- Bonusul pentru prietenul invitat se dă o singură dată.
ALTER TABLE referrals ADD COLUMN invitee_rewarded BOOLEAN NOT NULL DEFAULT FALSE;
