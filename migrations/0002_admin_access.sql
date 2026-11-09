-- Ownership is pinned to a verified Google subject on the configured owner's first sign-in.
CREATE TABLE admin_owner (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  google_sub TEXT NOT NULL UNIQUE,
  email TEXT NOT NULL,
  created_at TEXT NOT NULL
);

-- Only the owner may add/remove entries. New entries bind to their verified
-- Google subject at first sign-in; the browser cannot supply this identity.
CREATE TABLE admins (
  email TEXT PRIMARY KEY COLLATE NOCASE,
  google_sub TEXT UNIQUE,
  added_by TEXT NOT NULL,
  created_at TEXT NOT NULL,
  activated_at TEXT
);
