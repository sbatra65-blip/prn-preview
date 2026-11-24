-- Fonts uploaded by a company (or a workspace key): encrypted at rest, visible only to their owner.
CREATE TABLE IF NOT EXISTS fonts (id TEXT PRIMARY KEY, owner TEXT NOT NULL, family TEXT NOT NULL, name TEXT, size INTEGER, iv TEXT NOT NULL, data TEXT NOT NULL, meta TEXT, created INTEGER);
CREATE INDEX IF NOT EXISTS fonts_owner ON fonts (owner);
