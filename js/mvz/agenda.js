// Agenda del médico veterinario: zonas, horario semanal por bloques de 2 horas y días bloqueados.
import { html, DS, Icon, useState, DIAS, HORAS, bloqueTxt, fechaDia, hoyISO } from '../lib.js';
import { api } from '../api.js';
import { PageHead, useToast } from '../shell.js';
import { Caja, useAccion } from '../cuenta.js';
import { cargaMvz } from './servicios.js';

const clave = (dia, hora) => `${dia}-${hora}`;

export function Agenda({ perfil, onPerfil }) {
  const toast = useToast();
  const m = perfil.mvz;
  const [zonas, setZonas] = useState(m.zonas);
  const [bloques, setBloques] = useState(() => new Set(m.horario.map((b) => clave(b.dia, b.hora))));
  const [fecha, setFecha] = useState('');
  const [stZ, correrZ] = useAccion();
  const [stH, correrH] = useAccion();
  const [stB, correrB] = useAccion();

  const zona = (a) => () => setZonas(zonas.includes(a) ? zonas.filter((x) => x !== a) : [...zonas, a]);
  const alternar = (k) => () => { const n = new Set(bloques); n.has(k) ? n.delete(k) : n.add(k); setBloques(n); };
  const guardarZonas = async () => { if (await correrZ(() => api.guardarPerfilMvz(cargaMvz(m, { zonas })))) { await onPerfil(); toast('Zonas guardadas.'); } };
  const guardarHorario = async () => {
    const lista = [...bloques].map((k) => { const [dia, hora] = k.split('-').map(Number); return { dia, hora }; });
    if (await correrH(() => api.guardarHorario(lista))) { await onPerfil(); toast('Horario guardado.'); }
  };
  const bloquear = async (f, si) => { if (await correrB(() => api.bloquearDia(f, si))) { await onPerfil(); setFecha(''); } };

  return html`<div class="page">
    <${PageHead} titulo="Agenda" sub="Dónde y cuándo puedes atender. Los tutores solo ven los bloques libres." />
    <${Caja} titulo="Zonas donde atiendes" sub="Elige las alcaldías a las que sí llegas a tiempo.">
      <div class="stack">
        <div class="row">${perfil.parametros.alcaldias.map((a) => html`<${DS.Chip} key=${a} checked=${zonas.includes(a)} onChange=${zona(a)}>${a}<//>`)}</div>
        ${stZ.error && html`<${DS.Notice} tone="error">${stZ.error}<//>`}
        <div><${DS.Button} variant="secondary" disabled=${stZ.ocupado} onClick=${guardarZonas}>Guardar zonas<//></div>
      </div>
    <//>
    <${Caja} titulo="Horario semanal" sub="Marca los bloques de dos horas en los que recibes solicitudes. Llegas al domicilio dentro del bloque.">
      <div class="stack">
        <div class="table-wrap"><table class="table horario-t">
          <thead><tr><th>Bloque</th>${DIAS.map((x) => html`<th key=${x} class="c">${x.slice(0, 3)}</th>`)}</tr></thead>
          <tbody>${HORAS.map((h) => html`<tr key=${h}><td class="nw">${bloqueTxt(h)}</td>
            ${DIAS.map((x, i) => { const k = clave(i + 1, h); return html`<td key=${k} class="c"><label class="celda"><input type="checkbox" checked=${bloques.has(k)} onChange=${alternar(k)} aria-label=${`${x}, ${bloqueTxt(h)}`} /><span aria-hidden="true"></span></label></td>`; })}
          </tr>`)}</tbody>
        </table></div>
        ${stH.error && html`<${DS.Notice} tone="error">${stH.error}<//>`}
        <div class="row"><${DS.Button} disabled=${stH.ocupado} onClick=${guardarHorario}>${stH.ocupado ? 'Guardando…' : 'Guardar horario'}<//><span class="small muted">${bloques.size} bloques a la semana</span></div>
      </div>
    <//>
    <${Caja} titulo="Días bloqueados" sub="Vacaciones, congresos o días que no atiendes.">
      <div class="stack">
        <div class="row" style=${{ alignItems: 'flex-end' }}>
          <${DS.Field} label="Día" type="date" min=${hoyISO()} value=${fecha} onChange=${(e) => setFecha(e.target.value)} />
          <${DS.Button} variant="secondary" disabled=${!fecha || stB.ocupado} onClick=${() => bloquear(fecha, true)}>Bloquear día<//>
        </div>
        ${stB.error && html`<${DS.Notice} tone="error">${stB.error}<//>`}
        <div class="row">${m.bloqueos.map((f) => html`<button key=${f} type="button" class="dia-chip" onClick=${() => bloquear(f, false)} aria-label=${`Volver a abrir ${fechaDia(f)}`}>${fechaDia(f)} <${Icon} name="x" /></button>`)}
          ${!m.bloqueos.length && html`<span class="small muted">No tienes días bloqueados.</span>`}</div>
      </div>
    <//>
  </div>`;
}
