// Consultas del tutor: estado, pago de la cuota, contacto del médico, cancelación, reagenda, reporte y encuesta.
import { html, DS, Icon, useState, useEffect, SERVICIO, ESPECIE, mascotaTxt, ESTADO, OPCION, PAGO, REPORTE, MEDIO_PAGO, ventana, falta, fechaDia, diaISO, fechaHora, telBonito, money, leyenda } from '../lib.js';
import { api } from '../api.js';
import { PageHead, useDatos, ir, useToast, ErrorCarga, Cargando } from '../shell.js';
import { useAccion, FormReporte } from '../cuenta.js';

const H = 36e5;

function Encuesta({ s, onListo }) {
  const [r, setR] = useState({ se_presento: 'true', puntualidad: '', trato: '', recomendaria: '', comentario: '' });
  const [st, correr] = useAccion();
  const escala = (k, max, desde = 1) => html`<div class="row" role="radiogroup">
    ${Array.from({ length: max - desde + 1 }, (_, i) => String(i + desde)).map((v) => html`<${DS.Chip} key=${v} type="radio" name=${k + s.id} checked=${r[k] === v} onChange=${() => setR({ ...r, [k]: v })}>${v}<//>`)}</div>`;
  const enviar = async () => {
    const p = { se_presento: r.se_presento, comentario: r.comentario };
    ['puntualidad', 'trato', 'recomendaria'].forEach((k) => { if (r[k] !== '') p[k] = Number(r[k]); });
    if (await correr(() => api.responderEncuesta(s.id, p))) onListo();
  };
  const si = r.se_presento === 'true';
  return html`<div class="stack sub-box">
    <strong class="section-title">Encuesta privada</strong>
    <p class="small muted">Solo la lee LilieVET. No se publica ni se le muestra al médico veterinario.</p>
    <div class="stack-sm"><span class="small"><b>¿El médico veterinario se presentó?</b></span>
      <div class="row" role="radiogroup">
        <${DS.Chip} type="radio" name=${'sp' + s.id} checked=${si} onChange=${() => setR({ ...r, se_presento: 'true' })}>Sí<//>
        <${DS.Chip} type="radio" name=${'sp' + s.id} checked=${!si} onChange=${() => setR({ ...r, se_presento: 'false' })}>No<//>
      </div></div>
    ${si && html`
      <div class="stack-sm"><span class="small"><b>Puntualidad</b> (1 = muy tarde, 5 = a tiempo)</span>${escala('puntualidad', 5)}</div>
      <div class="stack-sm"><span class="small"><b>Trato contigo y con tu mascota</b> (1 a 5)</span>${escala('trato', 5)}</div>
      <div class="stack-sm"><span class="small"><b>¿Recomendarías LilieVET?</b> (0 a 10)</span>${escala('recomendaria', 10, 0)}</div>`}
    <${DS.Field} as="textarea" label="Comentario (opcional)" maxLength=${1000} value=${r.comentario} onChange=${(e) => setR({ ...r, comentario: e.target.value })} hint="No escribas datos de salud de personas ni datos de pago." />
    ${st.error && html`<${DS.Notice} tone="error">${st.error}<//>`}
    <div><${DS.Button} variant="secondary" disabled=${st.ocupado} onClick=${enviar}>${st.ocupado ? 'Enviando…' : 'Enviar encuesta'}<//></div>
  </div>`;
}

function Tarjeta({ s, P, abierta, recargar, autoPagar }) {
  const toast = useToast();
  const [st, correr, limpiar] = useAccion();
  const [modo, setModo] = useState(null);           // null | cancelar | reporte
  const [tono, palabra, texto] = ESTADO[s.estado];
  const m = s.medico;
  const horasAntes = (new Date(s.inicia_at) - Date.now()) / H;
  const conReembolso = s.estado === 'confirmada' && horasAntes > P.horas_cancelacion;
  const empezo = Date.now() >= new Date(s.inicia_at).getTime();
  const puedeReportar = ['confirmada', 'realizada'].includes(s.estado) && empezo && Date.now() < new Date(s.termina_at).getTime() + 7 * 24 * H;
  const abierto = s.reportes.some((r) => r.estado === 'abierto');

  const pagar = () => correr(async () => { await api.pagar(s.id); if (api.mode === 'demo') { toast('Consulta confirmada.', { sparks: true }); recargar(); } });
  // Enlace del correo/WhatsApp "médico aceptó" (…#/consultas/<id>/pagar): abre el cobro directo, una sola vez
  useEffect(() => {
    if (!autoPagar) return;
    history.replaceState(null, '', location.pathname + location.search + '#/consultas/' + s.id);
    if (s.estado === 'por_pagar') pagar();
  }, []);
  const cancelar = async () => {
    const r = await correr(() => api.cancelarSolicitud(s.id));
    if (r) { setModo(null); toast(r.reembolso ? 'Consulta cancelada. Te reembolsamos la cuota completa.' : 'Solicitud cancelada.'); recargar(); }
  };
  const reagenda = async (acepta) => { if (await correr(() => api.responderReagenda(s.id, acepta))) { toast(acepta ? 'Nuevo horario confirmado.' : 'Se conserva el horario actual.'); recargar(); } };

  return html`<article class=${'box stack' + (abierta ? ' decision' : '')} id=${'s-' + s.id}>
    <div class="spread" style=${{ alignItems: 'flex-start' }}>
      <div><h2 class="section-title">${SERVICIO[s.servicio]} para ${s.mascota}</h2>
        <p style=${{ marginTop: 2 }}>${ventana(s.inicia_at, s.termina_at)}</p>
        <p class="small muted">${s.colonia}, ${s.alcaldia}</p>
        ${s.sexo && html`<p class="small muted">${mascotaTxt(s)}</p>`}</div>
      <${DS.Badge} tone=${tono}>${palabra}<//>
    </div>
    <p class="small">${texto}</p>

    ${s.estado === 'buscando' && html`<ul class="hist">${(s.opciones || []).map((o) => html`<li key=${o.orden}>
      <div class="spread"><span>${o.orden}. ${o.nombre}</span><span class="small muted">${OPCION[o.estado]}${o.estado === 'pendiente' && o.vence_at ? ` · le quedan ${falta(o.vence_at)}` : ''}</span></div></li>`)}</ul>`}

    ${m && ['por_pagar', 'confirmada', 'realizada'].includes(s.estado) && html`<div class="sub-box stack-sm">
      <p><b>${leyenda(m)}.</b></p>
      <div><${DS.Badge} tone="verificado">Cédula verificada el ${fechaDia(diaISO(m.cedula_verificada_at))}<//></div>
      ${m.telefono && html`<p>Celular: <a href=${'tel:+52' + m.telefono}><b>${telBonito(m.telefono)}</b></a></p>`}
      ${m.medios_pago?.length > 0 && html`<p class="small muted">Acepta: ${m.medios_pago.map((x) => MEDIO_PAGO[x]).join(', ').toLowerCase()}.</p>`}
    </div>`}

    ${['por_pagar', 'confirmada'].includes(s.estado) && html`<${DS.BillSummary}
      items=${[{ label: `${SERVICIO[s.servicio]}${s.servicio === 'consulta' ? '' : ' (desde)'} · directo al médico veterinario`, amount: s.precio_servicio }]}
      payNow=${s.cuota} payNowLabel=${s.estado === 'por_pagar' ? 'Cuota de servicio LilieVET · pagas ahora' : 'Cuota de servicio LilieVET · pagada'} />`}

    ${s.estado === 'por_pagar' && html`<div class="stack-sm">
      <p class="small">Tienes <b>${falta(s.pagar_antes_de)}</b> para pagar. Si no, el horario se libera y no se cobra nada.</p>
      <div class="row"><${DS.Button} disabled=${st.ocupado} onClick=${pagar}>${st.ocupado ? 'Abriendo Mercado Pago…' : `Pagar cuota de ${money(s.cuota)}`}<//></div>
      <p class="small muted">El pago se hace en Mercado Pago. LilieVET no ve ni guarda los datos de tu tarjeta.</p>
    </div>`}

    ${s.pago && s.pago !== 'creado' && s.pago !== 'aprobado' && html`<${DS.Notice} tone="info">Cuota de servicio: ${PAGO[s.pago].toLowerCase()}.${s.pago === 'reembolso_pendiente' ? ' Mercado Pago la devuelve al mismo medio con el que pagaste; puede tardar unos días.' : ''}<//>`}

    ${s.estado === 'confirmada' && s.reagenda_propuesta_at && html`<${DS.Notice} title="El médico veterinario propone otro horario.">
      ${ventana(s.reagenda_propuesta_at, new Date(new Date(s.reagenda_propuesta_at).getTime() + 2 * H))}. Tu cuota de servicio se conserva para la nueva fecha.
      <div class="row" style=${{ marginTop: 8 }}>
        <${DS.Button} size="sm" disabled=${st.ocupado} onClick=${() => reagenda(true)}>Aceptar cambio<//>
        <${DS.Button} size="sm" variant="secondary" disabled=${st.ocupado} onClick=${() => reagenda(false)}>Conservar horario<//>
      </div><//>`}

    ${s.encuesta_pendiente && html`<${Encuesta} s=${s} onListo=${() => { toast('Gracias por tu respuesta.', { sparks: true }); recargar(); }} />`}

    ${s.reportes.map((r, i) => html`<${DS.Notice} key=${i} tone=${r.estado === 'abierto' ? 'info' : 'exito'} title=${REPORTE[r.tipo] + '.'}>
      ${r.estado === 'abierto' ? 'Lo estamos revisando.' : r.resolucion || 'Resuelto.'}<//>`)}

    ${st.error && html`<${DS.Notice} tone="error">${st.error}<//>`}

    ${modo === 'cancelar' && html`<div class="sub-box stack-sm">
      <p><b>¿Cancelar esta ${s.estado === 'confirmada' ? 'consulta' : 'solicitud'}?</b></p>
      <p class="small">${s.estado !== 'confirmada' ? 'Aún no has pagado nada: no hay ningún cargo.'
        : conReembolso ? `Faltan más de ${P.horas_cancelacion} horas: te reembolsamos la cuota de servicio completa.`
        : `Faltan menos de ${P.horas_cancelacion} horas: la cuota de servicio no se reembolsa. Si prefieres otro horario, pídele al médico veterinario que proponga un cambio.`}</p>
      <div class="row"><${DS.Button} size="sm" disabled=${st.ocupado} onClick=${cancelar}>Sí, cancelar<//><${DS.Button} size="sm" variant="secondary" onClick=${() => { setModo(null); limpiar(); }}>No<//></div>
    </div>`}
    ${modo === 'reporte' && html`<div class="sub-box"><${FormReporte} solicitudId=${s.id} tipos=${['inasistencia_mvz', 'reembolso', 'otro']} onListo=${recargar} /></div>`}

    ${!modo && html`<div class="row">
      ${['buscando', 'por_pagar', 'confirmada'].includes(s.estado) && !empezo && html`<${DS.Button} size="sm" variant="ghost" onClick=${() => setModo('cancelar')}>Cancelar ${s.estado === 'confirmada' ? 'consulta' : 'solicitud'}<//>`}
      ${puedeReportar && !abierto && html`<${DS.Button} size="sm" variant="ghost" onClick=${() => setModo('reporte')}>Reportar un problema o pedir reembolso<//>`}
    </div>`}
  </article>`;
}

export function Consultas({ perfil, sub }) {
  const { datos, error, recargar } = useDatos(() => api.misSolicitudes(), []);
  // Al volver de Mercado Pago la confirmación puede tardar unos segundos: se vuelve a consultar un rato
  const esperandoPago = (datos || []).some((s) => s.estado === 'por_pagar');
  const [vueltas, setVueltas] = useState(0);
  useEffect(() => {
    if (!esperandoPago || vueltas >= 8 || api.mode === 'demo') return undefined;
    const t = setTimeout(() => { setVueltas(vueltas + 1); recargar(); }, 6000);
    return () => clearTimeout(t);
  }, [esperandoPago, vueltas, datos]);
  useEffect(() => { if (sub && datos) document.getElementById('s-' + sub)?.scrollIntoView({ block: 'start' }); }, [sub, !!datos]);
  const pagarAhora = location.hash.replace(/\?.*$/, '').endsWith('/pagar');

  if (error) return html`<div class="page page-narrow"><${ErrorCarga} error=${error} onReintentar=${recargar} /></div>`;
  if (!datos) return html`<${Cargando} />`;
  const vivas = datos.filter((s) => ['buscando', 'por_pagar', 'confirmada'].includes(s.estado)).sort((a, b) => new Date(a.inicia_at) - new Date(b.inicia_at));
  const pasadas = datos.filter((s) => !vivas.includes(s));
  return html`<div class="page page-narrow">
    <${PageHead} titulo="Consultas"><${DS.Button} variant="secondary" onClick=${() => ir('solicitar')}><${Icon} name="plus" /> Solicitar<//><//>
    ${!datos.length && html`<${DS.EmptyState} who="liebe" title="Aún no tienes consultas" action=${html`<${DS.Button} block onClick=${() => ir('solicitar')}>Solicitar consulta<//>`}>
      Cuando solicites una, aquí verás su estado y los datos de tu médico veterinario.<//>`}
    ${vivas.map((s) => html`<${Tarjeta} key=${s.id} s=${s} P=${perfil.parametros} abierta=${sub === s.id} autoPagar=${pagarAhora && sub === s.id} recargar=${recargar} />`)}
    ${pasadas.length > 0 && html`<h2 class="section-title">Anteriores</h2>`}
    ${pasadas.map((s) => html`<${Tarjeta} key=${s.id} s=${s} P=${perfil.parametros} abierta=${sub === s.id} recargar=${recargar} />`)}
  </div>`;
}
