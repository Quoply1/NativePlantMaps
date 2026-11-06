CREATE TABLE vendor_reviews_new (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  vendor_id TEXT NOT NULL,
  rating INTEGER CHECK (rating IS NULL OR rating BETWEEN 1 AND 5),
  comment TEXT NOT NULL,
  display_name TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  submitted_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  reviewed_at TEXT
);

INSERT INTO vendor_reviews_new (id, vendor_id, rating, comment, display_name, status, submitted_at, reviewed_at)
SELECT id, vendor_id, rating, comment, display_name, status, submitted_at, reviewed_at
FROM vendor_reviews;

DROP TABLE vendor_reviews;
ALTER TABLE vendor_reviews_new RENAME TO vendor_reviews;

CREATE INDEX IF NOT EXISTS idx_vendor_reviews_status_submitted
  ON vendor_reviews (status, submitted_at);
CREATE INDEX IF NOT EXISTS idx_vendor_reviews_vendor_status_submitted
  ON vendor_reviews (vendor_id, status, submitted_at);
