// LilieVET · enviar-avisos
// Manda por correo (Resend) y, si está configurado, por WhatsApp (plantilla aprobada por Meta) los avisos pendientes.
// Solo la tarea programada puede llamarla (cabecera x-cron-secret). También revisa los plazos (srv_tick).
// Los avisos nunca llevan teléfonos ni domicilios: solo dicen que hay una novedad y remiten a la app.
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
const CRON_SECRET = Deno.env.get("CRON_SECRET") ?? "";
const APP_URL = Deno.env.get("APP_URL") ?? "";
const RESEND_KEY = Deno.env.get("RESEND_API_KEY") ?? "";
const MAIL_FROM = Deno.env.get("MAIL_FROM") ?? "";              // "LilieVET <avisos@tu-dominio.mx>"
const WA_TOKEN = Deno.env.get("WHATSAPP_TOKEN") ?? "";
const WA_PHONE_ID = Deno.env.get("WHATSAPP_PHONE_ID") ?? "";
const WA_TEMPLATE = Deno.env.get("WHATSAPP_TEMPLATE") ?? "";    // plantilla con dos variables: {{1}} = título del aviso, {{2}} = enlace

// Enlace directo según el aviso: al tutor, su consulta (y si el médico aceptó, directo al cobro);
// al médico veterinario, sus solicitudes. Los enlaces abren la app: ahí se inicia sesión y se paga en Mercado Pago.
function enlace(a: { tipo: string; solicitud_id: string | null; rol: string }): string {
  const base = APP_URL ? (APP_URL.endsWith("/") ? APP_URL : APP_URL + "/") : "";
  if (!base) return "";
  if (a.rol === "mvz") return `${base}#/solicitudes`;
  if (a.solicitud_id) return `${base}#/consultas/${a.solicitud_id}${a.tipo === "aceptada" ? "/pagar" : ""}`;
  return base;
}

function iguales(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}
const json = (estado: number, c: unknown) => new Response(JSON.stringify(c), { status: estado, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } });

Deno.serve(async (req) => {
  if (req.method !== "POST") return json(405, { error: "no" });
  if (CRON_SECRET.length < 24 || !iguales(req.headers.get("x-cron-secret") ?? "", CRON_SECRET)) return json(401, { error: "no" });

  const servidor = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });
  await servidor.rpc("srv_tick");
  const { data: lista, error } = await servidor.rpc("srv_avisos_pendientes");
  if (error) return json(500, { error: "base" });

  let correos = 0, whatsapps = 0;
  type Aviso = { id: number; correo: string; telefono: string; nombre: string; titulo: string; cuerpo: string; tipo: string; solicitud_id: string | null; rol: string; ya_whatsapp: boolean };
  for (const a of (lista ?? []) as Aviso[]) {
    let okCorreo = false, okWa = false;
    const url = enlace(a);
    const accion = a.tipo === "aceptada" ? "Paga la cuota y confirma tu consulta aquí:" : "Entra a LilieVET:";
    if (RESEND_KEY && MAIL_FROM && /^\S+@\S+\.\S+$/.test(a.correo)) {
      try {
        const r = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: { "Authorization": `Bearer ${RESEND_KEY}`, "Content-Type": "application/json", "Idempotency-Key": `lv-aviso-${a.id}` },
          // Solo texto plano: nada de lo que escribió una persona se interpreta como HTML
          body: JSON.stringify({ from: MAIL_FROM, to: [a.correo], subject: `LilieVET · ${a.titulo}`, text: `Hola, ${a.nombre}:\n\n${a.cuerpo}\n\n${url ? `${accion}\n${url}\n\n` : ""}LilieVET · Tu vet a domicilio\nNo es un servicio de urgencias.` }),
        });
        okCorreo = r.ok;
      } catch { /* se reintenta en la siguiente vuelta */ }
    }
    // El WhatsApp se manda una sola vez aunque el correo se reintente
    if (!a.ya_whatsapp && WA_TOKEN && WA_PHONE_ID && WA_TEMPLATE && /^[0-9]{10}$/.test(a.telefono)) {
      try {
        const r = await fetch(`https://graph.facebook.com/v21.0/${encodeURIComponent(WA_PHONE_ID)}/messages`, {
          method: "POST",
          headers: { "Authorization": `Bearer ${WA_TOKEN}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            messaging_product: "whatsapp", to: `52${a.telefono}`, type: "template",
            template: { name: WA_TEMPLATE, language: { code: "es_MX" }, components: [{ type: "body", parameters: [{ type: "text", text: a.titulo.slice(0, 120) }, { type: "text", text: url || "LilieVET" }] }] },
          }),
        });
        okWa = r.ok;
      } catch { /* sin WhatsApp esta vez */ }
    }
    await servidor.rpc("srv_marcar_aviso", { p_aviso: a.id, p_correo: okCorreo, p_whatsapp: okWa });
    if (okCorreo) correos++;
    if (okWa) whatsapps++;
  }
  return json(200, { correos, whatsapps });
});
