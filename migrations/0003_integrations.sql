-- ERP / API connections per company; settings encrypted (AES-256-GCM, key from DESIGN_KEY)
CREATE TABLE IF NOT EXISTS integrations (id TEXT PRIMARY KEY, company_id TEXT NOT NULL, kind TEXT NOT NULL, name TEXT, pub TEXT, iv TEXT, data TEXT, updated TEXT);
CREATE INDEX IF NOT EXISTS integrations_co ON integrations(company_id);
