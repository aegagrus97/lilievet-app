// LilieVET · crear-pago
// Crea el cobro de la cuota de servicio en Mercado Pago (Checkout Pro) y devuelve el enlace para pagar.
// Seguridad:
//  · Exige sesión: el token se valida con Supabase Auth en cada llamada.
//  · El monto, el título y a quién se cobra salen de la base (srv_preparar_pago), nunca del navegador.
//  · Las ligas de regreso salen de APP_URL (secreto del servidor), no de lo que mande el navegador.
//  · El Access Token de Mercado Pago vive solo aquí, como secreto.
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
const APP_URL = (Deno.env.get("APP_URL") ?? "").replace(/\/+$/, "") + "/";
const ORIGEN = APP_URL.length > 1 ? new URL(APP_URL).origin : "";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function responder(estado: number, cuerpo: unknown): Response {
  return new Response(JSON.stringify(cuerpo), {
    status: estado,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      "Access-Control-Allow-Origin": ORIGEN,
      "Access-Control-Allow-Headers": "authorization, content-type, apikey, x-client-info",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Vary": "Origin",
    },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return responder(200, {});
  if (req.method !== "POST") return responder(405, { error: "Método no permitido." });
  if (!MP_TOKEN || !ORIGEN) return responder(503, { error: "El cobro aún no está configurado." });

  try {
    const token = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
    if (!token) return responder(401, { error: "Inicia sesión para continuar." });
    const comoUsuario = createClient(SUPABASE_URL, ANON_KEY, { auth: { persistSession: false } });
    const { data: u, error: eu } = await comoUsuario.auth.getUser(token);
    if (eu || !u?.user) return responder(401, { error: "Tu sesión venció. Vuelve a entrar." });

    const texto = await req.text();
    if (texto.length > 500) return responder(413, { error: "Solicitud demasiado grande." });
    let cuerpo: { solicitud_id?: unknown };
    try { cuerpo = JSON.parse(texto); } catch { return responder(400, { error: "Solicitud no válida." }); }
    const solicitud = typeof cuerpo.solicitud_id === "string" ? cuerpo.solicitud_id : "";
    if (!UUID.test(solicitud)) return responder(400, { error: "Solicitud no válida." });

    const servidor = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });
    const { data: prep, error: ep } = await servidor.rpc("srv_preparar_pago", { p_solicitud: solicitud, p_tutor: u.user.id });
    if (ep) throw ep;
    if (prep?.error) return responder(409, { error: prep.error });

    const r = await fetch("https://api.mercadopago.com/checkout/preferences", {
      method: "POST",
      headers: { "Authorization": `Bearer ${MP_TOKEN}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        items: [{ id: "cuota-servicio", title: prep.titulo, quantity: 1, currency_id: "MXN", unit_price: prep.monto }],
        external_reference: prep.pago_id,
        payer: { email: prep.correo },
        notification_url: `${SUPABASE_URL}/functions/v1/mp-webhook`,
        back_urls: { success: `${APP_URL}#/consultas`, pending: `${APP_URL}#/consultas`, failure: `${APP_URL}#/consultas` },
        auto_return: "approved",
        binary_mode: true,                       // aprobado o rechazado; sin pagos "en proceso"
        statement_descriptor: "LILIEVET",
        expires: true,
        expiration_date_to: new Date(prep.vence).toISOString(),
        payment_methods: { installments: 1, excluded_payment_types: [{ id: "ticket" }, { id: "atm" }] },
      }),
    });
    if (!r.ok) {
      console.error("Mercado Pago respondió", r.status);
      return responder(502, { error: "No pudimos abrir el cobro. Intenta de nuevo en un momento." });
    }
    const pref = await r.json();
    const url = String(pref.init_point ?? "");
    const host = url ? new URL(url).hostname : "";
    if (!url.startsWith("https://") || !/(^|\.)mercadopago\.com(\.mx)?$/.test(host)) {
      return responder(502, { error: "No pudimos abrir el cobro. Intenta de nuevo en un momento." });
    }
    await servidor.rpc("srv_guardar_preferencia", { p_pago: prep.pago_id, p_preferencia: String(pref.id ?? "") });
    return responder(200, { url });
  } catch (e) {
    console.error("crear-pago", (e as Error)?.message);
    return responder(500, { error: "Algo salió mal. Intenta de nuevo." });
  }
});
