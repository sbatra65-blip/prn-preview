-- LabelDesk accounts, companies, licences (run once on pic2label-leads)
CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, email TEXT UNIQUE NOT NULL, name TEXT, pw TEXT NOT NULL, salt TEXT NOT NULL,
  totp TEXT, totp_on INTEGER DEFAULT 0, last_step INTEGER DEFAULT 0, backup TEXT, fails INTEGER DEFAULT 0, locked_until INTEGER DEFAULT 0,
  last_company TEXT, created TEXT DEFAULT (datetime('now')), last_login TEXT);
CREATE TABLE IF NOT EXISTS companies (id TEXT PRIMARY KEY, code TEXT UNIQUE NOT NULL, name TEXT NOT NULL, gstin TEXT,
  plan TEXT DEFAULT 'free', valid_until TEXT, trial INTEGER DEFAULT 0, users_max INTEGER, printers_max INTEGER,
  created_by TEXT, created TEXT DEFAULT (datetime('now')));
CREATE TABLE IF NOT EXISTS members (company_id TEXT NOT NULL, user_id TEXT NOT NULL, role TEXT NOT NULL, created TEXT DEFAULT (datetime('now')), PRIMARY KEY (company_id, user_id));
CREATE INDEX IF NOT EXISTS members_user ON members(user_id);
CREATE TABLE IF NOT EXISTS sessions (id TEXT PRIMARY KEY, user_id TEXT NOT NULL, stage TEXT NOT NULL, company_id TEXT, created INTEGER, expires INTEGER, ip TEXT, ua TEXT);
CREATE INDEX IF NOT EXISTS sessions_user ON sessions(user_id);
CREATE TABLE IF NOT EXISTS invites (id TEXT PRIMARY KEY, company_id TEXT NOT NULL, role TEXT NOT NULL, email TEXT, created INTEGER, expires INTEGER, used INTEGER DEFAULT 0, created_by TEXT);
CREATE TABLE IF NOT EXISTS licences (id TEXT PRIMARY KEY, hint TEXT, plan TEXT NOT NULL, months INTEGER NOT NULL, users_max INTEGER, printers_max INTEGER, note TEXT,
  created TEXT DEFAULT (datetime('now')), company_id TEXT, redeemed_at TEXT, redeemed_by TEXT);
CREATE TABLE IF NOT EXISTS audit (id INTEGER PRIMARY KEY AUTOINCREMENT, company_id TEXT, user_id TEXT, action TEXT, detail TEXT, ip TEXT, at TEXT DEFAULT (datetime('now')));
CREATE INDEX IF NOT EXISTS audit_co ON audit(company_id, id);
CREATE TABLE IF NOT EXISTS ai_usage (company_id TEXT NOT NULL, period TEXT NOT NULL, n INTEGER DEFAULT 0, PRIMARY KEY (company_id, period));
