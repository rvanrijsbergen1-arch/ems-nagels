import { getDatabase } from "@netlify/database";
import crypto from "node:crypto";

export const treatments = {
  new:    { id:"new",    name:"Nieuwe set polygel",            duration:120, priceCents:7250 },
  refill: { id:"refill", name:"Nabehandeling polygel",         duration:90,  priceCents:4500 },
  gel:    { id:"gel",    name:"Gelpolish natuurlijke nagel",   duration:40,  priceCents:3500 }
};

export function json(data, status=200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type":"application/json; charset=utf-8", "cache-control":"no-store" }
  });
}

export function db() { return getDatabase(); }

function secret() {
  return Netlify.env.get("ADMIN_SESSION_SECRET") || Netlify.env.get("ADMIN_PASSWORD") || "";
}

export function makeToken() {
  const payload = Buffer.from(JSON.stringify({ exp: Date.now() + 8*60*60*1000 })).toString("base64url");
  const sig = crypto.createHmac("sha256", secret()).update(payload).digest("base64url");
  return payload + "." + sig;
}

export function isAdmin(req) {
  const s = secret();
  if (!s) return false;
  const auth = req.headers.get("authorization") || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  const [payload, sig] = token.split(".");
  if (!payload || !sig) return false;
  const expected = crypto.createHmac("sha256", s).update(payload).digest("base64url");
  const a=Buffer.from(sig), b=Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a,b)) return false;
  try {
    const data = JSON.parse(Buffer.from(payload,"base64url").toString());
    return Date.now() < data.exp;
  } catch { return false; }
}

export function hhmm(v) {
  if (!v) return "";
  return String(v).slice(0,5);
}
