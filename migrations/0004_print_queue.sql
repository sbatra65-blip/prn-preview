-- Phone -> PC print queue. A "print station" is a browser with QZ Tray; phones send it ready-made printer files.
CREATE TABLE IF NOT EXISTS print_stations (id TEXT PRIMARY KEY, name TEXT, seen INTEGER);
CREATE TABLE IF NOT EXISTS print_jobs (
  id TEXT PRIMARY KEY, station TEXT NOT NULL, title TEXT, prn TEXT NOT NULL, labels INTEGER,
  status TEXT NOT NULL DEFAULT 'pending', note TEXT, created INTEGER NOT NULL, done INTEGER
);
CREATE INDEX IF NOT EXISTS print_jobs_station ON print_jobs (station, status, created);
