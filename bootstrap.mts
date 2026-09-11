import type { Context, Config } from "@netlify/functions";
import { getDatabase } from "@netlify/database";

export default async (req: Request, context: Context) => {
  const secret=Netlify.env.get("ADMIN_PASSWORD");
  const url=new URL(req.url);
  if(!secret||url.searchParams.get("key")!==secret) return new Response("Niet toegestaan",{status:401});
  const db=getDatabase();

  await db.sql`CREATE TABLE IF NOT EXISTS weekly_availability(
    day_index INTEGER PRIMARY KEY CHECK(day_index BETWEEN 0 AND 6),
    is_open BOOLEAN NOT NULL DEFAULT TRUE,
    start_time TIME NOT NULL DEFAULT '09:00',
    end_time TIME NOT NULL DEFAULT '18:00'
  )`;
  await db.sql`CREATE TABLE IF NOT EXISTS day_overrides(
    date DATE PRIMARY KEY,
    is_open BOOLEAN NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL
  )`;
  await db.sql`CREATE TABLE IF NOT EXISTS appointments(
    id BIGSERIAL PRIMARY KEY,
    customer_name TEXT NOT NULL,
    email TEXT NOT NULL,
    phone TEXT DEFAULT '',
    date DATE NOT NULL,
    start_time TIME NOT NULL,
    duration_minutes INTEGER NOT NULL,
    treatment_id TEXT NOT NULL,
    treatment_name TEXT NOT NULL,
    price_cents INTEGER NOT NULL,
    status TEXT NOT NULL DEFAULT 'Bevestigd',
    source TEXT NOT NULL DEFAULT 'Klant',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`;
  await db.sql`ALTER TABLE appointments ADD COLUMN IF NOT EXISTS reminder_sent_at TIMESTAMPTZ`;
  await db.sql`ALTER TABLE appointments ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMPTZ`;
  await db.sql`CREATE TABLE IF NOT EXISTS customer_login_codes(
    id BIGSERIAL PRIMARY KEY,
    email TEXT NOT NULL,
    code_hash TEXT NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    used_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`;
  await db.sql`CREATE INDEX IF NOT EXISTS appointments_date_idx ON appointments(date)`;
  await db.sql`CREATE INDEX IF NOT EXISTS appointments_email_idx ON appointments(lower(email))`;
  await db.sql`CREATE INDEX IF NOT EXISTS customer_login_codes_email_idx ON customer_login_codes(lower(email),created_at DESC)`;

  const rows=await db.sql`SELECT COUNT(*)::int AS count FROM weekly_availability`;
  if(Number(rows[0]?.count||0)===0){
    await db.sql`INSERT INTO weekly_availability(day_index,is_open,start_time,end_time) VALUES
      (0,TRUE,'09:00','18:00'),(1,TRUE,'09:00','18:00'),(2,TRUE,'09:00','18:00'),
      (3,TRUE,'09:00','18:00'),(4,TRUE,'09:00','18:00'),
      (5,FALSE,'09:00','18:00'),(6,FALSE,'09:00','18:00')`;
  }
  return new Response("Database V7 klaar.");
};
export const config:Config={path:"/api/bootstrap"};
