import { getDatabase } from "@netlify/database";
import crypto from "node:crypto";

export const treatments = {
  new:    { id:"new",    name:"Nieuwe set polygel",          duration:120, priceCents:7250 },
  refill: { id:"refill", name:"Nabehandeling polygel",       duration:90,  priceCents:4500 },
  gel:    { id:"gel",    name:"Gelpolish natuurlijke nagel", duration:40,  priceCents:3500 }
};

export function json(data:any, status=200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type":"application/json; charset=utf-8", "cache-control":"no-store" }
  });
}
export function db(){ return getDatabase(); }
export function hhmm(v:any){ return v ? String(v).slice(0,5) : ""; }

function signingSecret(){
  return Netlify.env.get("ADMIN_SESSION_SECRET") || Netlify.env.get("ADMIN_PASSWORD") || "";
}
function sign(payload:string){
  return crypto.createHmac("sha256", signingSecret()).update(payload).digest("base64url");
}
function parseToken(token:string){
  const [payload,sig]=String(token||"").split(".");
  if(!payload||!sig||!signingSecret()) return null;
  const expected=sign(payload);
  const a=Buffer.from(sig), b=Buffer.from(expected);
  if(a.length!==b.length || !crypto.timingSafeEqual(a,b)) return null;
  try{
    const data=JSON.parse(Buffer.from(payload,"base64url").toString());
    if(Date.now()>=Number(data.exp||0)) return null;
    return data;
  }catch{return null}
}

export function makeAdminToken(){
  const payload=Buffer.from(JSON.stringify({kind:"admin",exp:Date.now()+8*60*60*1000})).toString("base64url");
  return payload+"."+sign(payload);
}
export function isAdmin(req:Request){
  const auth=req.headers.get("authorization")||"";
  const data=parseToken(auth.startsWith("Bearer ")?auth.slice(7):"");
  return data?.kind==="admin";
}

export function makeCustomerToken(email:string){
  const payload=Buffer.from(JSON.stringify({
    kind:"customer",
    email:String(email).trim().toLowerCase(),
    exp:Date.now()+30*24*60*60*1000
  })).toString("base64url");
  return payload+"."+sign(payload);
}
export function customerEmail(req:Request){
  const auth=req.headers.get("authorization")||"";
  const data=parseToken(auth.startsWith("Bearer ")?auth.slice(7):"");
  return data?.kind==="customer" ? String(data.email||"").toLowerCase() : "";
}
export function sha256(v:string){
  return crypto.createHash("sha256").update(v).digest("hex");
}
