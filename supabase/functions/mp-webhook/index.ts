// LilieVET · mp-webhook
// Recibe los avisos de Mercado Pago. Esta función es pública (Mercado Pago no manda sesión), así que:
//  · Verifica la firma del aviso (cabecera x-signature, HMAC-SHA256 con la clave secreta del webhook).
//  · Nunca confía en lo que trae el aviso: con el id consulta el pago directamente en Mercado Pago
//    y usa SOLO esa respuesta (estado, monto, moneda y referencia).
//  · La base revisa monto y moneda, y es idempotente: un aviso repetido no cambia nada.
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
const SERVICE_KEY = clave("SUPABASE_SECRET_KEYS", "SUPABASE_SERVICE_ROLE_KEY");
const MP_TOKEN = Deno.env.get("MP_ACCESS_TOKEN") ?? "";
const MP_SECRET = Deno.env.get("MP_WEBHOOK_SECRET") ?? "";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const txt = (estado: number, t: string) => new Response(t, { status: estado, headers: { "Content-Type": "text/plain", "Cache-Control": "no-store" } });

// Comparación en tiempo constante (no revela cuántos caracteres coinciden)
function iguales(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}

async function hmacHex(clave: string, mensaje: string): Promise<string> {
  const k = await crypto.subtle.importKey("raw", new TextEncoder().encode(clave), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const f = await crypto.subtle.sign("HMAC", k, new TextEncoder().encode(mensaje));
  return [...new Uint8Array(f)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return txt(405, "no");
  if (!MP_TOKEN || !MP_SECRET) return txt(503, "sin configurar");

  try {
    const url = new URL(req.url);
    const cuerpoTxt = await req.text();
    if (cuerpoTxt.length > 10_000) return txt(413, "no");
    let cuerpo: { type?: string; data?: { id?: unknown } } = {};
    try { cuerpo = JSON.parse(cuerpoTxt || "{}"); } catch { /* se usa la URL */ }

    const idAviso = String(url.searchParams.get("data.id") ?? cuerpo?.data?.id ?? "");
    const tipo = String(url.searchParams.get("type") ?? cuerpo?.type ?? "");

    // Firma: "ts=…,v1=…" sobre "id:<data.id de la URL>;request-id:<x-request-id>;ts:<ts>;"
    const firma = req.headers.get("x-signature") ?? "";
    const reqId = req.headers.get("x-request-id") ?? "";
    const partes = Object.fromEntries(firma.split(",").map((p) => p.trim().split("=", 2) as [string, string]));
    const ts = partes["ts"] ?? "", v1 = partes["v1"] ?? "";
    if (!/^[0-9]{1,20}$/.test(ts) || !/^[0-9a-f]{64}$/.test(v1)) return txt(401, "firma");
    // Si el aviso no trae alguno de los valores, ese par se omite (así lo define Mercado Pago)
    const manifiesto = (idAviso ? `id:${idAviso.toLowerCase()};` : "") + (reqId ? `request-id:${reqId};` : "") + `ts:${ts};`;
    const esperado = await hmacHex(MP_SECRET, manifiesto);
    if (!iguales(esperado, v1)) return txt(401, "firma");

    if (tipo !== "payment") return txt(200, "ok");
    if (!/^[0-9]{1,30}$/.test(idAviso)) return txt(200, "ok");

    // Fuente de verdad: el pago consultado en Mercado Pago con nuestro token
    const r = await fetch(`https://api.mercadopago.com/v1/payments/${idAviso}`, { headers: { "Authorization": `Bearer ${MP_TOKEN}` } });
    if (r.status === 404) return txt(200, "ok");
    if (!r.ok) return txt(502, "reintentar");
    const pago = await r.json();
    const ref = String(pago.external_reference ?? "");
    if (!UUID.test(ref)) return txt(200, "ok");

    const servidor = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });
    const { data, error } = await servidor.rpc("srv_registrar_pago", {
      p_pago: ref,
      p_mp_payment: String(pago.id),
      p_estado: String(pago.status ?? ""),
      p_monto: Number(pago.transaction_amount),
      p_moneda: String(pago.currency_id ?? ""),
    });
    if (error) { console.error("srv_registrar_pago", error.message); return txt(500, "reintentar"); }
    console.log("pago", String(pago.id), data);
    return txt(200, "ok");
  } catch (e) {
    console.error("mp-webhook", (e as Error)?.message);
    return txt(500, "reintentar");
  }
});
