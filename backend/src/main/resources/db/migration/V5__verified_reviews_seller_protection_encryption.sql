-- Recenzii doar pe cumpărări verificate: legate de o comandă finalizată prin plata sigură.
ALTER TABLE reviews ADD COLUMN order_id UUID REFERENCES orders(id) ON DELETE SET NULL;
ALTER TABLE reviews DROP CONSTRAINT IF EXISTS reviews_reviewer_id_listing_id_key;
CREATE UNIQUE INDEX uq_reviews_order_reviewer ON reviews(order_id, reviewer_id) WHERE order_id IS NOT NULL;

-- Protecția vânzătorului: dovezi la expediere, dovezi la reclamație, răspunsul vânzătorului, returnare.
ALTER TABLE orders
    ADD COLUMN serial_number    VARCHAR(80),
    ADD COLUMN parcel_weight_g  INT,
    ADD COLUMN dispute_details  TEXT,
    ADD COLUMN dispute_serial   VARCHAR(80),
    ADD COLUMN disputed_at      TIMESTAMPTZ,
    ADD COLUMN seller_response  TEXT,
    ADD COLUMN responded_at     TIMESTAMPTZ,
    ADD COLUMN return_by        TIMESTAMPTZ,
    ADD COLUMN return_carrier   VARCHAR(40),
    ADD COLUMN return_tracking  VARCHAR(60),
    ADD COLUMN return_shipped_at TIMESTAMPTZ,
    ADD COLUMN resolution       VARCHAR(20),
    ADD COLUMN resolved_against VARCHAR(10);

-- Datele de livrare se criptează în aplicație (AES-256-GCM): coloanele devin TEXT ca să încapă textul criptat.
ALTER TABLE orders ALTER COLUMN ship_name TYPE TEXT, ALTER COLUMN ship_address TYPE TEXT, ALTER COLUMN ship_city TYPE TEXT,
    ALTER COLUMN ship_postcode TYPE TEXT, ALTER COLUMN ship_phone TYPE TEXT;
ALTER TABLE users ALTER COLUMN legal_first_name TYPE TEXT, ALTER COLUMN legal_last_name TYPE TEXT;

-- Pozele-dovadă (expediere / dispută) nu sunt publice: se văd doar prin link semnat, de părțile comenzii.
ALTER TABLE listing_images ADD COLUMN purpose VARCHAR(12) NOT NULL DEFAULT 'LISTING',
    ADD COLUMN order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
    ADD COLUMN evidence_role VARCHAR(16);
CREATE INDEX idx_images_order ON listing_images(order_id) WHERE order_id IS NOT NULL;
