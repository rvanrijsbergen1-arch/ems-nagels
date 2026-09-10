CREATE TABLE IF NOT EXISTS weekly_availability (
  day_index INTEGER PRIMARY KEY CHECK (day_index BETWEEN 0 AND 6),
  is_open BOOLEAN NOT NULL DEFAULT TRUE,
  start_time TIME NOT NULL DEFAULT '09:00',
  end_time TIME NOT NULL DEFAULT '18:00'
);

INSERT INTO weekly_availability (day_index, is_open, start_time, end_time) VALUES
(0, TRUE,  '09:00', '18:00'),
(1, TRUE,  '09:00', '18:00'),
(2, TRUE,  '09:00', '18:00'),
(3, TRUE,  '09:00', '18:00'),
(4, TRUE,  '09:00', '18:00'),
(5, FALSE, '09:00', '18:00'),
(6, FALSE, '09:00', '18:00')
ON CONFLICT (day_index) DO NOTHING;

CREATE TABLE IF NOT EXISTS day_overrides (
  date DATE PRIMARY KEY,
  is_open BOOLEAN NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL
);

CREATE TABLE IF NOT EXISTS appointments (
  id BIGSERIAL PRIMARY KEY,
  customer_name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT DEFAULT '',
  date DATE NOT NULL,
  start_time TIME NOT NULL,
  duration_minutes INTEGER NOT NULL CHECK (duration_minutes > 0 AND duration_minutes <= 360),
  treatment_id TEXT NOT NULL,
  treatment_name TEXT NOT NULL,
  price_cents INTEGER NOT NULL CHECK (price_cents >= 0),
  status TEXT NOT NULL DEFAULT 'Bevestigd',
  source TEXT NOT NULL DEFAULT 'Klant',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS appointments_date_idx ON appointments(date);
CREATE INDEX IF NOT EXISTS appointments_email_idx ON appointments(lower(email));
