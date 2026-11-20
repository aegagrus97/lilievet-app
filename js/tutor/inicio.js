// Inicio del tutor: panorama de su cuenta (qué sigue con cada consulta) y cómo funciona.
import { html, DS, Icon, SERVICIO, ventana, nombreCorto, fechaDia, diaISO, falta, money } from '../lib.js';
import { api } from '../api.js';
import { PageHead, useDatos, ir, ErrorCarga } from '../shell.js';
import { Caja } from '../cuenta.js';
import { AvisoUrgencias } from '../legal.js';
import { prellenarSolicitud } from './solicitar.js';

const VIVAS = ['buscando', 'por_pagar', 'confirmada'];
const H = 36e5;
const buscarDeNuevo = (s) => { prellenarSolicitud(s); ir('solicitar'); };

// Una línea del panorama: qué pasa, el detalle y qué puede hacer
const Linea = ({ icono, tono, titulo, detalle, accion }) => html`<li class=${'panorama-item' + (tono ? ' ' + tono : '')}>
  <${Icon} name=${icono} />
  <div class="stack-sm" style=${{ flex: 1 }}><b>${titulo}</b>${detalle && html`<span class="small muted">${detalle}</span>`}</div>
  ${accion}
</li>`;

function lineas(sols, perfil) {
  const out = [];
  const vivas = sols.filter((s) => VIVAS.includes(s.estado)).sort((a, b) => new Date(a.inicia_at) - new Date(b.inicia_at));
  for (const s of vivas) {
    const que = `${SERVICIO[s.servicio]} para ${s.mascota}`;
    const propuestaVet = s.reagenda_propuesta_at && s.reagenda_por !== 'tutor';
    if (s.estado === 'por_pagar' && propuestaVet) {
      out.push({ k: s.id + '-rg', icono: 'cal', tono: 'atencion', titulo: 'Tu vet propone cambiar el horario.',
        detalle: `${que}. Revisa el nuevo horario; si lo aceptas, pagas la cuota para esa fecha.`,
        accion: html`<${DS.Button} size="sm" onClick=${() => ir('consultas/' + s.id)}>Revisar<//>` });
    }
    if (s.estado === 'por_pagar') {
      out.push({ k: s.id, icono: 'wallet', tono: 'atencion', titulo: 'Tu vet aceptó y estamos esperando tu pago.',
        detalle: `${que} · ${ventana(s.inicia_at, s.termina_at)}. Tienes ${falta(s.pagar_antes_de)} para pagar la cuota de ${money(s.cuota)}; si no, el horario se libera.`,
        accion: html`<${DS.Button} size="sm" onClick=${() => ir(`consultas/${s.id}/pagar`)}>Pagar y confirmar<//>` });
    } else if (s.estado === 'confirmada') {
      const pedido = s.reagenda_propuesta_at && s.reagenda_por === 'tutor';
      out.push({ k: s.id, icono: 'cal', tono: propuestaVet ? 'atencion' : 'ok',
        titulo: propuestaVet ? 'Tu vet propone cambiar el horario de tu consulta.' : `Tienes una consulta agendada para ${ventana(s.inicia_at, s.termina_at)}.`,
        detalle: `${que}${s.medico ? ` con ${s.medico.nombre}` : ''}.${propuestaVet ? ' Acepta el cambio o conserva el horario.' : pedido ? ' Pediste otro horario; falta que tu vet responda.' : ''}`,
        accion: html`<${DS.Button} size="sm" variant=${propuestaVet ? 'primary' : 'secondary'} onClick=${() => ir('consultas/' + s.id)}>${propuestaVet ? 'Revisar' : 'Ver detalle'}<//>` });
    } else {
      const op = (s.opciones || []).find((o) => o.estado === 'pendiente');
      out.push({ k: s.id, icono: 'clock', titulo: 'Estamos esperando que un vet responda tu solicitud.',
        detalle: `${que} · ${ventana(s.inicia_at, s.termina_at)}.${op ? ` La tiene ${op.nombre}${op.vence_at ? `; le quedan ${falta(op.vence_at)} para responder` : ''}.` : ''}`,
        accion: html`<${DS.Button} size="sm" variant="secondary" onClick=${() => ir('consultas/' + s.id)}>Ver detalle<//>` });
    }
  }
  // La última solicitud que se quedó sin médico o venció (de los últimos 3 días), si después no pidió otra
  const ultimaViva = Math.max(0, ...vivas.map((s) => new Date(s.created_at).getTime()));
  const caida = sols.filter((s) => ['sin_medico', 'vencida'].includes(s.estado) && Date.now() - new Date(s.created_at) < 3 * 24 * H
    && new Date(s.created_at).getTime() > ultimaViva).sort((a, b) => new Date(b.created_at) - new Date(a.created_at))[0];
  if (caida) {
    out.push({ k: caida.id, icono: 'alert', tono: 'atencion',
      titulo: caida.estado === 'sin_medico' ? 'No encontramos vets disponibles. ¿Buscamos de nuevo?' : 'Tu solicitud venció porque no se pagó a tiempo. ¿La buscamos de nuevo?',
      detalle: `${SERVICIO[caida.servicio]} para ${caida.mascota}, ${fechaDia(diaISO(caida.inicia_at))}. No se te cobró nada. Usamos los mismos datos; solo eliges otro horario.`,
      accion: html`<${DS.Button} size="sm" onClick=${() => buscarDeNuevo(caida)}>Buscar de nuevo<//>` });
  }
  for (const s of sols.filter((x) => x.encuesta_pendiente).slice(0, 1)) {
    out.push({ k: 'enc-' + s.id, icono: 'star', titulo: `¿Cómo te fue en la consulta de ${s.mascota}?`,
      detalle: 'Tu respuesta es privada y nos ayuda a mejorar el servicio.',
      accion: html`<${DS.Button} size="sm" variant="secondary" onClick=${() => ir('consultas/' + s.id)}>Responder<//>` });
  }
  if (perfil.avisos_sin_leer > 0) {
    out.push({ k: 'avisos', icono: 'bell', titulo: perfil.avisos_sin_leer === 1 ? 'Tienes 1 aviso nuevo.' : `Tienes ${perfil.avisos_sin_leer} avisos nuevos.`,
      accion: html`<${DS.Button} size="sm" variant="ghost" onClick=${() => ir('avisos')}>Ver avisos<//>` });
  }
  return out;
}

export function InicioTutor({ perfil }) {
  const sols = useDatos(() => api.misSolicitudes(), []);
  const cuota = perfil.parametros.cuota;
  const lista = sols.datos ? lineas(sols.datos, perfil) : [];
  const hayVivas = (sols.datos || []).some((s) => VIVAS.includes(s.estado));

  return html`<div class="page">
    <${PageHead} titulo=${`Hola, ${nombreCorto(perfil)}`} sub="Tu vet a domicilio.">
      <${DS.Button} onClick=${() => ir('solicitar')}><${Icon} name="plus" /> Solicitar consulta<//>
    <//>
    ${perfil.parametros.exigir_telefono && !perfil.telefono_verificado && html`<${DS.Notice} title="Verifica tu celular.">Lo necesitas para solicitar una consulta. <a href="#/perfil">Verificar ahora</a><//>`}
    <div class="grid-2">
      <div class="stack">
        ${sols.error && html`<${ErrorCarga} error=${sols.error} onReintentar=${sols.recargar} />`}
        ${!sols.datos && !sols.error && html`<p class="muted">Revisando tu cuenta…</p>`}
        ${lista.length > 0 && html`<${Caja} titulo="Tu cuenta hoy">
          <ul class="panorama">${lista.map((x) => html`<${Linea} key=${x.k} ...${x} />`)}</ul>
        <//>`}
        ${sols.datos && !hayVivas && html`<${DS.EmptyState} who="ambos" title="¿Agendamos una consulta?"
            action=${html`<${DS.Button} block onClick=${() => ir('solicitar')}>Solicitar consulta<//>`}>
          Elige el servicio, el horario y hasta tres médicos veterinarios. Solo pagas la cuota de servicio cuando uno acepta.<//>`}
        <${AvisoUrgencias} />
      </div>
      <div class="stack">
        <${Caja} titulo="Cómo funciona">
          <ol class="guia" style=${{ color: 'var(--ink)' }}>
            <li>Eliges servicio, horario y de uno a tres médicos veterinarios de tu zona.</li>
            <li>El médico acepta o rechaza. Si no responde en una hora, pasa a tu siguiente opción.</li>
            <li>Cuando uno acepta, pagas la cuota de servicio de ${money(cuota)} y recibes sus datos de contacto.</li>
            <li>La consulta, vacunas y productos los pagas directo al médico veterinario.</li>
          </ol>
          <p class="small muted" style=${{ marginTop: 12 }}>Si nadie acepta, no se cobra. Si cancelas con más de ${perfil.parametros.horas_cancelacion} horas, te reembolsamos la cuota completa.</p>
        <//>
      </div>
    </div>
  </div>`;
}
