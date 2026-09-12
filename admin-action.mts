import type { Context, Config } from "@netlify/functions";
import { db, json, isAdmin, treatments } from "./_shared.mts";
import { sendBookingEmails, mailConfigured } from "./_mailer.mts";

export default async (req:Request,context:Context)=>{
  if(!isAdmin(req))return json({error:"Niet ingelogd"},401);
  if(req.method!=="POST")return json({error:"Method not allowed"},405);
  const b=await req.json().catch(()=>({})) as any,d=db();
  try{
    if(b.action==="set-week"){
      await d.sql`UPDATE weekly_availability SET is_open=${!!b.o},start_time=${b.s}::time,end_time=${b.e}::time WHERE day_index=${Number(b.dayIndex)}`;
    }else if(b.action==="set-override"){
      await d.sql`INSERT INTO day_overrides(date,is_open,start_time,end_time)
        VALUES(${b.date}::date,${!!b.o},${b.s}::time,${b.e}::time)
        ON CONFLICT(date) DO UPDATE SET is_open=EXCLUDED.is_open,start_time=EXCLUDED.start_time,end_time=EXCLUDED.end_time`;
    }else if(b.action==="reset-override"){
      await d.sql`DELETE FROM day_overrides WHERE date=${b.date}::date`;
    }else if(b.action==="save-month"){
      if(!Array.isArray(b.days)||b.days.length>31)throw new Error("Ongeldige maand.");
      const client=await d.pool.connect();
      try{
        await client.query("BEGIN");
        for(const x of b.days){
          await client.query(`INSERT INTO day_overrides(date,is_open,start_time,end_time) VALUES($1,$2,$3,$4)
            ON CONFLICT(date) DO UPDATE SET is_open=EXCLUDED.is_open,start_time=EXCLUDED.start_time,end_time=EXCLUDED.end_time`,
            [x.date,!!x.o,x.s,x.e]);
        }
        await client.query("COMMIT");
      }catch(e){await client.query("ROLLBACK");throw e}finally{client.release()}
    }else if(b.action==="reset-month"){
      const start=String(b.month)+"-01";
      const [y,m]=String(b.month).split("-").map(Number);
      const next=m===12?`${y+1}-01-01`:`${y}-${String(m+1).padStart(2,"0")}-01`;
      await d.sql`DELETE FROM day_overrides WHERE date>=${start}::date AND date<${next}::date`;
    }else if(b.action==="status"){
      await d.sql`UPDATE appointments SET status=${b.status},
        cancelled_at=CASE WHEN ${b.status}='Geannuleerd' THEN NOW() ELSE cancelled_at END
        WHERE id=${Number(b.id)}`;
    }else if(b.action==="delete"){
      await d.sql`DELETE FROM appointments WHERE id=${Number(b.id)}`;
    }else if(b.action==="manual-book"){
      const t=treatments[b.treatmentId as keyof typeof treatments];if(!t)throw new Error("Onbekende behandeling");
      const name=String(b.name||"").trim();
      const email=String(b.email||"").trim().toLowerCase();
      const phone=String(b.phone||"").trim();
      if(!name)throw new Error("Naam is verplicht.");
      const rows=await d.sql`INSERT INTO appointments(customer_name,email,phone,date,start_time,duration_minutes,treatment_id,treatment_name,price_cents,status,source)
        VALUES(${name},${email},${phone},${b.date}::date,${b.time}::time,${t.duration},${t.id},${t.name},${t.priceCents},'Bevestigd','Emily')
        RETURNING id,customer_name,email,phone,date::text,start_time::text,duration_minutes,treatment_name,price_cents`;
      const a:any=rows[0];
      let emailSent=false;
      if(email && mailConfigured()){
        try{ emailSent=await sendBookingEmails(a,new URL(req.url).origin); }
        catch(e){ console.error("Manual booking email failed",e); }
      }
      return json({ok:true,emailSent,hasEmail:!!email});
    }else throw new Error("Onbekende actie");
    return json({ok:true});
  }catch(e:any){return json({error:e?.message||"Actie mislukt"},400)}
};
export const config:Config={path:"/api/admin-action"};
