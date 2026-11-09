-- Preserve existing slips, and bound every new upload to 500 KB.
CREATE TRIGGER orders_slip_budget BEFORE INSERT ON orders
WHEN NEW.slip_bytes > 500000
BEGIN
  SELECT RAISE(ABORT, 'Slip exceeds upload limit');
END;

CREATE INDEX orders_role_recent ON orders(role, seq DESC);
CREATE INDEX orders_package_recent ON orders(package_id, seq DESC);

-- Keep dashboard totals in a small set of groups instead of scanning all orders
-- after every review. Triggers run in the same transaction as the order change.
CREATE TABLE order_totals (
  role TEXT NOT NULL,
  status TEXT NOT NULL,
  shirt_color TEXT NOT NULL,
  shirt_size TEXT NOT NULL,
  order_count INTEGER NOT NULL CHECK (order_count >= 0),
  total_price INTEGER NOT NULL CHECK (total_price >= 0),
  PRIMARY KEY (role,status,shirt_color,shirt_size)
) WITHOUT ROWID;

INSERT INTO order_totals (role,status,shirt_color,shirt_size,order_count,total_price)
SELECT role,status,COALESCE(shirt_color,''),COALESCE(shirt_size,''),COUNT(*),SUM(price)
FROM orders GROUP BY role,status,COALESCE(shirt_color,''),COALESCE(shirt_size,'');

CREATE TRIGGER orders_totals_insert AFTER INSERT ON orders
BEGIN
  INSERT INTO order_totals (role,status,shirt_color,shirt_size,order_count,total_price)
  VALUES (NEW.role,NEW.status,COALESCE(NEW.shirt_color,''),COALESCE(NEW.shirt_size,''),1,NEW.price)
  ON CONFLICT(role,status,shirt_color,shirt_size) DO UPDATE
  SET order_count = order_count + 1, total_price = total_price + excluded.total_price;
END;

CREATE TRIGGER orders_totals_update AFTER UPDATE OF role,status,shirt_color,shirt_size,price ON orders
BEGIN
  UPDATE order_totals SET order_count = order_count - 1, total_price = total_price - OLD.price
  WHERE role = OLD.role AND status = OLD.status
    AND shirt_color = COALESCE(OLD.shirt_color,'') AND shirt_size = COALESCE(OLD.shirt_size,'');
  INSERT INTO order_totals (role,status,shirt_color,shirt_size,order_count,total_price)
  VALUES (NEW.role,NEW.status,COALESCE(NEW.shirt_color,''),COALESCE(NEW.shirt_size,''),1,NEW.price)
  ON CONFLICT(role,status,shirt_color,shirt_size) DO UPDATE
  SET order_count = order_count + 1, total_price = total_price + excluded.total_price;
END;

CREATE TRIGGER orders_totals_delete AFTER DELETE ON orders
BEGIN
  UPDATE order_totals SET order_count = order_count - 1, total_price = total_price - OLD.price
  WHERE role = OLD.role AND status = OLD.status
    AND shirt_color = COALESCE(OLD.shirt_color,'') AND shirt_size = COALESCE(OLD.shirt_size,'');
END;

PRAGMA optimize;
