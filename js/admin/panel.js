// Panel de LilieVET. Solo abre con doble factor (app de autenticación); la base lo exige en cada función.
import { html, DS, Icon, useState, useEffect, SERVICIO, ESTADO, OPCION, PAGO, REPORTE, MEDIO_PAGO, fechaHora, fechaDia, diaISO, ventana, telBonito, money, soloDigitos, FotoMvz } from '../lib.js';
import { api } from '../api.js';
import { PageHead, useDatos, useToast, ErrorCarga, Cargando, NAV } from '../shell.js';
import { Caja, useAccion } from '../cuenta.js';

// ───────── Doble factor ─────────
export function PuertaPanel({ onAbierto }) {
  const [estado, setEstado] = useState(null);       // { nivel, factor }
  const [alta, setAlta] = useState(null);           // { id, qr, secreto }
  const [codigo, setCodigo] = useState('');
  const [st, correr] = useAccion();
  useEffect(() => { correr(() => api.mfaEstado()).then((e) => { if (e) { setEstado(e); if (e.nivel === 'aal2') onAbierto(); } }); }, []);
  const empezar = async () => { const a = await correr(() => api.mfaInscribir()); if (a) setAlta(a); };
  const verificar = async (e) => {
    e.preventDefault();
    if (await correr(() => api.mfaVerificar(alta ? alta.id : estado.factor.id, codigo))) onAbierto();
    setCodigo('');
  };
  const qrOk = alta && typeof alta.qr === 'string' && alta.qr.startsWith('data:image/svg+xml');
  return html`<div class="page page-narrow">
    <${PageHead} titulo="Panel de LilieVET" sub="Para abrir el Panel necesitas tu contraseña y un código de tu app de autenticación." />
    <section class="box stack">
      ${!estado && !st.error && html`<p class="muted">Revisando tu sesión…</p>`}
      ${estado && !estado.factor && !alta && html`
        <${DS.Notice} tone="info" title="Activa el doble factor.">Instala una app de autenticación (Google Authenticator, Microsoft Authenticator, Authy o la de tu gestor de contraseñas). Solo se hace una vez.<//>
        <div><${DS.Button} disabled=${st.ocupado} onClick=${empezar}>Activar doble factor<//></div>`}
      ${alta && html`
        <p>1. Escanea este código con tu app de autenticación.</p>
        ${qrOk ? html`<img src=${alta.qr} alt="Código QR para tu app de autenticación" width="200" height="200" style=${{ background: '#fff', borderRadius: 12, padding: 8 }} />` : null}
        <p class="small muted">Si no puedes escanearlo, escribe esta clave en la app: <b style=${{ overflowWrap: 'anywhere' }}>${alta.secreto}</b></p>
        <p>2. Escribe el código de 6 dígitos que te muestra.</p>`}
      ${estado && (estado.factor || alta) && html`<form class="stack" onSubmit=${verificar}>
        <${DS.Field} label="Código de 6 dígitos" inputMode="numeric" autoComplete="one-time-code" maxLength=${6} value=${codigo} onChange=${(e) => setCodigo(soloDigitos(e.target.value))} />
        <div><${DS.Button} type="submit" disabled=${st.ocupado || codigo.length !== 6}>${st.ocupado ? 'Verificando…' : 'Abrir el Panel'}<//></div>
      </form>`}
      ${st.error && html`<${DS.Notice} tone="error">${st.error}<//>`}
    </section>
  </div>`;
}

// ───────── Piezas ─────────
function Lista({ fn, deps = [], children }) {
  const d = useDatos(fn, deps);
  if (d.error) return html`<${ErrorCarga} error=${d.error} onReintentar=${d.recargar} />`;
  if (!d.datos) return html`<${Cargando} />`;
  return children(d.datos, d.recargar);
}
const Tabla = ({ cab, children }) => html`<div class="table-wrap"><table class="table"><thead><tr>${cab.map((c) => html`<th key=${c}>${c}</th>`)}</tr></thead><tbody>${children}</tbody></table></div>`;
const Vacio = ({ children }) => html`<p class="small muted">${children}</p>`;
const estadoBadge = (e) => html`<${DS.Badge} tone=${(ESTADO[e] || ['neutral'])[0]}>${(ESTADO[e] || [0, e])[1]}<//>`;

// ───────── Resumen ─────────
function ResumenVista({ r, onConteos }) {
  useEffect(() => { onConteos({ medicos: r.medicos_pendientes, reportes: r.reportes_abiertos, reembolsos: r.reembolsos_pendientes, tutores: r.tutores_sin_verificar }); }, [r]);
  return html`
      <div class="kpis">
        <div class="kpi"><span>Esperando médico</span><b>${r.buscando}</b></div>
        <div class="kpi"><span>Por pagar</span><b>${r.por_pagar}</b></div>
        <div class="kpi"><span>Confirmadas</span><b>${r.confirmadas}</b></div>
        <div class="kpi"><span>Realizadas</span><b>${r.realizadas_30d}</b><small>últimos 30 días</small></div>
      </div>
      <div class="kpis">
        <div class="kpi"><span>Cuotas cobradas</span><b>${money(r.cuotas_30d)}</b><small>últimos 30 días, vigentes</small></div>
        <div class="kpi"><span>Reembolsado</span><b>${money(r.reembolsado_30d)}</b><small>últimos 30 días</small></div>
        <div class="kpi"><span>Médicos aprobados</span><b>${r.medicos_aprobados}</b></div>
        <div class="kpi"><span>Tutores</span><b>${r.tutores}</b></div>
      </div>
      <${Caja} titulo="Pendientes">
        <ul class="checklist">
          <li class=${r.medicos_pendientes ? 'falta' : 'ok'}><${Icon} name="shield" /><div><b class="small" style=${{ fontWeight: 600 }}>Médicos veterinarios por verificar</b></div><a href="#/medicos">${r.medicos_pendientes}</a></li>
          <li class=${r.reportes_abiertos ? 'falta' : 'ok'}><${Icon} name="chat" /><div><b class="small" style=${{ fontWeight: 600 }}>Reportes abiertos</b></div><a href="#/reportes">${r.reportes_abiertos}</a></li>
          <li class=${r.tutores_sin_verificar ? 'falta' : 'ok'}><${Icon} name="user" /><div><b class="small" style=${{ fontWeight: 600 }}>Tutores con celular por verificar</b></div><a href="#/tutores">${r.tutores_sin_verificar || 0}</a></li>
          <li class=${r.reembolsos_pendientes ? 'falta' : 'ok'}><${Icon} name="wallet" /><div><b class="small" style=${{ fontWeight: 600 }}>Reembolsos por enviar</b></div><a href="#/pagos">${r.reembolsos_pendientes}</a></li>
        </ul>
      <//>`;
}
const Resumen = ({ onConteos }) => html`<${Lista} fn=${() => api.admin.resumen()}>${(r) => html`<${ResumenVista} r=${r} onConteos=${onConteos} />`}<//>`;

// ───────── Médicos veterinarios ─────────
function Medico({ m, recargar }) {
  const toast = useToast();
  const [ced, setCed] = useState(false);
  const [ide, setIde] = useState(false);
  const [st, correr] = useAccion();
  const hacer = async (accion, texto) => { if (await correr(() => api.admin.decidirMvz(m.id, accion, ced, ide))) { toast(texto); recargar(); } };
  const tono = { pendiente: 'pendiente', aprobado: 'verificado', suspendido: 'error' }[m.estado];
  return html`<article class=${'box stack' + (m.estado === 'pendiente' ? ' decision' : '')}>
    <div class="spread" style=${{ alignItems: 'flex-start' }}>
      <div class="medico-cab"><${FotoMvz} ruta=${m.foto} nombre=${`${m.nombre} ${m.apellidos}`} tam=${64} />
        <div><h3 class="section-title">${m.nombre} ${m.apellidos}</h3><p class="small muted">${m.correo} · ${telBonito(m.telefono)}</p></div></div>
      <${DS.Badge} tone=${tono}>${{ pendiente: 'Por verificar', aprobado: 'Aprobado', suspendido: 'Suspendido' }[m.estado]}<//>
    </div>
    <dl class="datos">
      <dt>Foto</dt><dd>${m.foto ? html`Revisa que sea una foto real de su cara. <button type="button" class="linkish" disabled=${st.ocupado} onClick=${() => hacer('quitar_foto', 'Foto quitada. Le avisamos para que suba otra.')}>Quitar foto</button>` : 'Sin foto'}</dd>
      <dt>Presentación</dt><dd>${m.presentacion || 'Sin presentación'}</dd>
      <dt>Cédula</dt><dd>${m.cedula || 'Sin capturar'}${m.cedula_verificada_at ? ` · verificada el ${fechaDia(diaISO(m.cedula_verificada_at))}` : ''}</dd>
      <dt>Identidad</dt><dd>${m.identidad_verificada_at ? `Confirmada en videollamada el ${fechaDia(diaISO(m.identidad_verificada_at))}` : 'Sin confirmar'}</dd>
      <dt>Zonas</dt><dd>${m.zonas.join(', ') || 'Sin zonas'}</dd>
      <dt>Agenda</dt><dd>${m.bloques} bloques a la semana${m.recibe_solicitudes ? '' : ' · en pausa'}</dd>
      <dt>Precios</dt><dd>${[['Consulta', m.precio_consulta], ['Vacunación', m.precio_vacunacion], ['Desparasitación', m.precio_desparasitacion]].filter((x) => x[1]).map((x) => `${x[0]} ${money(x[1])}`).join(' · ') || 'Sin precios'}</dd>
      <dt>Cobra con</dt><dd>${m.medios_pago.map((x) => MEDIO_PAGO[x]).join(', ') || 'Sin indicar'}</dd>
      <dt>Celular</dt><dd>${m.comparte_telefono ? 'Aceptó compartirlo con tutores confirmados' : 'No ha aceptado compartirlo'}</dd>
    </dl>
    ${m.estado === 'pendiente' && m.cedula && html`<div class="sub-box stack-sm">
      <p class="small">Busca la cédula en el <a href="https://cedulaprofesional.sep.gob.mx/" target="_blank" rel="noopener noreferrer">Registro Nacional de Profesionistas</a> y confirma su identidad en videollamada. No guardes copias de su identificación.</p>
      <label class="check"><input type="checkbox" checked=${ced} onChange=${(e) => setCed(e.target.checked)} /><span>Verifiqué que la cédula ${m.cedula} corresponde a ${m.nombre} ${m.apellidos} y es de médico veterinario zootecnista.</span></label>
      <label class="check"><input type="checkbox" checked=${ide} onChange=${(e) => setIde(e.target.checked)} /><span>Confirmé su identidad en videollamada contra una identificación oficial.</span></label>
    </div>`}
    ${st.error && html`<${DS.Notice} tone="error">${st.error}<//>`}
    <div class="row">
      ${m.estado === 'pendiente' && m.cedula && html`<${DS.Button} size="sm" disabled=${st.ocupado || !ced || !ide} onClick=${() => hacer('aprobar', 'Médico veterinario aprobado.')}>Aprobar<//>`}
      ${m.estado === 'pendiente' && m.cedula && html`<${DS.Button} size="sm" variant="secondary" disabled=${st.ocupado} onClick=${() => hacer('corregir_cedula', 'Se le pidió corregir su cédula.')}>Pedir que corrija la cédula<//>`}
      ${m.estado === 'aprobado' && html`<${DS.Button} size="sm" variant="secondary" disabled=${st.ocupado} onClick=${() => hacer('reverificar', 'Fecha de verificación actualizada.')}>Registrar reverificación de cédula<//>`}
      ${m.estado === 'aprobado' && html`<${DS.Button} size="sm" variant="ghost" disabled=${st.ocupado} onClick=${() => hacer('suspender', 'Cuenta suspendida.')}>Suspender<//>`}
      ${m.estado === 'suspendido' && html`<${DS.Button} size="sm" variant="secondary" disabled=${st.ocupado} onClick=${() => hacer('reactivar', 'Cuenta reactivada.')}>Reactivar<//>`}
    </div>
  </article>`;
}
const Medicos = () => html`<${Lista} fn=${() => api.admin.medicos()}>${(lista, recargar) => html`
  ${!lista.length && html`<${Vacio}>Aún no se registra ningún médico veterinario.<//>`}
  <div class="stack">${lista.map((m) => html`<${Medico} key=${m.id} m=${m} recargar=${recargar} />`)}</div>`}<//>`;

// ───────── Consultas ─────────
function Cerrar({ s, recargar, onFin }) {
  const [estado, setEstado] = useState('cancelada_admin');
  const [motivo, setMotivo] = useState('');
  const [st, correr] = useAccion();
  const enviar = async () => { if (await correr(() => api.admin.cerrarSolicitud(s.id, estado, motivo))) { onFin(); recargar(); } };
  return html`<div class="sub-box stack-sm">
    <${DS.Field} as="select" label="Cerrar como" value=${estado} onChange=${(e) => setEstado(e.target.value)} options=${[
      { value: 'cancelada_admin', label: 'Caso fortuito o fuerza mayor (reembolso del 100%)' },
      { value: 'mvz_no_asistio', label: 'El médico no se presentó (reembolso del 100%)' },
      { value: 'tutor_ausente', label: 'El tutor no estaba o no permitió el acceso (sin reembolso)' }]} />
    <${DS.Field} label="Motivo" maxLength=${300} value=${motivo} onChange=${(e) => setMotivo(e.target.value)} />
    ${st.error && html`<${DS.Notice} tone="error">${st.error}<//>`}
    <div class="row"><${DS.Button} size="sm" disabled=${st.ocupado || motivo.trim().length < 5} onClick=${enviar}>Cerrar consulta<//><${DS.Button} size="sm" variant="secondary" onClick=${onFin}>No<//></div>
  </div>`;
}
function ConsultasAdmin() {
  const [abierta, setAbierta] = useState(null);
  return html`<${Lista} fn=${() => api.admin.solicitudes()}>${(lista, recargar) => html`<${Caja} titulo="Últimas solicitudes">
    ${!lista.length && html`<${Vacio}>Aún no hay solicitudes.<//>`}
    <ul class="hist">${lista.map((s) => html`<li key=${s.id}>
      <div class="spread"><b>${SERVICIO[s.servicio]} · ${ventana(s.inicia_at, new Date(new Date(s.inicia_at).getTime() + 72e5))}</b>${estadoBadge(s.estado)}</div>
      <span class="small muted">Tutor: ${s.tutor} (${telBonito(s.tutor_telefono)}) · ${s.colonia}, ${s.alcaldia}</span>
      <span class="small muted">Médico: ${s.medico || 'sin asignar'} · opciones: ${(s.opciones || []).map((o) => `${o.orden}. ${o.nombre} (${OPCION[o.estado].toLowerCase()})`).join('; ')}</span>
      <span class="small muted">Cuota ${money(s.cuota)}: ${s.pago ? PAGO[s.pago].toLowerCase() : 'sin cobro'}${s.motivo_cierre ? ` · ${s.motivo_cierre}` : ''}</span>
      ${abierta === s.id ? html`<${Cerrar} s=${s} recargar=${recargar} onFin=${() => setAbierta(null)} />`
        : ['buscando', 'por_pagar', 'confirmada', 'realizada'].includes(s.estado) && html`<div><button type="button" class="linkish" onClick=${() => setAbierta(s.id)}>Cerrar desde soporte</button></div>`}
    </li>`)}</ul>
  <//>`}<//>`;
}

// ───────── Reportes ─────────
function Reporte({ r, recargar }) {
  const toast = useToast();
  const [version, setVersion] = useState('');
  const [resp, setResp] = useState('');
  const [st, correr] = useAccion();
  const resolver = async (decision) => { if (await correr(() => api.admin.resolverReporte(r.id, decision, version, resp))) { toast('Reporte resuelto.'); recargar(); } };
  const abierto = r.estado === 'abierto';
  return html`<article class=${'box stack' + (abierto ? ' decision' : '')}>
    <div class="spread" style=${{ alignItems: 'flex-start' }}>
      <div><h3 class="section-title">${REPORTE[r.tipo]}</h3><p class="small muted">${r.autor} (${r.autor_rol === 'mvz' ? 'médico veterinario' : 'tutor'}) · ${telBonito(r.autor_telefono)} · ${fechaHora(r.created_at)}</p></div>
      <${DS.Badge} tone=${abierto ? 'pendiente' : 'completado'}>${abierto ? 'Abierto' : { reembolsar: 'Reembolsado', no_procede: 'No procede', atendido: 'Atendido' }[r.decision]}<//>
    </div>
    <p style=${{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>${r.detalle}</p>
    ${r.solicitud_id && html`<p class="small muted">${SERVICIO[r.servicio]} del ${fechaHora(r.inicia_at)} · estado: ${(ESTADO[r.solicitud_estado] || [0, r.solicitud_estado])[1].toLowerCase()} · médico: ${r.medico || 'sin asignar'}${r.medico_telefono ? ` (${telBonito(r.medico_telefono)})` : ''} · cuota: ${r.pago ? PAGO[r.pago].toLowerCase() : 'sin cobro'}</p>`}
    ${!abierto && html`<p class="small"><b>Respuesta:</b> ${r.resolucion}${r.version_medico ? html` <br /><b>Versión del médico:</b> ${r.version_medico}` : ''}</p>`}
    ${abierto && html`<div class="stack">
      ${r.tipo === 'inasistencia_mvz' && html`<${DS.Notice} tone="info">Pide su versión al médico veterinario. Si no hay prueba de que acudió, procede el reembolso.<//>`}
      <${DS.Field} as="textarea" label="Versión del médico veterinario (opcional)" maxLength=${1000} value=${version} onChange=${(e) => setVersion(e.target.value)} />
      <${DS.Field} as="textarea" label="Respuesta para quien reportó" maxLength=${1000} value=${resp} onChange=${(e) => setResp(e.target.value)} />
      ${st.error && html`<${DS.Notice} tone="error">${st.error}<//>`}
      <div class="row">
        ${r.solicitud_id && r.autor_rol === 'tutor' && html`<${DS.Button} size="sm" disabled=${st.ocupado || resp.trim().length < 5} onClick=${() => resolver('reembolsar')}>Reembolsar la cuota<//>`}
        <${DS.Button} size="sm" variant="secondary" disabled=${st.ocupado || resp.trim().length < 5} onClick=${() => resolver('no_procede')}>No procede<//>
        <${DS.Button} size="sm" variant="secondary" disabled=${st.ocupado || resp.trim().length < 5} onClick=${() => resolver('atendido')}>Atendido<//>
      </div></div>`}
  </article>`;
}
const Reportes = () => html`<${Lista} fn=${() => api.admin.reportes()}>${(lista, recargar) => html`
  ${!lista.length && html`<${Vacio}>No hay reportes.<//>`}
  <div class="stack">${lista.map((r) => html`<${Reporte} key=${r.id} r=${r} recargar=${recargar} />`)}</div>`}<//>`;

// ───────── Cuotas y reembolsos ─────────
function Pagos() {
  const toast = useToast();
  const [st, correr] = useAccion();
  return html`<${Lista} fn=${() => api.admin.pagos()}>${(lista, recargar) => {
    const pendientes = lista.filter((g) => g.estado === 'reembolso_pendiente').length;
    const procesar = async () => { const r = await correr(() => api.admin.procesarReembolsos()); if (r) { toast(`Reembolsos enviados: ${r.reembolsados}. Con error: ${r.fallidos}.`); recargar(); } };
    return html`<${Caja} titulo="Cuotas de servicio" sub="LilieVET solo cobra la cuota. La consulta se paga directo al médico veterinario."
        extra=${html`<${DS.Button} size="sm" disabled=${st.ocupado || !pendientes} onClick=${procesar}>${st.ocupado ? 'Enviando…' : `Enviar reembolsos pendientes (${pendientes})`}<//>`}>
      ${st.error && html`<${DS.Notice} tone="error">${st.error}<//>`}
      ${!lista.length && html`<${Vacio}>Aún no hay cuotas cobradas.<//>`}
      ${lista.length > 0 && html`<${Tabla} cab=${['Fecha', 'Tutor', 'Monto', 'Estado', 'Mercado Pago', 'Nota']}>
        ${lista.map((g) => html`<tr key=${g.id}><td class="nw">${fechaHora(g.aprobado_at || g.created_at)}</td><td>${g.tutor}</td><td class="nw num">${money(g.monto)}</td>
          <td><${DS.Badge} tone=${{ aprobado: 'verificado', reembolso_pendiente: 'pendiente', reembolsado: 'neutral', contracargo: 'error' }[g.estado]}>${PAGO[g.estado]}<//></td>
          <td class="nw num">${g.mp_payment_id}</td><td class="small">${g.motivo_reembolso || ''}${g.intentos_reembolso ? ` · intentos: ${g.intentos_reembolso}` : ''}</td></tr>`)}
      <//>`}
    <//>`;
  }}<//>`;
}

// ───────── Tutores ─────────
const sinVerificar = (t) => !t.telefono_verificado_at && !t.bloqueada;
function ConteoTutores({ lista, onConteos }) {
  const n = lista.filter(sinVerificar).length;
  useEffect(() => { onConteos && onConteos((c) => ({ ...c, tutores: n })); }, [n]);
  return null;
}
function Tutores({ onConteos }) {
  const toast = useToast();
  const [st, correr] = useAccion();
  const [porBorrar, setPorBorrar] = useState(null);
  return html`<${Lista} fn=${() => api.admin.tutores()}>${(todos, recargar) => {
    const hacer = async (id, accion, txt) => { if (await correr(() => api.admin.cuenta(id, accion))) { toast(txt); recargar(); } };
    // Primero los que esperan verificación de celular
    const lista = [...todos.filter(sinVerificar), ...todos.filter((t) => !sinVerificar(t))];
    const pendientes = todos.filter(sinVerificar).length;
    return html`<${Caja} titulo="Tutores" sub=${pendientes ? `${pendientes} con celular por verificar` : undefined}>
      <${ConteoTutores} lista=${todos} onConteos=${onConteos} />
      ${st.error && html`<${DS.Notice} tone="error">${st.error}<//>`}
      ${!lista.length && html`<${Vacio}>Aún no se registra ningún tutor.<//>`}
      ${lista.length > 0 && html`<${Tabla} cab=${['Nombre', 'Contacto', 'Celular', 'Solicitudes', 'Alta', '']}>
        ${lista.map((t) => html`<tr key=${t.id}><td>${t.nombre} ${t.apellidos}${t.bloqueada ? html` <${DS.Badge} tone="error">Suspendida<//>` : ''}</td>
          <td class="small">${t.correo}<br />${telBonito(t.telefono)}</td>
          <td>${t.telefono_verificado_at ? html`<${DS.Badge} tone="verificado">Verificado<//>` : html`<${DS.Badge} tone="pendiente">Por verificar<//><br /><button type="button" class="linkish" disabled=${st.ocupado} onClick=${() => hacer(t.id, 'verificar_telefono', 'Celular marcado como verificado.')}>Marcar verificado</button>`}</td>
          <td class="num">${t.solicitudes}</td><td class="nw">${fechaDia(diaISO(t.created_at))}</td>
          <td><button type="button" class="linkish" disabled=${st.ocupado} onClick=${() => hacer(t.id, t.bloqueada ? 'desbloquear' : 'bloquear', t.bloqueada ? 'Cuenta reactivada.' : 'Cuenta suspendida.')}>${t.bloqueada ? 'Reactivar' : 'Suspender'}</button>
            ${' · '}${porBorrar === t.id
              ? html`<button type="button" class="linkish" style=${{ color: 'var(--danger)' }} disabled=${st.ocupado} onClick=${async () => { if (await correr(() => api.admin.eliminarDatos(t.id))) { toast('Datos personales eliminados.'); recargar(); } setPorBorrar(null); }}>Confirmar: eliminar sus datos para siempre</button>`
              : html`<button type="button" class="linkish" onClick=${() => setPorBorrar(t.id)}>Eliminar datos</button>`}</td></tr>`)}
      <//>`}
      <p class="small muted" style=${{ marginTop: 12 }}>“Marcar verificado”: úsalo cuando el tutor te escriba por WhatsApp desde el mismo número que aparece aquí (el mensaje trae su correo para encontrarlo). “Eliminar datos” atiende una solicitud de eliminación de datos personales: borra nombre, contacto y domicilios, cierra la cuenta y no se puede deshacer.</p>
    <//>`;
  }}<//>`;
}

// ───────── Zonas sin médico: búsquedas de tutores que no encontraron horarios ─────────
const Demanda = () => html`<${Lista} fn=${() => api.admin.demanda()}>${(lista) => html`<${Caja} titulo="Zonas sin médico"
    sub="Alcaldías donde tutores buscaron y no encontraron horarios en los últimos 90 días. Sirve para decidir dónde reclutar médicos veterinarios.">
    ${!lista.length && html`<${Vacio}>Todavía nadie se ha quedado sin horarios. Aquí aparecerán las alcaldías cuando pase.<//>`}
    ${lista.length > 0 && html`<${Tabla} cab=${['Alcaldía', 'Tutores', 'Búsquedas', 'Consulta', 'Vacunación', 'Desparasitación', 'Médicos hoy', 'Última']}>
      ${lista.map((z) => html`<tr key=${z.alcaldia}>
        <td>${z.alcaldia}${z.sin_medicos ? html` <${DS.Badge} tone="error">Sin médicos<//>` : html` <${DS.Badge} tone="pendiente">Sin horarios<//>`}</td>
        <td class="num"><b>${z.tutores}</b></td><td class="num">${z.busquedas}</td>
        <td class="num">${z.consulta}</td><td class="num">${z.vacunacion}</td><td class="num">${z.desparasitacion}</td>
        <td class="num">${z.medicos_hoy}</td><td class="nw">${fechaHora(z.ultima)}</td></tr>`)}
    <//>`}
    <p class="small muted" style=${{ marginTop: 12 }}>“Sin médicos”: ningún médico aprobado atendía esa alcaldía cuando buscaron. “Sin horarios”: sí había médicos, pero no tenían horarios libres para ese servicio. Se cuenta una búsqueda por tutor, alcaldía, servicio y día; no se guarda la dirección.</p>
  <//>`}<//>`;

// ───────── Encuestas, bitácora y parámetros ─────────
const Encuestas = () => html`<${Lista} fn=${() => api.admin.encuestas()}>${(lista) => html`<${Caja} titulo="Encuestas privadas" sub="Sirven para mejorar el servicio. No se publican ni se usan para decidir sobre un médico veterinario.">
  ${!lista.length && html`<${Vacio}>Aún no hay respuestas.<//>`}
  ${lista.length > 0 && html`<${Tabla} cab=${['Consulta', 'Médico', '¿Se presentó?', 'Puntualidad', 'Trato', 'Recomendaría', 'Comentario']}>
    ${lista.map((e) => html`<tr key=${e.solicitud_id}><td class="nw">${SERVICIO[e.servicio]}<br /><span class="small muted">${fechaHora(e.inicia_at)}</span></td><td>${e.medico}</td>
      <td>${e.se_presento ? 'Sí' : 'No'}</td><td class="num">${e.puntualidad ?? '—'}</td><td class="num">${e.trato ?? '—'}</td><td class="num">${e.recomendaria ?? '—'}</td>
      <td class="small" style=${{ overflowWrap: 'anywhere' }}>${e.comentario || ''}</td></tr>`)}
  <//>`}<//>`}<//>`;

const Bitacora = () => html`<${Lista} fn=${() => api.admin.bitacora()}>${(lista) => html`<${Caja} titulo="Bitácora" sub="Acciones del Panel, cancelaciones, reembolsos y eventos de pago. No se puede editar.">
  ${!lista.length && html`<${Vacio}>Sin movimientos.<//>`}
  ${lista.length > 0 && html`<${Tabla} cab=${['Cuándo', 'Quién', 'Acción', 'Sobre', 'Detalle']}>
    ${lista.map((a) => html`<tr key=${a.id}><td class="nw">${fechaHora(a.created_at)}</td><td>${a.actor || 'Sistema'}</td><td>${a.accion}</td><td class="small">${a.objeto} ${String(a.objeto_id || '').slice(0, 8)}</td>
      <td class="small" style=${{ overflowWrap: 'anywhere' }}>${a.detalle ? JSON.stringify(a.detalle) : ''}</td></tr>`)}
  <//>`}<//>`}<//>`;

const PARAMS = [
  ['cuota_servicio', 'Cuota de servicio (pesos, IVA incluido)', 'Aplica a solicitudes nuevas.'],
  ['minutos_respuesta', 'Minutos para que el médico responda', ''],
  ['horas_para_pagar', 'Horas para que el tutor pague la cuota', ''],
  ['horas_cancelacion', 'Horas de anticipación para cancelar con reembolso', 'Debe coincidir con tus Términos y Condiciones.'],
  ['horas_anticipacion', 'Horas mínimas de anticipación para solicitar', ''],
  ['dias_agenda', 'Días hacia adelante que se pueden solicitar', ''],
  ['version_terminos', 'Versión vigente de los Términos', 'Es la que se guarda en cada aceptación nueva.'],
  ['version_privacidad', 'Versión vigente del Aviso de Privacidad', ''],
  ['version_carta', 'Versión vigente de la Carta del Médico Veterinario', ''],
];
function Parametro({ clave, etiqueta, ayuda, valor, recargar }) {
  const toast = useToast();
  const [v, setV] = useState(String(valor));
  const [st, correr] = useAccion();
  const guardar = async () => { if (await correr(() => api.admin.guardarParametro(clave, v))) { toast('Parámetro guardado.'); recargar(); } };
  return html`<div class="stack-sm">
    <div class="row" style=${{ alignItems: 'flex-end' }}>
      <${DS.Field} label=${etiqueta} hint=${ayuda || undefined} maxLength=${20} value=${v} onChange=${(e) => setV(e.target.value)} />
      <${DS.Button} size="sm" variant="secondary" disabled=${st.ocupado || v === String(valor) || !v.trim()} onClick=${guardar}>Guardar<//>
    </div>
    ${st.error && html`<${DS.Notice} tone="error">${st.error}<//>`}
  </div>`;
}
function Parametros() {
  const toast = useToast();
  const [st, correr] = useAccion();
  return html`<${Lista} fn=${() => api.admin.parametros()}>${(p, recargar) => html`<${Caja} titulo="Parámetros" sub="Cada cambio queda en la bitácora.">
    <div class="stack">
      ${PARAMS.map(([k, e, a]) => html`<${Parametro} key=${k + p[k]} clave=${k} etiqueta=${e} ayuda=${a} valor=${p[k]} recargar=${recargar} />`)}
      <label class="check"><input type="checkbox" checked=${p.exigir_telefono_verificado === true} disabled=${st.ocupado}
        onChange=${async (e) => { if (await correr(() => api.admin.guardarParametro('exigir_telefono_verificado', e.target.checked ? 'true' : 'false'))) { toast('Parámetro guardado.'); recargar(); } }} />
        <span>Exigir celular verificado para solicitar una consulta.</span></label>
      ${st.error && html`<${DS.Notice} tone="error">${st.error}<//>`}
    </div>
  <//>`}<//>`;
}

function Mas() {
  const otros = NAV.admin.grupos.flatMap((g) => g.items).filter((i) => !NAV.admin.tabs.includes(i.id));
  return html`<section class="box"><ul class="hist">${otros.map((i) => html`<li key=${i.id}><a href=${'#/' + i.id}>${i.label}</a></li>`)}</ul></section>`;
}

const SECCIONES = {
  resumen: ['Resumen', Resumen], medicos: ['Médicos veterinarios', Medicos], consultas: ['Consultas', ConsultasAdmin], reportes: ['Reportes', Reportes],
  pagos: ['Cuotas y reembolsos', Pagos], tutores: ['Tutores', Tutores], encuestas: ['Encuestas', Encuestas], demanda: ['Zonas sin médico', Demanda], bitacora: ['Bitácora', Bitacora],
  parametros: ['Parámetros', Parametros], mas: ['Más', Mas],
};
export const tituloPanel = (id) => (SECCIONES[id] || SECCIONES.resumen)[0];

export function Panel({ seccion, onConteos }) {
  const [titulo, Comp] = SECCIONES[seccion] || SECCIONES.resumen;
  return html`<div class="page"><${PageHead} titulo=${titulo} /><${Comp} key=${seccion} onConteos=${onConteos} /></div>`;
}
