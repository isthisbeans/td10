-- Buyer snapshots are created with a submitted order, never on sign-in.
CREATE TABLE orders (
  seq INTEGER PRIMARY KEY AUTOINCREMENT,
  id TEXT NOT NULL UNIQUE,
  buyer_sub TEXT NOT NULL,
  buyer_email TEXT NOT NULL,
  fullname TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('student-current', 'alumni')),
  phone TEXT NOT NULL DEFAULT '',
  address TEXT NOT NULL DEFAULT '',
  batch TEXT NOT NULL DEFAULT '',
  package_id TEXT NOT NULL,
  package_name TEXT NOT NULL,
  price INTEGER NOT NULL CHECK (price > 0),
  shirt_color TEXT,
  shirt_size TEXT CHECK (shirt_size IS NULL OR shirt_size IN ('S','M','L','XL','2XL')),
  slip_key TEXT NOT NULL UNIQUE,
  slip_sha256 TEXT NOT NULL UNIQUE,
  slip_bytes INTEGER NOT NULL CHECK (slip_bytes > 0 AND slip_bytes <= 3145728),
  request_id TEXT NOT NULL,
  fingerprint TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  reject_reason TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  reviewed_at TEXT,
  version INTEGER NOT NULL DEFAULT 0,
  UNIQUE (buyer_sub, request_id),
  CHECK ((role = 'student-current' AND package_id IN ('1','2','3')) OR
         (role = 'alumni' AND package_id IN ('4','5')))
);
CREATE INDEX orders_buyer_recent ON orders(buyer_sub, seq DESC);
CREATE INDEX orders_status_recent ON orders(status, seq DESC);

CREATE TABLE order_reviews (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id TEXT NOT NULL REFERENCES orders(id) ON DELETE RESTRICT,
  reviewer_sub TEXT NOT NULL,
  reviewer_email TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('approved','rejected')),
  reason TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL
);
CREATE INDEX reviews_by_order ON order_reviews(order_id, id);
