import type { Context, Config } from "@netlify/functions";
import { db, json, isAdmin, hhmm } from "./_shared.mts";
import { mailConfigured } from "./_mailer.mts";

export default async (req:Request,context:Context)=>{
  if(!isAdmin(req))return json({error:"Niet ingelogd"},401);
  if(req.method!=="GET")return json({error:"Method not allowed"},405);
  const d=db();
  const [weekly,overrides,appointments]=await Promise.all([
    d.sql`SELECT day_index,is_open,start_time,end_time FROM weekly_availability ORDER BY day_index`,
    d.sql`SELECT date::text AS date,is_open,start_time,end_time FROM day_overrides ORDER BY date`,
    d.sql`SELECT id,customer_name,email,phone,date::text AS date,start_time,duration_minutes,treatment_id,treatment_name,
      price_cents,status,source,created_at,reminder_sent_at,cancelled_at
      FROM appointments ORDER BY date DESC,start_time DESC`
  ]);
  return json({
    mailConfigured:mailConfigured(),
    weekly:weekly.map((x:any)=>({dayIndex:x.day_index,o:x.is_open,s:hhmm(x.start_time),e:hhmm(x.end_time)})),
    overrides:overrides.map((x:any)=>({date:x.date,o:x.is_open,s:hhmm(x.start_time),e:hhmm(x.end_time)})),
    appointments:appointments.map((x:any)=>({
      id:Number(x.id),name:x.customer_name,email:x.email,phone:x.phone,date:x.date,time:hhmm(x.start_time),
      duration:Number(x.duration_minutes),treatmentId:x.treatment_id,treatment:x.treatment_name,
      price:Number(x.price_cents)/100,status:x.status,source:x.source,createdAt:x.created_at,
      reminderSentAt:x.reminder_sent_at,cancelledAt:x.cancelled_at
    }))
  });
};
export const config:Config={path:"/api/admin-data"};
