// Solicitudes del médico veterinario: aceptar o rechazar, consultas confirmadas con contacto, cancelar y reagendar.
import { html, DS, Icon, useState, useEffect, SERVICIO, ESPECIE, HORAS, bloqueTxt, ventana, falta, telBonito, money, hoyISO, fechaHora, mascotaTxt } from '../lib.js';
import { api } from '../api.js';
import { PageHead, useDatos, ir, useToast, ErrorCarga, Cargando } from '../shell.js';
import { Caja, useAccion, FormReporte } from '../cuenta.js';

const H = 36e5;

// Lo que falta para aparecer ante los tutores
export function pendientesAlta(perfil) {
  const m = perfil.mvz;
  return [
    ['Número de cédula profesional', !!m.cedula, 'servicios'],
    ['Al menos un precio', !!(m.precio_consulta || m.precio_vacunacion || m.precio_desparasitacion), 'servicios'],
    ['Aceptar compartir tu celular con tutores confirmados', m.comparte_telefono, 'servicios'],
    ['Zonas donde atiendes', m.zonas.length > 0, 'agenda'],
    ['Horario semanal', m.horario.length > 0, 'agenda'],
  ];
}

function Alta({ perfil }) {
  const m = perfil.mvz;
  const lista = pendientesAlta(perfil);
  const completo = lista.every((x) => x[1]);
  const corregir = !!m.cedula_por_corregir;
  return html`<div class="page page-narrow">
    <${PageHead} titulo="Tu alta" sub="Revisamos cada cuenta antes de que reciba solicitudes." />
    ${corregir && m.estado !== 'suspendido' && html`<${DS.Notice} tone="error" title="Te pedimos corregir tu número de cédula.">
      No pudimos verificarla en el Registro Nacional de Profesionistas. Escríbela de nuevo en Servicios y guarda los cambios. <a href="#/servicios">Corregir cédula</a><//>`}
    ${m.estado === 'suspendido'
      ? html`<${DS.Notice} tone="error" title="Tu cuenta está en pausa.">Por ahora no recibes solicitudes. Escríbenos para revisarla.<//>`
      : completo
        ? html`<${DS.Notice} tone="info" title="Tu información está completa.">Te contactamos por WhatsApp para una videollamada breve donde confirmamos tu identidad y tu cédula. No guardamos copia de tu identificación.<//>`
        : html`<${DS.Notice} title="Completa tu información.">Cuando esté lista, te contactamos para la videollamada de verificación.<//>`}
    <section class="box"><ul class="checklist">
      ${lista.map(([txt, ok, a]) => html`<li key=${txt} class=${ok ? 'ok' : 'falta'}><${Icon} name=${ok ? 'check' : 'alert'} /><div><b class="small" style=${{ fontWeight: 600 }}>${txt}</b></div>
        ${!ok && html`<${DS.Button} size="sm" variant="secondary" onClick=${() => ir(a)}>Completar<//>`}</li>`)}
      <li class=${m.cedula_verificada_at ? 'ok' : ''}><${Icon} name="shield" /><div><b class="small" style=${{ fontWeight: 600 }}>Verificación de cédula e identidad por LilieVET</b></div>
        <${DS.Badge} tone=${m.cedula_verificada_at ? 'verificado' : 'pendiente'}>${m.cedula_verificada_at ? 'Verificada' : 'Pendiente'}<//></li>
    </ul></section>
    <p class="small muted">Los mensajes de LilieVET sobre tu alta están en <a href="#/avisos">Avisos</a>.</p>
  </div>`;
}

function Reagendar({ s, onListo }) {
  const [fecha, setFecha] = useState('');
  const [hora, setHora] = useState('10');
  const [st, correr] = useAccion();
  const enviar = async () => {
    const inicia = new Date(`${fecha}T${String(hora).padStart(2, '0')}:00:00-06:00`).toISOString();
    if (await correr(() => api.proponerReagenda(s.id, inicia))) onListo();
  };
  return html`<div class="sub-box stack-sm">
    <p><b>Proponer otro horario</b></p>
    <p class="small muted">${s.estado === 'por_pagar' ? 'El tutor todavía no paga: si acepta el cambio, paga la cuota para el nuevo horario. ' : 'Si puedes, acuérdalo antes con el tutor. '}Él lo acepta en la app y la consulta se mueve. El horario se puede cambiar una sola vez y dentro de los 30 días siguientes a la fecha original.</p>
    <div class="field-row">
      <${DS.Field} label="Día" type="date" min=${hoyISO()} value=${fecha} onChange=${(e) => setFecha(e.target.value)} />
      <${DS.Field} as="select" label="Bloque" value=${hora} onChange=${(e) => setHora(e.target.value)} options=${HORAS.map((h) => ({ value: String(h), label: bloqueTxt(h) }))} />
    </div>
    ${st.error && html`<${DS.Notice} tone="error">${st.error}<//>`}
    <div><${DS.Button} size="sm" disabled=${st.ocupado || !fecha} onClick=${enviar}>Enviar propuesta<//></div>
  </div>`;
}

function Oferta({ s, precio, recargar }) {
  const toast = useToast();
  const [st, correr] = useAccion();
  const [, tic] = useState(0);
  useEffect(() => { const t = setInterval(() => tic((x) => x + 1), 30000); return () => clearInterval(t); }, []);
  const min = Math.round((new Date(s.oferta.vence_at) - Date.now()) / 60000);
  const responder = async (acepta) => {
    const r = await correr(() => api.responderSolicitud(s.id, acepta));
    if (r) { toast(r.resultado === 'aceptada' ? 'Aceptada. Avisamos al tutor para que pague la cuota.' : r.resultado === 'vencida' ? 'El tiempo para responder ya había vencido.' : 'Solicitud rechazada.', { sparks: r.resultado === 'aceptada' }); recargar(); }
  };
  return html`<article class="lv-req lv-req-nueva" style=${{ maxWidth: 'none' }}>
    <div class="lv-req-head"><${DS.Badge} tone="nuevo">Nueva<//>
      <span class=${'lv-req-timer' + (min <= 10 ? ' lv-req-timer-low' : '')}>Te quedan <b>${falta(s.oferta.vence_at)}</b> para responder</span></div>
    <div><h3 class="lv-req-title">${SERVICIO[s.servicio]} · ${mascotaTxt(s).toLowerCase()}</h3>
      ${s.motivo && html`<p class="lv-req-detail" style=${{ color: 'var(--ink)' }}><b>Lo que cuenta el tutor:</b> ${s.motivo}</p>`}
      <p class="lv-req-detail">Verás el nombre, el celular y el domicilio del tutor cuando la consulta quede confirmada.</p></div>
    <div class="lv-req-rows">
      <div class="lv-req-row"><${Icon} name="clock" /><span>${ventana(s.inicia_at, s.termina_at)}</span></div>
      <div class="lv-req-row"><${Icon} name="pin" /><span>${s.colonia}, ${s.alcaldia}</span></div>
    </div>
    ${precio && html`<p class="lv-req-earn">Cobras directo al tutor: <b>${money(precio)}</b>${s.servicio === 'consulta' ? '' : ' o más, según lo que apliques'}</p>`}
    ${st.error && html`<${DS.Notice} tone="error">${st.error}<//>`}
    <div class="lv-req-foot">
      <${DS.Button} variant="secondary" disabled=${st.ocupado} onClick=${() => responder(false)}>Rechazar<//>
      <${DS.Button} disabled=${st.ocupado} onClick=${() => responder(true)}>Aceptar<//>
    </div>
  </article>`;
}

function Consulta({ s, recargar }) {
  const toast = useToast();
  const [modo, setModo] = useState(null);
  const [motivo, setMotivo] = useState('');
  const [st, correr] = useAccion();
  const c = s.contacto;
  const empezo = Date.now() >= new Date(s.inicia_at).getTime();
  const puedeCambiar = ['por_pagar', 'confirmada'].includes(s.estado) && s.reagendas < 1 && !s.reagenda_propuesta_at && !empezo;
  const cancelar = async () => { if (await correr(() => api.cancelarComoMvz(s.id, motivo))) { toast('Consulta cancelada. Avisamos al tutor.'); recargar(); } };
  const responder = async (acepta) => { if (await correr(() => api.responderReagenda(s.id, acepta))) { toast(acepta ? 'Nuevo horario confirmado. Avisamos al tutor.' : 'Se conserva el horario actual. Avisamos al tutor.'); recargar(); } };
  const badge = { por_pagar: ['pendiente', 'Esperando pago del tutor'], confirmada: ['verificado', 'Confirmada'], realizada: ['completado', 'Realizada'] }[s.estado] || ['neutral', 'Cerrada'];
  return html`<article class="box stack">
    <div class="spread" style=${{ alignItems: 'flex-start' }}>
      <div><h3 class="section-title">${SERVICIO[s.servicio]} · ${c?.mascota || ESPECIE[s.especie].toLowerCase()}</h3>
        <p style=${{ marginTop: 2 }}>${ventana(s.inicia_at, s.termina_at)}</p><p class="small muted">${s.colonia}, ${s.alcaldia}</p>
        <p class="small muted">${mascotaTxt(s)}</p></div>
      <${DS.Badge} tone=${badge[0]}>${badge[1]}<//>
    </div>
    ${s.motivo && html`<p class="small"><b>Lo que cuenta el tutor:</b> ${s.motivo}</p>`}
    ${s.estado === 'por_pagar' && html`<p class="small muted">Cuando el tutor pague la cuota de servicio, la consulta queda confirmada y aquí aparecen sus datos. Si no paga a tiempo, el horario se libera solo.</p>`}
    ${c && html`<dl class="datos sub-box">
      <dt>Tutor</dt><dd>${c.nombre}</dd>
      <dt>Celular</dt><dd><a href=${'tel:+52' + c.telefono}><b>${telBonito(c.telefono)}</b></a></dd>
      <dt>Domicilio</dt><dd>${c.calle_numero}, ${s.colonia}, ${s.alcaldia}, C.P. ${c.cp}</dd>
      ${c.referencias && html`<dt>Referencias</dt><dd>${c.referencias}</dd>`}
      <dt>Cobras</dt><dd>${money(s.precio_servicio)}${s.servicio === 'consulta' ? '' : ' o más'}, directo al tutor</dd>
    </dl>`}
    ${c && html`<p class="small muted">Usa estos datos solo para atender esta consulta. Se ocultan tres días después.</p>`}
    ${s.reagenda_propuesta_at && s.reagenda_por !== 'tutor' && html`<${DS.Notice} tone="info">Propusiste mover la consulta a: ${ventana(s.reagenda_propuesta_at, new Date(new Date(s.reagenda_propuesta_at).getTime() + 2 * H))}. Falta que el tutor responda.<//>`}
    ${s.reagenda_propuesta_at && s.reagenda_por === 'tutor' && html`<${DS.Notice} title="El tutor pide otro horario.">
      ${ventana(s.reagenda_propuesta_at, new Date(new Date(s.reagenda_propuesta_at).getTime() + 2 * H))}. Lo eligió entre tus horarios libres. Si no te acomoda, se conserva el horario actual.
      <div class="row" style=${{ marginTop: 8 }}>
        <${DS.Button} size="sm" disabled=${st.ocupado} onClick=${() => responder(true)}>Aceptar cambio<//>
        <${DS.Button} size="sm" variant="secondary" disabled=${st.ocupado} onClick=${() => responder(false)}>Conservar horario<//>
      </div><//>`}
    ${st.error && html`<${DS.Notice} tone="error">${st.error}<//>`}
    ${modo === 'reagendar' && html`<${Reagendar} s=${s} onListo=${() => { setModo(null); toast('Propuesta enviada al tutor.'); recargar(); }} />`}
    ${modo === 'cancelar' && html`<div class="sub-box stack-sm">
      <p><b>¿Cancelar esta consulta?</b></p><p class="small">${s.estado === 'por_pagar'
        ? 'El tutor todavía no ha pagado, así que no se le cobra nada. Le avisamos que cancelaste para que pueda pedir otra consulta.'
        : 'Al tutor se le reembolsa la cuota de servicio completa.'}${puedeCambiar ? ' Si puedes atender otro día, mejor propón otro horario.' : ''}</p>
      <${DS.Field} label="Motivo" maxLength=${300} value=${motivo} onChange=${(e) => setMotivo(e.target.value)} />
      <div class="row"><${DS.Button} size="sm" disabled=${st.ocupado || motivo.trim().length < 5} onClick=${cancelar}>Sí, cancelar<//><${DS.Button} size="sm" variant="secondary" onClick=${() => setModo(null)}>No<//></div>
    </div>`}
    ${modo === 'reporte' && html`<div class="sub-box"><${FormReporte} solicitudId=${s.id} tipos=${['tutor_ausente', 'otro']} onListo=${recargar} /></div>`}
    ${!modo && ['por_pagar', 'confirmada', 'realizada'].includes(s.estado) && html`<div class="row">
      ${puedeCambiar && html`<${DS.Button} size="sm" variant="secondary" onClick=${() => setModo('reagendar')}>Proponer otro horario<//>`}
      ${s.estado !== 'realizada' && html`<${DS.Button} size="sm" variant="ghost" onClick=${() => setModo('cancelar')}>Cancelar consulta<//>`}
      ${empezo && s.estado !== 'por_pagar' && html`<${DS.Button} size="sm" variant="ghost" onClick=${() => setModo('reporte')}>Reportar un problema<//>`}
    </div>`}
  </article>`;
}

export function SolicitudesMvz({ perfil, onPerfil, onConteos }) {
  const { datos, error, recargar } = useDatos(() => api.solicitudesMvz(), []);
  useEffect(() => { const t = setInterval(recargar, 60000); return () => clearInterval(t); }, [recargar]);
  useEffect(() => { onPerfil && onPerfil().catch(() => {}); }, []);
  const ofertas = (datos || []).filter((s) => s.oferta?.estado === 'pendiente' && s.estado === 'buscando');
  // Pendientes del médico: solicitudes nuevas y peticiones de cambio de horario del tutor
  const cambios = (datos || []).filter((s) => s.reagenda_propuesta_at && s.reagenda_por === 'tutor').length;
  useEffect(() => { onConteos && onConteos({ porResponder: ofertas.length + cambios }); }, [ofertas.length, cambios]);

  if (perfil.mvz.estado !== 'aprobado') return html`<${Alta} perfil=${perfil} />`;
  if (error) return html`<div class="page page-narrow"><${ErrorCarga} error=${error} onReintentar=${recargar} /></div>`;
  if (!datos) return html`<${Cargando} />`;
  const m = perfil.mvz;
  const precio = (s) => ({ consulta: m.precio_consulta, vacunacion: m.precio_vacunacion, desparasitacion: m.precio_desparasitacion }[s.servicio]);
  const proximas = datos.filter((s) => ['por_pagar', 'confirmada'].includes(s.estado));
  const pasadas = datos.filter((s) => !ofertas.includes(s) && !proximas.includes(s) && s.estado !== 'buscando').reverse().slice(0, 10);
  const falta = pendientesAlta(perfil).filter((x) => !x[1]);
  return html`<div class="page page-narrow">
    <${PageHead} titulo="Solicitudes" sub="Tienes una hora para aceptar o rechazar cada solicitud." />
    ${!m.recibe_solicitudes && html`<${DS.Notice}>Pausaste tu cuenta: no estás recibiendo solicitudes. <a href="#/servicios">Reactivar</a><//>`}
    ${falta.length > 0 && html`<${DS.Notice}>No apareces ante los tutores porque falta: ${falta.map((x) => x[0].toLowerCase()).join(', ')}.<//>`}
    <h2 class="section-title">Por responder</h2>
    ${!ofertas.length && html`<section class="box vacio"><${Icon} name="inbox" /><div><b>Sin solicitudes por responder</b><p class="small muted">Te avisamos por correo cuando llegue una.</p></div></section>`}
    ${ofertas.map((s) => html`<${Oferta} key=${s.id} s=${s} precio=${precio(s)} recargar=${recargar} />`)}
    <h2 class="section-title">Próximas consultas</h2>
    ${!proximas.length && html`<section class="box vacio"><${Icon} name="cal" /><div><b>Sin consultas próximas</b><p class="small muted">Aquí aparecen las que aceptes.</p></div></section>`}
    ${proximas.map((s) => html`<${Consulta} key=${s.id} s=${s} recargar=${recargar} />`)}
    ${pasadas.length > 0 && html`<h2 class="section-title">Anteriores</h2>`}
    ${pasadas.map((s) => html`<${Consulta} key=${s.id} s=${s} recargar=${recargar} />`)}
    <p class="small muted">LilieVET no te cobra nada, no te paga nada y no toca el dinero de la consulta: el tutor te paga directo por los medios que aceptes.</p>
  </div>`;
}
