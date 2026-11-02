CREATE TABLE IF NOT EXISTS community_submissions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  region TEXT NOT NULL,
  area TEXT NOT NULL,
  state TEXT NOT NULL,
  address TEXT NOT NULL,
  website TEXT NOT NULL,
  evidence_url TEXT NOT NULL,
  native_description TEXT NOT NULL,
  access TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'pending',
  submitted_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  reviewed_at TEXT
);
CREATE INDEX IF NOT EXISTS community_submissions_status_submitted_idx ON community_submissions(status, submitted_at);
