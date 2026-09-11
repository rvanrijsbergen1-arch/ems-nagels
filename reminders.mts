import type { Config } from "@netlify/functions";
import { db } from "./_shared.mts";
import { sendReminder, mailConfigured } from "./_mailer.mts";

export default async (req:Request)=>{
  if(!mailConfigured())return;
  const d=db(),origin=Netlify.env.get("URL")||"https://emsnagels.netlify.app";
  const rows=await d.sql`SELECT id,customer_name,email,date::text AS date,start_time::text,treatment_name
    FROM appointments
    WHERE status='Bevestigd' AND reminder_sent_at IS NULL
      AND ((date+start_time) AT TIME ZONE 'Europe/Amsterdam') >= NOW()+INTERVAL '23 hours'
      AND ((date+start_time) AT TIME ZONE 'Europe/Amsterdam') < NOW()+INTERVAL '25 hours'
    ORDER BY date,start_time`;
  for(const a of rows as any[]){
    try{
      await sendReminder(a,origin);
      await d.sql`UPDATE appointments SET reminder_sent_at=NOW() WHERE id=${Number(a.id)}`;
    }catch(e){console.error("Reminder failed",a.id,e)}
  }
};
export const config:Config={schedule:"0 * * * *"};
