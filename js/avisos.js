// Avisos (tutor y médico veterinario): todos los mensajes de LilieVET en un solo lugar.
// Abrir esta pantalla los marca como leídos; los que llegaron sin leer se resaltan mientras sigas aquí.
import { html, DS, Icon, useEffect, fechaHora } from './lib.js';
import { api } from './api.js';
import { PageHead, useDatos, ErrorCarga, Cargando } from './shell.js';

// A dónde lleva cada aviso
function destino(a, rol) {
  if (a.tipo === 'cedula') return ['#/servicios', 'Corregir cédula'];
  if (a.tipo === 'foto') return ['#/servicios', 'Subir otra foto'];
  if (rol === 'mvz') return a.solicitud_id || a.tipo === 'alta' ? ['#/solicitudes', 'Ver solicitudes'] : null;
  if (a.tipo === 'celular') return ['#/solicitar', 'Solicitar consulta'];
  if (a.tipo === 'sin_medico' || a.tipo === 'vencida') return ['#/inicio', 'Buscar de nuevo'];
  if (a.solicitud_id) return ['#/consultas/' + a.solicitud_id, a.tipo === 'aceptada' ? 'Pagar y confirmar' : 'Ver consulta'];
  return null;
}

export function Avisos({ perfil, onPerfil }) {
  const { datos, error, recargar } = useDatos(() => api.avisos(), []);
  // Ya se marcaron como leídos: se actualiza el contador del menú
  useEffect(() => { if (datos) onPerfil().catch(() => {}); }, [!!datos]);

  if (error) return html`<div class="page page-narrow"><${ErrorCarga} error=${error} onReintentar=${recargar} /></div>`;
  if (!datos) return html`<${Cargando} />`;
  const nuevos = datos.filter((a) => !a.leido_at).length;
  return html`<div class="page page-narrow">
    <${PageHead} titulo="Avisos" sub=${nuevos ? (nuevos === 1 ? 'Tienes 1 aviso nuevo.' : `Tienes ${nuevos} avisos nuevos.`) : 'Los mensajes de LilieVET sobre tu cuenta y tus consultas.'} />
    ${!datos.length && html`<section class="box vacio"><${Icon} name="bell" /><div><b>Sin avisos por ahora</b>
      <p class="small muted">Aquí te avisamos cuando un médico acepte, se confirme una consulta o haya algún cambio. También te llegan por correo.</p></div></section>`}
    ${datos.length > 0 && html`<section class="box"><ul class="hist">${datos.map((a) => {
      const ir = destino(a, perfil.rol);
      return html`<li key=${a.id}>
        <b class="small" style=${{ fontWeight: 600 }}>${!a.leido_at && html`<${DS.Badge} tone="nuevo">Nuevo<//> `}${a.titulo}</b>
        <span class="small muted">${a.cuerpo}</span>
        <span class="small muted">${fechaHora(a.created_at)}${ir ? html` · <a href=${ir[0]}>${ir[1]}</a>` : ''}</span>
      </li>`;
    })}</ul></section>`}
    <p class="small muted">Mostramos los 30 más recientes.</p>
  </div>`;
}
