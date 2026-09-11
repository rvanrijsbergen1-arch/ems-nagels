import nodemailer from "nodemailer";

function cfg(){
  const user=Netlify.env.get("GMAIL_USER")||"";
  const pass=(Netlify.env.get("GMAIL_APP_PASSWORD")||"").replace(/\s/g,"");
  const emily=Netlify.env.get("EMILY_EMAIL")||user;
  return {user,pass,emily};
}
export function mailConfigured(){
  const {user,pass}=cfg();
  return !!(user&&pass);
}
function transporter(){
  const {user,pass}=cfg();
  if(!user||!pass) throw new Error("Gmail is nog niet ingesteld.");
  return nodemailer.createTransport({service:"gmail",auth:{user,pass}});
}
function esc(v:any){
  return String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]||c));
}
function nlDate(date:string){
  return new Date(date+"T12:00:00").toLocaleDateString("nl-NL",{weekday:"long",day:"numeric",month:"long",year:"numeric"});
}
function money(cents:number){return new Intl.NumberFormat("nl-NL",{style:"currency",currency:"EUR"}).format(cents/100)}
function shell(title:string,body:string){
  return `<div style="font-family:Arial,sans-serif;background:#f4eee7;padding:28px;color:#2c2724">
    <div style="max-width:600px;margin:auto;background:white;border-radius:20px;padding:28px;border:1px solid #ded4cc">
      <div style="font-family:Georgia,serif;font-size:28px;font-weight:700">EM’S <span style="font-family:Arial;font-size:13px;font-weight:500">nagels</span></div>
      <h2 style="font-family:Georgia,serif">${esc(title)}</h2>${body}
      <p style="font-size:12px;color:#776d67;margin-top:28px">Met aandacht, door Emily.</p>
    </div></div>`;
}
async function send(to:string,subject:string,html:string){
  const {user}=cfg();
  await transporter().sendMail({from:`Em’s Nagels <${user}>`,to,subject,html});
}
export async function sendBookingEmails(a:any,origin:string){
  if(!mailConfigured()) return false;
  const {emily}=cfg(), portal=`${origin}/mijn-afspraken.html`;
  const details=`<p>Je afspraak is ingepland.</p>
    <table style="width:100%;line-height:1.7">
      <tr><td>Behandeling</td><td><b>${esc(a.treatment_name)}</b></td></tr>
      <tr><td>Datum</td><td>${esc(nlDate(a.date))}</td></tr>
      <tr><td>Tijd</td><td>${esc(String(a.start_time).slice(0,5))}</td></tr>
      <tr><td>Prijs</td><td>${money(Number(a.price_cents))}</td></tr>
    </table>
    <p style="font-size:13px;color:#776d67">Wijzigen of annuleren kan tot 24 uur vooraf via Mijn afspraken.</p>
    <p><a href="${portal}" style="display:inline-block;background:#2d2825;color:white;padding:12px 18px;border-radius:999px;text-decoration:none;font-weight:700">Mijn afspraken</a></p>`;
  await send(a.email,"Bevestiging van je afspraak bij Em’s Nagels",shell("Afspraak bevestigd",details));
  await send(emily,`Nieuwe afspraak: ${a.customer_name}`,shell("Nieuwe afspraak",
    `<p><b>${esc(a.customer_name)}</b> heeft geboekt.</p>
     <p>${esc(a.treatment_name)}<br>${esc(nlDate(a.date))} om ${esc(String(a.start_time).slice(0,5))}<br>
     ${esc(a.email)}${a.phone?` · ${esc(a.phone)}`:""}</p>`));
  return true;
}
export async function sendLoginCode(email:string,code:string){
  if(!mailConfigured()) throw new Error("E-mail is nog niet ingesteld.");
  await send(email,"Je inlogcode voor Em’s Nagels",
    shell("Mijn afspraken",`<p>Gebruik deze code om je afspraken te bekijken:</p>
    <div style="font-size:32px;letter-spacing:.18em;font-weight:700">${esc(code)}</div>
    <p style="font-size:13px;color:#776d67">De code is 15 minuten geldig.</p>`));
}
export async function sendReminder(a:any,origin:string){
  if(!mailConfigured()) return false;
  await send(a.email,"Herinnering: morgen je afspraak bij Em’s Nagels",
    shell("Tot morgen!",`<p>Een kleine reminder voor je afspraak morgen.</p>
    <p><b>${esc(a.treatment_name)}</b><br>${esc(nlDate(a.date))} om ${esc(String(a.start_time).slice(0,5))}</p>
    <p><a href="${origin}/mijn-afspraken.html" style="color:#2d2825">Bekijk Mijn afspraken</a></p>`));
  return true;
}
export async function sendCancellationEmails(a:any){
  if(!mailConfigured()) return false;
  const {emily}=cfg();
  await send(a.email,"Annulering bevestigd · Em’s Nagels",
    shell("Afspraak geannuleerd",`<p>Je afspraak voor <b>${esc(a.treatment_name)}</b> op ${esc(nlDate(a.date))} om ${esc(String(a.start_time).slice(0,5))} is geannuleerd.</p>`));
  await send(emily,`Afspraak geannuleerd: ${a.customer_name}`,
    shell("Annulering",`<p>${esc(a.customer_name)} heeft de afspraak op ${esc(nlDate(a.date))} om ${esc(String(a.start_time).slice(0,5))} geannuleerd.</p>`));
  return true;
}
