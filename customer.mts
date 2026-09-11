import type { Context, Config } from "@netlify/functions";
import { db, json, sha256, makeCustomerToken, customerEmail, hhmm } from "./_shared.mts";
import { sendLoginCode, sendCancellationEmails, mailConfigured } from "./_mailer.mts";

function validEmail(v:string){return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)}
export default async (req:Request,context:Context)=>{
  const path=new URL(req.url).pathname,d=db();

  if(path==="/api/customer-login"){
    if(req.method!=="POST")return json({error:"Method not allowed"},405);
    if(!mailConfigured())return json({error:"E-mail is nog niet ingesteld."},503);
    const b=await req.json().catch(()=>({})) as any,email=String(b.email||"").trim().toLowerCase();
    if(!validEmail(email))return json({error:"Vul een geldig e-mailadres in."},400);
    const code=String(Math.floor(100000+Math.random()*900000));
    await d.sql`INSERT INTO customer_login_codes(email,code_hash,expires_at)
      VALUES(${email},${sha256(code)},NOW()+INTERVAL '15 minutes')`;
    try{await sendLoginCode(email,code)}catch(e){console.error(e);return json({error:"De inlogmail kon niet worden verstuurd."},500)}
    return json({ok:true});
  }

  if(path==="/api/customer-verify"){
    if(req.method!=="POST")return json({error:"Method not allowed"},405);
    const b=await req.json().catch(()=>({})) as any,email=String(b.email||"").trim().toLowerCase(),code=String(b.code||"").trim();
    const rows=await d.sql`SELECT id,code_hash FROM customer_login_codes
      WHERE lower(email)=${email} AND used_at IS NULL AND expires_at>NOW()
      ORDER BY created_at DESC LIMIT 1`;
    if(!rows[0]||rows[0].code_hash!==sha256(code))return json({error:"Code is onjuist of verlopen."},401);
    await d.sql`UPDATE customer_login_codes SET used_at=NOW() WHERE id=${Number(rows[0].id)}`;
    return json({token:makeCustomerToken(email)});
  }

  const email=customerEmail(req);
  if(!email)return json({error:"Niet ingelogd"},401);

  if(path==="/api/customer-data"){
    const rows=await d.sql`SELECT id,date::text AS date,start_time,duration_minutes,treatment_name,price_cents,status,
      (((date+start_time) AT TIME ZONE 'Europe/Amsterdam') >= NOW()+INTERVAL '24 hours') AS can_cancel
      FROM appointments WHERE lower(email)=${email} ORDER BY date DESC,start_time DESC`;
    return json({email,appointments:rows.map((x:any)=>({
      id:Number(x.id),date:x.date,time:hhmm(x.start_time),duration:Number(x.duration_minutes),
      treatment:x.treatment_name,price:Number(x.price_cents)/100,status:x.status,canCancel:!!x.can_cancel&&x.status==="Bevestigd"
    }))});
  }

  if(path==="/api/customer-cancel"){
    if(req.method!=="POST")return json({error:"Method not allowed"},405);
    const b=await req.json().catch(()=>({})) as any,id=Number(b.id);
    const rows=await d.sql`SELECT id,customer_name,email,phone,date::text AS date,start_time::text,treatment_name,price_cents,status,
      (((date+start_time) AT TIME ZONE 'Europe/Amsterdam') >= NOW()+INTERVAL '24 hours') AS can_cancel
      FROM appointments WHERE id=${id} AND lower(email)=${email} LIMIT 1`;
    const a:any=rows[0];
    if(!a)return json({error:"Afspraak niet gevonden."},404);
    if(a.status!=="Bevestigd")return json({error:"Deze afspraak kan niet meer worden geannuleerd."},400);
    if(!a.can_cancel)return json({error:"Online annuleren kan tot 24 uur voor de afspraak."},400);
    await d.sql`UPDATE appointments SET status='Geannuleerd',cancelled_at=NOW() WHERE id=${id}`;
    try{await sendCancellationEmails(a)}catch(e){console.error("Cancellation email failed",e)}
    return json({ok:true});
  }
  return json({error:"Not found"},404);
};
export const config:Config={path:["/api/customer-login","/api/customer-verify","/api/customer-data","/api/customer-cancel"]};
