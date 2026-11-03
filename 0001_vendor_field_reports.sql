CREATE TABLE IF NOT EXISTS vendor_field_reports (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  vendor_id TEXT NOT NULL,
  report_type TEXT NOT NULL CHECK (report_type IN ('stock_seen', 'purchased', 'stock_update')),
  plant_names TEXT NOT NULL,
  note TEXT NOT NULL DEFAULT '',
  display_name TEXT NOT NULL DEFAULT '',
  observed_on TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  submitted_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  reviewed_at TEXT
);
CREATE INDEX IF NOT EXISTS vendor_field_reports_status_submitted_idx
  ON vendor_field_reports(status, submitted_at);
CREATE INDEX IF NOT EXISTS vendor_field_reports_vendor_status_observed_idx
  ON vendor_field_reports(vendor_id, status, observed_on DESC);
