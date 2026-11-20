// Utilidades compartidas: htm (JSX sin compilar), componentes del sistema de diseño, íconos y fechas.
export const React = window.React;
export const html = window.htm.bind(React.createElement);
export const DS = window.LilieVET;
export const { useState, useEffect, useMemo, useCallback, useContext, createContext, useRef } = React;

export const money = DS.money;
export const TZ = 'America/Mexico_City';

// Íconos de línea con el mismo trazo que el sistema (2 px, puntas redondeadas).
// Los primeros son los del sistema; los demás siguen el mismo estilo para el menú lateral.
const PATHS = {
  home: 'M3.5 11 12 4l8.5 7|M5.5 9.5V20h13V9.5|M10 20v-5.5h4V20',
  paw: 'M8.3 17.2c.6-2.7 2-4.7 3.9-4.7s3.3 2 3.9 4.7c.4 1.6-.7 2.8-2.1 2.8-.8 0-1.2-.4-1.8-.4s-1 .4-1.8.4c-1.4 0-2.5-1.2-2.1-2.8z',
  plus: 'M12 5v14M5 12h14',
  cal: 'M3.5 10h17M8 3v4M16 3v4',
  user: 'M4.5 20c1.3-3.6 4.2-5.6 7.5-5.6s6.2 2 7.5 5.6',
  inbox: 'M4 13.5 6.6 6h10.8L20 13.5V19H4z|M4 13.5h4.5l1.2 2.2h4.6l1.2-2.2H20',
  chat: 'M4 5.5h16v10.5H10l-4.5 3.8V16H4z|M8 9.5h8M8 12.5h5',
  check: 'M5 12.5 9.5 17 19 7.5',
  info: 'M12 11v5.5M12 7.8v.01',
  alert: 'M12 4 21 19.5H3z|M12 10v4.2M12 17v.01',
  pin: 'M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0c0 5.4-6.5 11-6.5 11z',
  clock: 'M12 7.5V12l3 2',
  wallet: 'M4 7.5h14.5a1.5 1.5 0 0 1 1.5 1.5v9a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 18V6.5A1.5 1.5 0 0 1 5.5 5H17|M16 13.5h.01',
  shield: 'M12 3.5 19 6v5.5c0 4.3-3 7.7-7 9-4-1.3-7-4.7-7-9V6z|M9 12l2 2 4-4',
  users: 'M3 19.5c1-3 3.4-4.6 6-4.6s5 1.6 6 4.6|M15.5 14.9c2.2.1 4.2 1.6 5 4.1',
  chart: 'M4 20h16|M7 16v-5M12 16V7M17 16v-8',
  bell: 'M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15z|M10 20.5h4',
  settings: 'M4 7h10M18 7h2M4 17h4M12 17h8',
  logout: 'M14 5H5.5v14H14|M10 12h10M16.5 8.5 20 12l-3.5 3.5',
  menu: 'M4 7h16M4 12h16M4 17h16',
  back: 'M15 5l-7 7 7 7',
  moon: 'M19.5 14.5A8 8 0 0 1 9.5 4.5a8 8 0 1 0 10 10z',
  swap: 'M7 7h12l-3-3M17 17H5l3 3',
  doc: 'M6 3.5h8l4 4V20.5H6z|M14 3.5V8h4|M9 12h6M9 15.5h6',
  camera: 'M4 8.5h3.5L9 6h6l1.5 2.5H20V19H4z',
  id: 'M3.5 6h17v12h-17z|M13 10h4.5M13 13.5h3',
  upload: 'M12 15.5V5M8 9l4-4 4 4|M5 15v4.5h14V15',
  phone: 'M7.5 3.5h9v17h-9z|M11 17.5h2',
  link: 'M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7L11.5 6.8|M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1.5-1.5',
  x: 'M6 6l12 12M18 6 6 18',
  bank: 'M3.5 9.5 12 4l8.5 5.5|M5.5 10v7.5M10 10v7.5M14 10v7.5M18.5 10v7.5|M3.5 20h17',
  star: 'M12 4l2.4 5 5.4.6-4 3.7 1.1 5.4L12 16l-4.9 2.7 1.1-5.4-4-3.7 5.4-.6z',
};
const EXTRA = {
  paw: [['circle', { cx: 6.5, cy: 10, r: 1.7 }], ['circle', { cx: 10, cy: 6, r: 1.7 }], ['circle', { cx: 14.5, cy: 6, r: 1.7 }], ['circle', { cx: 18, cy: 10, r: 1.7 }]],
  cal: [['rect', { x: 3.5, y: 5, width: 17, height: 15.5, rx: 2.5 }]],
  user: [['circle', { cx: 12, cy: 8, r: 3.8 }]],
  users: [['circle', { cx: 9, cy: 8.5, r: 3.4 }], ['circle', { cx: 16.5, cy: 9, r: 2.6 }]],
  info: [['circle', { cx: 12, cy: 12, r: 8.5 }]],
  pin: [['circle', { cx: 12, cy: 10, r: 2.3 }]],
  clock: [['circle', { cx: 12, cy: 12, r: 8.5 }]],
  settings: [['circle', { cx: 16, cy: 7, r: 2 }], ['circle', { cx: 10, cy: 17, r: 2 }]],
  camera: [['circle', { cx: 12, cy: 13, r: 3.2 }]],
  id: [['circle', { cx: 8.5, cy: 11, r: 1.8 }], ['path', { d: 'M6 15.5c.5-1.3 1.4-2 2.5-2s2 .7 2.5 2' }]],
};

export function Icon({ name, className = '' }) {
  const kids = (EXTRA[name] || []).map((e, i) => React.createElement(e[0], { key: 'e' + i, ...e[1] }));
  (PATHS[name] || '').split('|').forEach((d, i) => { if (d) kids.push(React.createElement('path', { key: 'p' + i, d })); });
  return React.createElement('svg', {
    className: 'lv-i ' + className, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor',
    strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true,
  }, kids);
}

// ───────── Fechas (siempre en hora de CDMX) ─────────
const fmt = (opts) => new Intl.DateTimeFormat('es-MX', { timeZone: TZ, ...opts });
export const hora = (d) => fmt({ hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(d));
export const fechaLarga = (d) => fmt({ weekday: 'long', day: 'numeric', month: 'long' }).format(new Date(d));
export const fechaCorta = (d) => fmt({ day: 'numeric', month: 'short' }).format(new Date(d)).replace('.', '');
export function diaRelativo(d) {
  const k = (x) => fmt({ year: 'numeric', month: '2-digit', day: '2-digit' }).format(x);
  const hoy = new Date();
  const man = new Date(hoy.getTime() + 864e5);
  if (k(new Date(d)) === k(hoy)) return 'Hoy';
  if (k(new Date(d)) === k(man)) return 'Mañana';
  const s = fechaLarga(d);
  return s.charAt(0).toUpperCase() + s.slice(1);
}
export const ventana = (ini, fin) => `${diaRelativo(ini)}, ${hora(ini)} a ${hora(fin)}`;
export const hoyISO = () => fmt({ year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date()).split('/').reverse().join('-');

// Fechas sin hora ("2026-03-04"): se arman al mediodía UTC para que no se recorran un día en CDMX
export function fechaDia(iso) {
  if (!iso) return '';
  const [y, m, d] = String(iso).split('-').map(Number);
  return fmt({ day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(Date.UTC(y, m - 1, d, 12))).replace('.', '');
}
export function fechaDiaLarga(iso) {
  if (!iso) return '';
  const [y, m, d] = String(iso).split('-').map(Number);
  return fmt({ day: 'numeric', month: 'long' }).format(new Date(Date.UTC(y, m - 1, d, 12)));
}
export const diasHasta = (iso) => {
  const [y, m, d] = String(iso).split('-').map(Number);
  const [hy, hm, hd] = hoyISO().split('-').map(Number);
  return Math.round((Date.UTC(y, m - 1, d) - Date.UTC(hy, hm - 1, hd)) / 864e5);
};

export const capital = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);
export const nombreCorto = (p) => (p?.nombre || '').split(' ')[0];
export const quitarTitulo = (t) => String(t || '').replace(/^\s*((dra|dr|doctora|doctor|mvz|m\.\s*v\.\s*z|mtra|mtro|lic)(\.\s*|\s+))+/i, '').trim();
export const fechaHora = (d) => `${fechaCorta(d)}, ${hora(d)}`;
export const soloDigitos = (t) => String(t || '').replace(/\D/g, '');
export const telBonito = (t) => { const d = soloDigitos(t); return d.length === 10 ? `${d.slice(0, 2)} ${d.slice(2, 6)} ${d.slice(6)}` : d; };

// Fecha (AAAA-MM-DD) en hora de CDMX de un instante
export const diaISO = (d) => fmt({ year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(d)).split('/').reverse().join('-');
// Cuánto falta, en palabras: "45 min", "3 h", "2 días"
export function falta(d) {
  const min = Math.round((new Date(d) - Date.now()) / 60000);
  if (min <= 0) return 'ya venció';
  if (min < 60) return `${min} min`;
  if (min < 48 * 60) return `${Math.floor(min / 60)} h ${min % 60 ? (min % 60) + ' min' : ''}`.trim();
  return `${Math.floor(min / 1440)} días`;
}

// ───────── Textos del modelo ─────────
export const SERVICIO = { consulta: 'Consulta general', vacunacion: 'Vacunación', desparasitacion: 'Desparasitación' };
export const SERVICIO_DESC = {
  consulta: 'Revisión general en casa.',
  vacunacion: 'El médico lleva y aplica la vacuna.',
  desparasitacion: 'Interna o externa, según indique el médico.',
};
export const ESPECIE = { perro: 'Perro', gato: 'Gato' };
export const SEXO = { macho: 'Macho', hembra: 'Hembra' };
// Foto redonda del médico veterinario; sin foto, sus iniciales
export function FotoMvz({ ruta, nombre = '', tam = 56 }) {
  const url = fotoUrl(ruta);
  const ini = nombre.split(' ').filter(Boolean).slice(0, 2).map((x) => x[0]).join('').toUpperCase();
  const st = { width: tam, height: tam, fontSize: Math.round(tam / 2.8) };
  return url
    ? html`<img class="foto-mvz" src=${url} alt=${'Foto de ' + nombre} width=${tam} height=${tam} style=${st} loading="lazy" />`
    : html`<span class="foto-mvz foto-mvz-vacia" style=${st} aria-hidden="true">${ini}</span>`;
}
// URL pública de la foto de un médico veterinario (en la vista de muestra ya viene como imagen)
export function fotoUrl(ruta) {
  if (!ruta) return null;
  if (ruta.startsWith('data:')) return ruta;
  const base = (window.LV_CONFIG || {}).supabaseUrl || '';
  return `${base}/storage/v1/object/public/fotos-mvz/${ruta.split('/').map(encodeURIComponent).join('/')}`;
}
// Edad guardada en meses: "8 meses", "1 año", "3 años y 6 meses"
export function edadTxt(m) {
  if (m === null || m === undefined || m === '') return '';
  const a = Math.floor(m / 12), r = m % 12;
  const meses = r === 1 ? '1 mes' : `${r} meses`;
  if (!a) return m === 0 ? 'menos de 1 mes' : meses;
  return `${a === 1 ? '1 año' : a + ' años'}${r ? ' y ' + meses : ''}`;
}
// "Perro · hembra · 3 años"
export const mascotaTxt = (s) => [ESPECIE[s.especie], s.sexo && SEXO[s.sexo].toLowerCase(), edadTxt(s.edad_meses)].filter(Boolean).join(' · ');
export const MEDIO_PAGO = { efectivo: 'Efectivo', transferencia: 'Transferencia', tarjeta: 'Tarjeta' };
export const DIAS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
export const HORAS = [6, 8, 10, 12, 14, 16, 18, 20];
export const bloqueTxt = (h) => `${String(h).padStart(2, '0')}:00 a ${String(h + 2).padStart(2, '0')}:00`;

// Estado de una solicitud: [tono del Badge, palabra, explicación para el tutor]
export const ESTADO = {
  buscando: ['pendiente', 'Esperando respuesta', 'Tu solicitud está con el médico veterinario. Si no responde en una hora, pasa a tu siguiente opción.'],
  por_pagar: ['pendiente', 'Por pagar', 'Un médico veterinario aceptó. Paga la cuota de servicio para confirmar.'],
  confirmada: ['verificado', 'Confirmada', 'Tu consulta está confirmada. Aquí están los datos de contacto de tu médico veterinario.'],
  realizada: ['completado', 'Realizada', 'Esta consulta ya pasó.'],
  sin_medico: ['neutral', 'Sin médico', 'Ningún médico veterinario pudo tomar la solicitud. No se te cobró nada.'],
  vencida: ['neutral', 'Venció', 'No se pagó la cuota de servicio a tiempo. No se te cobró nada.'],
  cancelada_tutor: ['neutral', 'Cancelada', 'Cancelaste esta solicitud.'],
  cancelada_tarde: ['neutral', 'Cancelada', 'Cancelaste con menos de 24 horas: la cuota de servicio no se reembolsa.'],
  tutor_ausente: ['error', 'No se pudo atender', 'El médico veterinario acudió y no fue posible atender. La cuota de servicio no se reembolsa.'],
  cancelada_mvz: ['error', 'Cancelada por el médico', 'El médico veterinario canceló. Tu cuota de servicio se reembolsa completa.'],
  mvz_no_asistio: ['error', 'El médico no asistió', 'El médico veterinario no se presentó. Tu cuota de servicio se reembolsa completa.'],
  cancelada_admin: ['neutral', 'Cancelada por LilieVET', 'LilieVET cerró esta consulta. Si pagaste la cuota de servicio, se reembolsa completa.'],
};
export const OPCION = { en_espera: 'En espera', pendiente: 'Por responder', aceptada: 'Aceptó', rechazada: 'No pudo', sin_respuesta: 'No respondió', descartada: 'No disponible' };
export const PAGO = { creado: 'Sin pagar', aprobado: 'Pagada', reembolso_pendiente: 'Reembolso en proceso', reembolsado: 'Reembolsada', contracargo: 'Contracargo' };
export const REPORTE = { inasistencia_mvz: 'El médico veterinario no se presentó', reembolso: 'Solicitud de reembolso', tutor_ausente: 'El tutor no estaba o no permitió el acceso', datos_personales: 'Mis datos personales (acceso, corrección o eliminación)', otro: 'Otro asunto' };
export const DOCUMENTO = { terminos: 'Términos y Condiciones', privacidad: 'Aviso de Privacidad', carta_mvz: 'Carta del Médico Veterinario', compartir_telefono: 'Compartir mi celular con tutores confirmados' };

// Leyenda obligatoria de quién presta el servicio
export const leyenda = (m) => `Servicio prestado por ${m.nombre}, cédula ${m.cedula}, médico veterinario independiente`;
