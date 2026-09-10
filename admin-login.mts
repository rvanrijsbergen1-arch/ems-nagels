import type { Context, Config } from "@netlify/functions";
import { json, makeToken } from "./_shared.mts";

export default async (req: Request, context: Context) => {
  if (req.method !== "POST") return json({error:"Method not allowed"},405);
  const configured = Netlify.env.get("ADMIN_PASSWORD");
  if (!configured) return json({error:"ADMIN_PASSWORD is nog niet ingesteld in Netlify."},503);
  const body = await req.json().catch(()=>({}));
  if (body.username !== "admin" || body.password !== configured) return json({error:"Onjuiste inloggegevens."},401);
  return json({token:makeToken()});
};

export const config: Config = { path:"/api/admin-login" };
