CREATE TABLE IF NOT EXISTS vendor_reviews (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  vendor_id TEXT NOT NULL,
  rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment TEXT NOT NULL,
  display_name TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  submitted_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  reviewed_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_vendor_reviews_status_submitted ON vendor_reviews (status, submitted_at);
CREATE INDEX IF NOT EXISTS idx_vendor_reviews_vendor_status_submitted ON vendor_reviews (vendor_id, status, submitted_at);
