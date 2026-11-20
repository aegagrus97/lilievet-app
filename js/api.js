// Capa de datos. Toda la app habla con `api`. Por dentro solo llama funciones de la base (rpc) y
// dos funciones del servidor; la app nunca lee ni escribe tablas directamente.
import { demoApi } from './demo.js';
import { soloDigitos } from './lib.js';

const cfg = window.LV_CONFIG || {};
const configurado = /^https:\/\/[a-z0-9-]+\.supabase\.co$/.test(cfg.supabaseUrl || '') && !!cfg.supabaseKey && !cfg.supabaseKey.includes('PEGA-AQUI');

function demoPedido() {
  const p = new URLSearchParams(location.search).get('demo');
  return ['tutor', 'mvz', 'mvz-nuevo', 'admin'].includes(p) ? p : null;
}

// Los mensajes de la base (código P0001) ya vienen en español y se muestran tal cual.
// Cualquier otro error se cambia por un texto genérico: nunca se enseñan detalles internos.
const MAPA = [
  [/invalid login credentials/i, 'Correo o contraseña incorrectos.'],
  [/email not confirmed/i, 'Confirma tu correo con el enlace que te enviamos y vuelve a entrar.'],
  [/already (been )?registered/i, 'Ya existe una cuenta con ese correo.'],
  [/rate limit|too many|security purposes/i, 'Demasiados intentos. Espera unos minutos e intenta de nuevo.'],
  [/password/i, 'Elige una contraseña más larga y difícil de adivinar (al menos 10 caracteres).'],
  [/database error saving new user/i, 'No pudimos crear tu cuenta. Revisa tus datos y que hayas aceptado los documentos.'],
  [/otp|token.*(expired|invalid)|invalid.*code|invalid totp/i, 'El código no es correcto o ya venció.'],
  [/sms|phone provider|unsupported phone/i, 'Por ahora no podemos enviar el código por SMS. Escríbenos por WhatsApp para verificar tu celular.'],
  [/failed to fetch|networkerror|load failed/i, 'Sin conexión. Revisa tu internet e intenta de nuevo.'],
];
export function traducir(e) {
  const m = String(e?.message || '');
  if (e?.code === 'P0001' && m) return new Error(m);
  const hit = MAPA.find(([re]) => re.test(m));
  return new Error(hit ? hit[1] : 'Algo salió mal. Intenta de nuevo.');
}

const URL_PAGO = /(^|\.)mercadopago\.com(\.mx)?$/;

function supabaseApi() {
  const sb = window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseKey, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, flowType: 'pkce' },
  });
  const ok = ({ data, error }) => { if (error) throw traducir(error); return data; };
  const rpc = async (fn, args) => ok(await sb.rpc(fn, args));
  const invocar = async (fn, body) => {
    const { data, error } = await sb.functions.invoke(fn, { body });
    if (error) {
      let msg = null;
      try { msg = (await error.context.json()).error; } catch (e) { /* sin detalle */ }
      throw new Error(typeof msg === 'string' && msg.length < 200 ? msg : 'Algo salió mal. Intenta de nuevo.');
    }
    return data;
  };

  return {
    mode: 'supabase',
    async session() { return (await sb.auth.getSession()).data.session; },
    onAuth(cb) { const { data } = sb.auth.onAuthStateChange((e, s) => cb(s, e)); return () => data.subscription.unsubscribe(); },
    async entrar(correo, password) { ok(await sb.auth.signInWithPassword({ email: correo.trim(), password })); },
    async registrar(d) {
      ok(await sb.auth.signUp({
        email: d.correo.trim(), password: d.password,
        options: {
          emailRedirectTo: location.origin + location.pathname,
          data: {
            rol: d.rol, nombre: d.nombre.trim(), apellidos: d.apellidos.trim(), telefono: soloDigitos(d.telefono),
            acepta_terminos: d.terminos ? 'true' : 'false', acepta_privacidad: d.privacidad ? 'true' : 'false',
            acepta_carta: d.carta ? 'true' : 'false',
          },
        },
      }));
    },
    async recuperar(correo) {
      ok(await sb.auth.resetPasswordForEmail(correo.trim(), { redirectTo: location.origin + location.pathname + '#/nueva-contrasena' }));
    },
    async nuevaContrasena(password) { ok(await sb.auth.updateUser({ password })); },
    async salir() { await sb.auth.signOut(); },
    async salirDeTodos() { await sb.auth.signOut({ scope: 'global' }); },

    perfil: () => rpc('mi_perfil'),
    guardarNombre: (nombre, apellidos) => rpc('guardar_nombre', { p_nombre: nombre, p_apellidos: apellidos }),
    avisos: () => rpc('mis_avisos'),

    // Celular: guardarlo (queda sin verificar hasta que el Panel lo confirme)
    guardarTelefono: (telefono) => rpc('cambiar_telefono', { p_telefono: soloDigitos(telefono) }),
    // Celular verificado con código (aún sin proveedor de SMS/WhatsApp; no se usa en la app por ahora)
    async pedirCodigo(telefono) {
      const tel = soloDigitos(telefono);
      await rpc('cambiar_telefono', { p_telefono: tel });
      ok(await sb.auth.updateUser({ phone: '+52' + tel }));
    },
    async verificarCodigo(telefono, codigo) {
      ok(await sb.auth.verifyOtp({ phone: '+52' + soloDigitos(telefono), token: soloDigitos(codigo), type: 'phone_change' }));
      return rpc('sincronizar_telefono');
    },

    // Tutor
    bloquesEnZona: (alcaldia, servicio) => rpc('bloques_en_zona', { p_alcaldia: alcaldia, p_servicio: servicio }),
    medicosEnBloque: (alcaldia, servicio, inicia) => rpc('medicos_en_bloque', { p_alcaldia: alcaldia, p_servicio: servicio, p_inicia_at: inicia }),
    crearSolicitud: (p) => rpc('crear_solicitud', { p }),
    misSolicitudes: () => rpc('mis_solicitudes'),
    cancelarSolicitud: (id) => rpc('cancelar_solicitud', { p_solicitud: id }),
    responderReagenda: (id, acepta) => rpc('responder_reagenda', { p_solicitud: id, p_acepta: acepta }),
    reportar: (id, tipo, detalle) => rpc('reportar', { p_solicitud: id, p_tipo: tipo, p_detalle: detalle }),
    responderEncuesta: (id, p) => rpc('responder_encuesta', { p_solicitud: id, p }),
    // Cobro de la cuota: el servidor crea el cobro y aquí solo se abre Mercado Pago
    async pagar(id) {
      const data = await invocar('crear-pago', { solicitud_id: id });
      const u = new URL(String(data?.url || ''), 'https://invalido.invalid');
      if (u.protocol !== 'https:' || !URL_PAGO.test(u.hostname)) throw new Error('No pudimos abrir el cobro. Intenta de nuevo.');
      location.assign(u.href);
    },

    // Médico veterinario
    guardarPerfilMvz: (p) => rpc('guardar_perfil_mvz', { p }),
    guardarHorario: (bloques) => rpc('guardar_horario', { p: bloques }),
    bloquearDia: (fecha, bloquear) => rpc('bloquear_dia', { p_fecha: fecha, p_bloquear: bloquear }),
    solicitudesMvz: () => rpc('mis_solicitudes_mvz'),
    responderSolicitud: (id, acepta) => rpc('responder_solicitud', { p_solicitud: id, p_acepta: acepta }),
    cancelarComoMvz: (id, motivo) => rpc('cancelar_como_mvz', { p_solicitud: id, p_motivo: motivo }),
    proponerReagenda: (id, inicia) => rpc('proponer_reagenda', { p_solicitud: id, p_inicia_at: inicia }),

    // Panel: doble factor (app de autenticación)
    async mfaEstado() {
      const nivel = ok(await sb.auth.mfa.getAuthenticatorAssuranceLevel());
      const f = ok(await sb.auth.mfa.listFactors());
      return { nivel: nivel.currentLevel, factor: (f.totp || []).find((x) => x.status === 'verified') || null };
    },
    async mfaInscribir() {
      const f = ok(await sb.auth.mfa.listFactors());
      for (const viejo of (f.all || []).filter((x) => x.status !== 'verified')) await sb.auth.mfa.unenroll({ factorId: viejo.id });
      const n = ok(await sb.auth.mfa.enroll({ factorType: 'totp', friendlyName: 'LilieVET ' + Date.now() }));
      return { id: n.id, qr: n.totp.qr_code, secreto: n.totp.secret };
    },
    async mfaVerificar(factorId, codigo) {
      ok(await sb.auth.mfa.challengeAndVerify({ factorId, code: soloDigitos(codigo) }));
    },
    admin: {
      resumen: () => rpc('admin_resumen'),
      medicos: () => rpc('admin_medicos'),
      decidirMvz: (id, accion, cedulaOk, identidadOk) => rpc('admin_decidir_mvz', { p_mvz: id, p_accion: accion, p_cedula_ok: !!cedulaOk, p_identidad_ok: !!identidadOk }),
      tutores: () => rpc('admin_tutores'),
      cuenta: (id, accion) => rpc('admin_cuenta', { p_cuenta: id, p_accion: accion }),
      eliminarDatos: (id) => rpc('admin_eliminar_datos', { p_cuenta: id }),
      solicitudes: () => rpc('admin_solicitudes'),
      cerrarSolicitud: (id, estado, motivo) => rpc('admin_cerrar_solicitud', { p_solicitud: id, p_estado: estado, p_motivo: motivo }),
      reportes: () => rpc('admin_reportes'),
      resolverReporte: (id, decision, version, resolucion) => rpc('admin_resolver_reporte', { p_reporte: id, p_decision: decision, p_version_medico: version, p_resolucion: resolucion }),
      pagos: () => rpc('admin_pagos'),
      procesarReembolsos: () => invocar('procesar-reembolsos', {}),
      encuestas: () => rpc('admin_encuestas'),
      demanda: () => rpc('admin_demanda'),
      bitacora: () => rpc('admin_auditoria'),
      parametros: () => rpc('admin_parametros'),
      guardarParametro: (clave, valor) => rpc('admin_guardar_parametro', { p_clave: clave, p_valor: String(valor) }),
    },
  };
}

const demo = demoPedido();
export const api = demo ? demoApi(demo) : configurado ? supabaseApi() : { mode: 'sin_config', session: async () => null, onAuth: () => () => {} };
export const esDemo = !!demo;
