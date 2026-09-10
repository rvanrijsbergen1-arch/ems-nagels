import type { Context, Config } from "@netlify/functions";
import { db, json, treatments } from "./_shared.mts";

export default async (req: Request, context: Context) => {
  if (req.method !== "POST") return json({error:"Method not allowed"},405);
  const body = await req.json().catch(()=>({}));
  const treatment = treatments[body.treatmentId];
  if (!treatment) return json({error:"Onbekende behandeling"},400);
  if (!body.name || !body.email || !/^\d{4}-\d{2}-\d{2}$/.test(body.date||"") || !/^\d{2}:\d{2}$/.test(body.time||""))
    return json({error:"Niet alle gegevens zijn correct ingevuld."},400);

  const d = db();
  const client = await d.pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [body.date]);

    const day = new Date(body.date+"T12:00:00Z");
    const dayIndex = (day.getUTCDay()+6)%7;
    const cfgQ = await client.query(`
      SELECT is_open, start_time::text, end_time::text FROM day_overrides WHERE date=$1
      UNION ALL
      SELECT is_open, start_time::text, end_time::text FROM weekly_availability WHERE day_index=$2
        AND NOT EXISTS (SELECT 1 FROM day_overrides WHERE date=$1)
      LIMIT 1`, [body.date, dayIndex]);
    if (!cfgQ.rows[0]?.is_open) throw new Error("Deze dag is gesloten.");

    const toMin=s=>{const [h,m]=String(s).slice(0,5).split(":").map(Number);return h*60+m};
    const start=toMin(body.time), end=start+treatment.duration;
    const open=toMin(cfgQ.rows[0].start_time), close=toMin(cfgQ.rows[0].end_time);
    if (start<open || end>close) throw new Error("Deze tijd valt buiten de openingstijden.");

    const existing = await client.query(`
      SELECT start_time::text, duration_minutes FROM appointments
      WHERE date=$1 AND status NOT IN ('Geannuleerd','No-show')`, [body.date]);
    const overlap = existing.rows.some(a=>{
      const s=toMin(a.start_time), e=s+Number(a.duration_minutes);
      return start < e && end > s;
    });
    if (overlap) throw new Error("Dit tijdstip is zojuist geboekt. Kies een ander tijdstip.");

    const ins=await client.query(`
      INSERT INTO appointments
        (customer_name,email,phone,date,start_time,duration_minutes,treatment_id,treatment_name,price_cents,status,source)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'Bevestigd','Klant')
      RETURNING id`,
      [String(body.name).trim(),String(body.email).trim().toLowerCase(),String(body.phone||"").trim(),
       body.date,body.time,treatment.duration,treatment.id,treatment.name,treatment.priceCents]);
    await client.query("COMMIT");
    return json({ok:true,id:ins.rows[0].id});
  } catch(e) {
    await client.query("ROLLBACK");
    return json({error:e?.message||"Boeken mislukt"},409);
  } finally { client.release(); }
};

export const config: Config = { path:"/api/book" };
