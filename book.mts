import type { Context, Config } from "@netlify/functions";
import { db, json, treatments } from "./_shared.mts";
import { sendBookingEmails, mailConfigured } from "./_mailer.mts";

export default async (req:Request, context:Context)=>{
  if(req.method!=="POST") return json({error:"Method not allowed"},405);
  const body=await req.json().catch(()=>({})) as any;
  const treatment=treatments[body.treatmentId as keyof typeof treatments];
  if(!treatment) return json({error:"Onbekende behandeling"},400);
  if(!body.name||!body.email||!/^\d{4}-\d{2}-\d{2}$/.test(body.date||"")||!/^\d{2}:\d{2}$/.test(body.time||""))
    return json({error:"Niet alle gegevens zijn correct ingevuld."},400);

  const d=db(),client=await d.pool.connect();
  let appointment:any=null;
  try{
    await client.query("BEGIN");
    await client.query("SELECT pg_advisory_xact_lock(hashtext($1))",[body.date]);
    const day=new Date(body.date+"T12:00:00Z"),dayIndex=(day.getUTCDay()+6)%7;
    const cfgQ=await client.query(`
      SELECT is_open,start_time::text,end_time::text FROM day_overrides WHERE date=$1
      UNION ALL
      SELECT is_open,start_time::text,end_time::text FROM weekly_availability WHERE day_index=$2
        AND NOT EXISTS(SELECT 1 FROM day_overrides WHERE date=$1)
      LIMIT 1`,[body.date,dayIndex]);
    if(!cfgQ.rows[0]?.is_open) throw new Error("Deze dag is gesloten.");
    const toMin=(s:string)=>{const [h,m]=String(s).slice(0,5).split(":").map(Number);return h*60+m};
    const start=toMin(body.time),end=start+treatment.duration,open=toMin(cfgQ.rows[0].start_time),close=toMin(cfgQ.rows[0].end_time);
    if(start<open||end>close) throw new Error("Deze tijd valt buiten de openingstijden.");
    const existing=await client.query(`SELECT start_time::text,duration_minutes FROM appointments
      WHERE date=$1 AND status NOT IN ('Geannuleerd','No-show')`,[body.date]);
    if(existing.rows.some((a:any)=>{const s=toMin(a.start_time),e=s+Number(a.duration_minutes);return start<e&&end>s}))
      throw new Error("Dit tijdstip is zojuist geboekt. Kies een ander tijdstip.");

    const ins=await client.query(`INSERT INTO appointments
      (customer_name,email,phone,date,start_time,duration_minutes,treatment_id,treatment_name,price_cents,status,source)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,'Bevestigd','Klant')
      RETURNING id,customer_name,email,phone,date::text,start_time::text,duration_minutes,treatment_name,price_cents`,
      [String(body.name).trim(),String(body.email).trim().toLowerCase(),String(body.phone||"").trim(),
       body.date,body.time,treatment.duration,treatment.id,treatment.name,treatment.priceCents]);
    appointment=ins.rows[0];
    await client.query("COMMIT");
  }catch(e:any){
    await client.query("ROLLBACK");
    return json({error:e?.message||"Boeken mislukt"},409);
  }finally{client.release()}

  let emailSent=false;
  if(mailConfigured()){
    try{emailSent=await sendBookingEmails(appointment,new URL(req.url).origin)}catch(e){console.error("Booking email failed",e)}
  }
  return json({ok:true,id:Number(appointment.id),emailSent,mailConfigured:mailConfigured()});
};
export const config:Config={path:"/api/book"};
