import type { Context, Config } from "@netlify/functions";
import { db, json, hhmm } from "./_shared.mts";

export default async (req: Request, context: Context) => {
  if (req.method !== "GET") return json({error:"Method not allowed"},405);
  const url = new URL(req.url);
  const month = url.searchParams.get("month") || "";
  if (!/^\d{4}-\d{2}$/.test(month)) return json({error:"Ongeldige maand"},400);
  const start = month + "-01";
  const [y,m] = month.split("-").map(Number);
  const next = m===12 ? `${y+1}-01-01` : `${y}-${String(m+1).padStart(2,"0")}-01`;
  const d = db();
  const weekly = await d.sql`SELECT day_index, is_open, start_time, end_time FROM weekly_availability ORDER BY day_index`;
  const overrides = await d.sql`
    SELECT date::text AS date, is_open, start_time, end_time
    FROM day_overrides WHERE date >= ${start}::date AND date < ${next}::date ORDER BY date`;
  const bookings = await d.sql`
    SELECT date::text AS date, start_time, duration_minutes
    FROM appointments
    WHERE date >= ${start}::date AND date < ${next}::date
      AND status NOT IN ('Geannuleerd','No-show')
    ORDER BY date, start_time`;
  return json({
    weekly: weekly.map(x=>({dayIndex:x.day_index,o:x.is_open,s:hhmm(x.start_time),e:hhmm(x.end_time)})),
    overrides: overrides.map(x=>({date:x.date,o:x.is_open,s:hhmm(x.start_time),e:hhmm(x.end_time)})),
    bookings: bookings.map(x=>({date:x.date,time:hhmm(x.start_time),duration:Number(x.duration_minutes)}))
  });
};

export const config: Config = { path:"/api/availability" };
