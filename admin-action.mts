import type { Context, Config } from "@netlify/functions";
import { db, json, isAdmin, treatments } from "./_shared.mts";

export default async (req: Request, context: Context) => {
  if (!isAdmin(req)) return json({error:"Niet ingelogd"},401);
  if (req.method !== "POST") return json({error:"Method not allowed"},405);
  const b=await req.json().catch(()=>({})), d=db();
  try {
    if (b.action==="set-week") {
      if (!(Number.isInteger(b.dayIndex)&&b.dayIndex>=0&&b.dayIndex<=6)) throw new Error("Ongeldige dag");
      await d.sql`UPDATE weekly_availability SET is_open=${!!b.o},start_time=${b.s}::time,end_time=${b.e}::time WHERE day_index=${b.dayIndex}`;
    } else if (b.action==="set-override") {
      await d.sql`INSERT INTO day_overrides(date,is_open,start_time,end_time)
        VALUES(${b.date}::date,${!!b.o},${b.s}::time,${b.e}::time)
        ON CONFLICT(date) DO UPDATE SET is_open=EXCLUDED.is_open,start_time=EXCLUDED.start_time,end_time=EXCLUDED.end_time`;
    } else if (b.action==="reset-override") {
      await d.sql`DELETE FROM day_overrides WHERE date=${b.date}::date`;
    } else if (b.action==="status") {
      await d.sql`UPDATE appointments SET status=${b.status} WHERE id=${Number(b.id)}`;
    } else if (b.action==="delete") {
      await d.sql`DELETE FROM appointments WHERE id=${Number(b.id)}`;
    } else if (b.action==="manual-book") {
      const t=treatments[b.treatmentId];
      if(!t) throw new Error("Onbekende behandeling");
      await d.sql`INSERT INTO appointments
        (customer_name,email,phone,date,start_time,duration_minutes,treatment_id,treatment_name,price_cents,status,source)
        VALUES(${String(b.name||"").trim()},${String(b.email||"").trim()},${String(b.phone||"").trim()},
        ${b.date}::date,${b.time}::time,${t.duration},${t.id},${t.name},${t.priceCents},'Bevestigd','Emily')`;
    } else throw new Error("Onbekende actie");
    return json({ok:true});
  } catch(e) { return json({error:e?.message||"Actie mislukt"},400); }
};

export const config: Config = { path:"/api/admin-action" };
