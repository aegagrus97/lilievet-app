// Inicio del tutor: qué sigue, avisos y cómo funciona.
import { html, DS, Icon, ventana, SERVICIO, ESTADO, nombreCorto, fechaHora, falta, money } from '../lib.js';
import { api } from '../api.js';
import { PageHead, useDatos, ir, ErrorCarga } from '../shell.js';
import { Caja } from '../cuenta.js';
import { AvisoUrgencias } from '../legal.js';

const VIVAS = ['buscando', 'por_pagar', 'confirmada'];

export function InicioTutor({ perfil }) {
  const sols = useDatos(() => api.misSolicitudes(), []);
  const avisos = useDatos(() => api.avisos(), []);
  const vivas = (sols.datos || []).filter((s) => VIVAS.includes(s.estado)).sort((a, b) => new Date(a.inicia_at) - new Date(b.inicia_at));
  const cuota = perfil.parametros.cuota;

  return html`<div class="page">
    <${PageHead} titulo=${`Hola, ${nombreCorto(perfil)}`} sub="Tu vet a domicilio.">
      <${DS.Button} onClick=${() => ir('solicitar')}><${Icon} name="plus" /> Solicitar consulta<//>
    <//>
    ${perfil.parametros.exigir_telefono && !perfil.telefono_verificado && html`<${DS.Notice} title="Verifica tu celular.">Lo necesitas para solicitar una consulta. <a href="#/perfil">Verificar ahora</a><//>`}
    <div class="grid-2">
      <div class="stack">
        ${sols.error && html`<${ErrorCarga} error=${sols.error} onReintentar=${sols.recargar} />`}
        ${sols.datos && !vivas.length && html`<${DS.EmptyState} who="ambos" title="¿Agendamos una consulta?"
            action=${html`<${DS.Button} block onClick=${() => ir('solicitar')}>Solicitar consulta<//>`}>
          Elige el servicio, el horario y hasta tres médicos veterinarios. Solo pagas la cuota de servicio cuando uno acepta.<//>`}
        ${vivas.map((s) => html`<article class="box" key=${s.id}>
          <div class="spread"><strong class="section-title">${SERVICIO[s.servicio]} para ${s.mascota}</strong><${DS.Badge} tone=${ESTADO[s.estado][0]}>${ESTADO[s.estado][1]}<//></div>
          <p style=${{ marginTop: 4 }}>${ventana(s.inicia_at, s.termina_at)}</p>
          <p class="small muted" style=${{ marginTop: 8 }}>${ESTADO[s.estado][2]}</p>
          ${s.estado === 'por_pagar' && html`<p class="small" style=${{ marginTop: 8 }}>Tienes ${falta(s.pagar_antes_de)} para pagar la cuota de ${money(s.cuota)}.</p>`}
          <div class="row" style=${{ marginTop: 12 }}>
            <${DS.Button} size="sm" variant=${s.estado === 'por_pagar' ? 'primary' : 'secondary'} onClick=${() => ir('consultas/' + s.id)}>${s.estado === 'por_pagar' ? 'Pagar y confirmar' : 'Ver detalle'}<//>
          </div>
        </article>`)}
        <${AvisoUrgencias} />
      </div>
      <div class="stack">
        <${Caja} titulo="Avisos">
          ${avisos.datos && !avisos.datos.length && html`<p class="small muted">Aquí verás las novedades de tus consultas.</p>`}
          <ul class="hist">${(avisos.datos || []).slice(0, 6).map((a) => html`<li key=${a.id}>
            <b class="small" style=${{ fontWeight: 600 }}>${a.titulo}</b><span class="small muted">${a.cuerpo}</span><span class="small muted">${fechaHora(a.created_at)}</span></li>`)}</ul>
        <//>
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
