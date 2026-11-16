// LilieVET · procesar-reembolsos
// Devuelve en Mercado Pago las cuotas que la base marcó "reembolso_pendiente".
// Quién puede llamarla:
//  · la tarea programada (cabecera x-cron-secret), o
//  · la administradora desde el Panel, con sesión que ya pasó el doble factor (aal2).
// Cada reembolso lleva una llave de idempotencia (el id del pago): repetir la llamada no devuelve dos veces.
import { createClient } from "npm:@supabase/supabase-js@2.119.0";

// Claves del proyecto: usa las nuevas (SUPABASE_SECRET_KEYS / SUPABASE_PUBLISHABLE_KEYS) y, si no están, las heredadas
function clave(nueva: string, heredada: string): string {
  try {
    const d = JSON.parse(Deno.env.get(nueva) ?? "{}") as Record<string, unknown>;
    const v = typeof d.default === "string" ? d.default : Object.values(d).find((x) => typeof x === "string");
    if (typeof v === "string" && v) return v;
  } catch { /* se usa la heredada */ }
  return Deno.env.get(heredada) ?? "";
}
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const ANON_KEY = clave("SUPABASE_PUBLISHABLE_KEYS", "SUPABASE_ANON_KEY");
const SERVICE_KEY = clave("SUPABASE_SECRET_KEYS", "SUPABASE_SERVICE_ROLE_KEY");
const MP_TOKEN = Deno.env.get("MP_ACCESS_TOKEN") ?? "";
const CRON_SECRET = Deno.env.get("CRON_SECRET") ?? "";
const APP_URL = Deno.env.get("APP_URL") ?? "";
const ORIGEN = APP_URL ? new URL(APP_URL).origin : "";

function responder(estado: number, cuerpo: unknown): Response {
  return new Response(JSON.stringify(cuerpo), {
    status: estado,
    headers: {
      "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store",
      "Access-Control-Allow-Origin": ORIGEN, "Vary": "Origin",
      "Access-Control-Allow-Headers": "authorization, content-type, apikey, x-client-info",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
    },
  });
}
function iguales(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}
// El token ya fue validado por Supabase Auth; aquí solo se lee el nivel de la sesión
function nivel(token: string): string {
  try {
    const p = token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
    return String(JSON.parse(atob(p + "=".repeat((4 - (p.length % 4)) % 4))).aal ?? "");
  } catch { return ""; }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return responder(200, {});
  if (req.method !== "POST") return responder(405, { error: "Método no permitido." });
  if (!MP_TOKEN) return responder(503, { error: "Mercado Pago aún no está configurado." });

  try {
    const servidor = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });
    const secreto = req.headers.get("x-cron-secret") ?? "";
    let permitido = CRON_SECRET.length >= 24 && iguales(secreto, CRON_SECRET);
    if (!permitido) {
      const token = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
      if (!token) return responder(401, { error: "Inicia sesión para continuar." });
      const { data: u, error } = await createClient(SUPABASE_URL, ANON_KEY, { auth: { persistSession: false } }).auth.getUser(token);
      if (error || !u?.user) return responder(401, { error: "Tu sesión venció. Vuelve a entrar." });
      const { data: esAdmin } = await servidor.rpc("srv_es_admin", { p_cuenta: u.user.id });
      permitido = esAdmin === true && nivel(token) === "aal2";
    }
    if (!permitido) return responder(403, { error: "Solo el Panel puede hacer esto." });

    const { data: lista, error: el } = await servidor.rpc("srv_reembolsos_pendientes");
    if (el) throw el;
    let hechos = 0, fallidos = 0;
    for (const p of (lista ?? []) as { pago_id: string; mp_payment_id: string }[]) {
      if (!/^[0-9]{1,30}$/.test(p.mp_payment_id)) continue;
      let ok = false, refund = "", err = "";
      try {
        const h = { "Authorization": `Bearer ${MP_TOKEN}`, "Content-Type": "application/json" };
        const actual = await fetch(`https://api.mercadopago.com/v1/payments/${p.mp_payment_id}`, { headers: h });
        const pago = actual.ok ? await actual.json() : null;
        if (pago?.status === "refunded") {
          ok = true; refund = "ya-reembolsado";
        } else {
          const r = await fetch(`https://api.mercadopago.com/v1/payments/${p.mp_payment_id}/refunds`, {
            method: "POST", headers: { ...h, "X-Idempotency-Key": p.pago_id }, body: "{}",
          });
          if (r.ok) { ok = true; refund = String((await r.json()).id ?? ""); } else { err = `Mercado Pago respondió ${r.status}`; }
        }
      } catch (e) { err = (e as Error)?.message ?? "error"; }
      await servidor.rpc("srv_marcar_reembolso", { p_pago: p.pago_id, p_ok: ok, p_refund: refund, p_error: err });
      ok ? hechos++ : fallidos++;
    }
    return responder(200, { reembolsados: hechos, fallidos });
  } catch (e) {
    console.error("procesar-reembolsos", (e as Error)?.message);
    return responder(500, { error: "Algo salió mal. Intenta de nuevo." });
  }
});
