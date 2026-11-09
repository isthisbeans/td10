-- Snapshot school Google profile details only when a student places an order.
-- Existing orders keep NULL: today's profile cannot establish their old class.
ALTER TABLE orders ADD COLUMN student_id TEXT
  CHECK (student_id IS NULL OR (role = 'student-current' AND length(student_id) BETWEEN 4 AND 10 AND student_id NOT GLOB '*[^0-9]*'));
ALTER TABLE orders ADD COLUMN grade TEXT
  CHECK (grade IS NULL OR (role = 'student-current' AND grade IN ('1','2','3','4','5','6')));
ALTER TABLE orders ADD COLUMN room TEXT
  CHECK (room IS NULL OR (role = 'student-current' AND length(room) BETWEEN 1 AND 2 AND room NOT GLOB '*[^0-9]*' AND CAST(room AS INTEGER) BETWEEN 1 AND 99));
ALTER TABLE orders ADD COLUMN student_number TEXT
  CHECK (student_number IS NULL OR (role = 'student-current' AND length(student_number) BETWEEN 1 AND 2 AND student_number NOT GLOB '*[^0-9]*' AND CAST(student_number AS INTEGER) BETWEEN 1 AND 99));
