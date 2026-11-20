// Perfil (tutor y médico veterinario): datos, celular verificado, documentos aceptados y reportes generales.
import { html, DS, Icon, useState, fechaHora, telBonito, soloDigitos, DOCUMENTO, REPORTE } from './lib.js';
import { api } from './api.js';
import { PageHead, useToast } from './shell.js';
import { Soporte } from './legal.js';

export function Caja({ titulo, sub, extra, children }) {
  return html`<section class="box">
    <div class="box-head"><div><h2>${titulo}</h2>${sub && html`<p class="small muted" style=${{ marginTop: 2 }}>${sub}</p>`}</div>${extra}</div>
    ${children}
  </section>`;
}

// Envuelve una acción: estado de espera y error visible.
// Si la acción sale bien devuelve su resultado, o `true` cuando no regresa nada: las funciones de la
// base que no devuelven datos (guardar, bloquear, aprobar…) llegan como `null` desde Supabase, y un
// `null` aquí hacía creer a la pantalla que la acción había fallado (no recargaba ni avisaba).
export function useAccion() {
  const [st, setSt] = useState({ ocupado: false, error: null });
  const correr = async (fn) => {
    setSt({ ocupado: true, error: null });
    try { const r = await fn(); setSt({ ocupado: false, error: null }); return r ?? true; }
    catch (e) { setSt({ ocupado: false, error: e.message || 'Algo salió mal. Intenta de nuevo.' }); return false; }
  };
  return [st, correr, () => setSt({ ocupado: false, error: null })];
}

// Celular: por ahora se verifica a mano. El tutor nos escribe por WhatsApp desde su número
// (con un mensaje ya escrito que incluye su correo) y en el Panel se marca como verificado.
// A los médicos veterinarios se les confirma en la videollamada de alta.
// Cuando haya código automático (ver README, "verificar el celular con código por WhatsApp"),
// api.pedirCodigo / api.verificarCodigo siguen disponibles.
const cfgApp = window.LV_CONFIG || {};
const SOPORTE_WA = String(cfgApp.soporteWhatsapp || '').replace(/\D/g, '');
const enlaceVerificar = (correo) => `https://wa.me/52${SOPORTE_WA}?text=${encodeURIComponent(`Hola, quiero verificar mi cuenta de LilieVET. Mi correo es ${correo}`)}`;

function Celular({ perfil, onPerfil }) {
  const toast = useToast();
  const [tel, setTel] = useState(perfil.telefono);
  const [st, correr] = useAccion();
  const telOk = soloDigitos(tel).length === 10;
  const cambio = soloDigitos(tel) !== perfil.telefono;
  const esMvz = perfil.rol === 'mvz';
  const guardar = async () => {
    if (await correr(() => api.guardarTelefono(tel))) { await onPerfil(); toast(esMvz ? 'Celular guardado.' : 'Celular guardado. Ahora confírmalo por WhatsApp.'); }
  };
  return html`<${Caja} titulo="Celular" sub="Lo usamos para avisarte de tus consultas. La otra parte solo lo ve cuando la consulta queda confirmada."
      extra=${perfil.telefono_verificado ? html`<${DS.Badge} tone="verificado">Verificado<//>` : html`<${DS.Badge} tone="pendiente">Sin verificar<//>`}>
    <div class="stack">
      <${DS.Field} label="Celular a 10 dígitos" type="tel" inputMode="numeric" autoComplete="tel-national" maxLength=${14} value=${tel} onChange=${(e) => setTel(e.target.value)} />
      ${cambio && html`<div class="row">
        <${DS.Button} onClick=${guardar} disabled=${st.ocupado || !telOk}>${st.ocupado ? 'Guardando…' : 'Guardar celular'}<//>
        ${perfil.telefono_verificado && html`<span class="small muted">Si cambias de número, hay que verificarlo otra vez.</span>`}
      </div>`}
      ${!cambio && !perfil.telefono_verificado && (esMvz
        ? html`<${DS.Notice} tone="info">Lo confirmamos en la videollamada de verificación de tu cuenta.<//>`
        : html`<${DS.Notice} tone="info" title="Confirma tu celular.">Mándanos un mensaje por WhatsApp desde este número para verificarlo. Cuando lo confirmemos podrás solicitar consultas.<//>
          ${SOPORTE_WA && html`<div><a class="lv-btn lv-btn-primary" href=${enlaceVerificar(perfil.correo)} target="_blank" rel="noopener noreferrer">Enviar mensaje por WhatsApp</a></div>`}`)}
      ${st.error && html`<${DS.Notice} tone="error">${st.error}<//>`}
    </div>
  <//>`;
}

function Nombre({ perfil, onPerfil }) {
  const toast = useToast();
  const fijo = perfil.rol === 'mvz' && perfil.mvz && perfil.mvz.estado !== 'pendiente';
  const [n, setN] = useState(perfil.nombre);
  const [a, setA] = useState(perfil.apellidos);
  const [st, correr] = useAccion();
  const guardar = async () => { if (await correr(() => api.guardarNombre(n, a))) { await onPerfil(); toast('Datos guardados.'); } };
  return html`<${Caja} titulo="Tus datos">
    <div class="stack">
      <div class="field-row">
        <${DS.Field} label="Nombre" maxLength=${60} value=${n} disabled=${fijo} onChange=${(e) => setN(e.target.value)} />
        <${DS.Field} label="Apellidos" maxLength=${80} value=${a} disabled=${fijo} onChange=${(e) => setA(e.target.value)} />
      </div>
      <${DS.Field} label="Correo" value=${perfil.correo} disabled=${true} hint=${fijo ? 'Tu nombre ya se verificó contra tu cédula. Si hay que corregirlo, escríbenos.' : undefined} />
      ${st.error && html`<${DS.Notice} tone="error">${st.error}<//>`}
      ${!fijo && html`<div><${DS.Button} variant="secondary" onClick=${guardar} disabled=${st.ocupado || !n.trim() || !a.trim() || (n === perfil.nombre && a === perfil.apellidos)}>Guardar<//></div>`}
    </div>
  <//>`;
}

export function FormReporte({ solicitudId = null, tipos, onListo, titulo = 'Enviar un reporte' }) {
  const [tipo, setTipo] = useState(tipos[0]);
  const [detalle, setDetalle] = useState('');
  const [st, correr] = useAccion();
  const [listo, setListo] = useState(false);
  const enviar = async (e) => {
    e.preventDefault();
    if (await correr(() => api.reportar(solicitudId, tipo, detalle))) { setListo(true); setDetalle(''); onListo && onListo(); }
  };
  if (listo) return html`<${DS.Notice} tone="exito" title="Recibimos tu reporte.">Lo revisamos y te respondemos aquí mismo y por correo.<//>`;
  return html`<form class="stack" onSubmit=${enviar}>
    <strong class="section-title">${titulo}</strong>
    ${tipos.length > 1 && html`<${DS.Field} as="select" label="¿De qué se trata?" value=${tipo} onChange=${(e) => setTipo(e.target.value)} options=${tipos.map((t) => ({ value: t, label: REPORTE[t] }))} />`}
    <${DS.Field} as="textarea" label="Cuéntanos qué pasó" maxLength=${1000} value=${detalle} onChange=${(e) => setDetalle(e.target.value)}
      hint=${tipo === 'datos_personales' ? 'Dinos qué necesitas: conocer tus datos, corregirlos o eliminarlos. No escribas datos de salud ni contraseñas.' : 'Entre 10 y 1,000 caracteres. No escribas contraseñas ni datos de tarjetas.'} />
    ${st.error && html`<${DS.Notice} tone="error">${st.error}<//>`}
    <div><${DS.Button} type="submit" variant="secondary" disabled=${st.ocupado || detalle.trim().length < 10}>${st.ocupado ? 'Enviando…' : 'Enviar reporte'}<//></div>
  </form>`;
}

export function Perfil({ perfil, onPerfil }) {
  const [st, correr] = useAccion();
  return html`<div class="page page-narrow">
    <${PageHead} titulo="Perfil" sub=${perfil.rol === 'mvz' ? 'Tu cuenta de médico veterinario.' : 'Tu cuenta.'} />
    <${Nombre} perfil=${perfil} onPerfil=${onPerfil} />
    <${Celular} perfil=${perfil} onPerfil=${onPerfil} />
    <${Caja} titulo="Documentos que aceptaste" sub="Guardamos la fecha, la hora y la versión de cada aceptación.">
      <div class="table-wrap"><table class="table">
        <thead><tr><th>Documento</th><th>Versión</th><th>Aceptado</th></tr></thead>
        <tbody>${perfil.aceptaciones.map((a, i) => html`<tr key=${i}><td>${DOCUMENTO[a.documento] || a.documento}</td><td class="nw">${a.version}</td><td class="nw">${fechaHora(a.aceptado_at)}</td></tr>`)}</tbody>
      </table></div>
    <//>
    <${Caja} titulo="Ayuda y datos personales">
      <div class="stack">
        <${FormReporte} tipos=${['otro', 'datos_personales']} titulo="Escríbenos" />
        <${Soporte} />
      </div>
    <//>
    <${Caja} titulo="Seguridad" sub="Si perdiste tu teléfono o entraste desde un equipo que no es tuyo.">
      <div class="stack-sm">
        ${st.error && html`<${DS.Notice} tone="error">${st.error}<//>`}
        <div class="row">
          <${DS.Button} variant="secondary" disabled=${st.ocupado} onClick=${() => correr(() => api.salirDeTodos())}><${Icon} name="logout" /> Cerrar sesión en todos mis dispositivos<//>
        </div>
      </div>
    <//>
  </div>`;
}
