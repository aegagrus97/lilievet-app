// Servicios del médico veterinario: cédula, presentación, precios, medios de pago y permisos.
import { html, DS, useState, MEDIO_PAGO, fechaDia, diaISO, soloDigitos } from '../lib.js';
import { api } from '../api.js';
import { PageHead, useToast } from '../shell.js';
import { Caja, useAccion } from '../cuenta.js';

// La base guarda el perfil completo cada vez: siempre se manda todo
export const cargaMvz = (m, cambios = {}) => ({
  cedula: m.cedula || '', presentacion: m.presentacion || '',
  precio_consulta: m.precio_consulta ?? '', precio_vacunacion: m.precio_vacunacion ?? '', precio_desparasitacion: m.precio_desparasitacion ?? '',
  medios_pago: m.medios_pago || [], zonas: m.zonas || [], comparte_telefono: m.comparte_telefono ? 'true' : 'false',
  recibe_solicitudes: m.recibe_solicitudes !== false, ...cambios,
});

export function Servicios({ perfil, onPerfil }) {
  const toast = useToast();
  const m = perfil.mvz;
  const [d, setD] = useState(() => ({ ...cargaMvz(m), comparte_telefono: !!m.comparte_telefono }));
  const [st, correr] = useAccion();
  const set = (k) => (e) => setD({ ...d, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value });
  const precio = (k) => (e) => setD({ ...d, [k]: soloDigitos(e.target.value).slice(0, 5) });
  const medio = (k) => () => setD({ ...d, medios_pago: d.medios_pago.includes(k) ? d.medios_pago.filter((x) => x !== k) : [...d.medios_pago, k] });
  const guardar = async () => {
    const ok = await correr(() => api.guardarPerfilMvz({ ...d, cedula: soloDigitos(d.cedula), comparte_telefono: d.comparte_telefono ? 'true' : 'false' }));
    if (ok) { await onPerfil(); toast('Servicios guardados.'); }
  };
  const verificada = !!m.cedula_verificada_at;
  return html`<div class="page page-narrow">
    <${PageHead} titulo="Servicios" sub="Lo que los tutores ven de ti antes de solicitar." />
    <${Caja} titulo="Cédula profesional" extra=${verificada ? html`<${DS.Badge} tone="verificado">Verificada el ${fechaDia(diaISO(m.cedula_verificada_at))}<//>` : html`<${DS.Badge} tone="pendiente">Por verificar<//>`}>
      <div class="stack">
        <${DS.Field} label="Número de cédula" inputMode="numeric" maxLength=${9} disabled=${verificada} value=${d.cedula} onChange=${(e) => setD({ ...d, cedula: soloDigitos(e.target.value) })}
          hint=${verificada ? 'Ya la verificamos. Para corregirla, escríbenos.' : 'La consultamos en el Registro Nacional de Profesionistas. Los tutores ven tu nombre y este número.'} />
        <${DS.Field} as="textarea" label="Presentación (opcional)" maxLength=${400} value=${d.presentacion} onChange=${set('presentacion')} hint="Tu experiencia y cómo trabajas, en un par de frases. Sin teléfonos ni enlaces." />
      </div>
    <//>
    <${Caja} titulo="Precios" sub="El tutor te paga directo. LilieVET no cobra comisión ni retiene nada. Deja en blanco lo que no ofrezcas.">
      <div class="stack">
        <${DS.Field} label="Consulta general" inputMode="numeric" value=${d.precio_consulta} onChange=${precio('precio_consulta')} hint="Precio cerrado, en pesos, con tu traslado incluido." />
        <div class="field-row">
          <${DS.Field} label="Vacunación, desde" inputMode="numeric" value=${d.precio_vacunacion} onChange=${precio('precio_vacunacion')} />
          <${DS.Field} label="Desparasitación, desde" inputMode="numeric" value=${d.precio_desparasitacion} onChange=${precio('precio_desparasitacion')} />
        </div>
        <div class="stack-sm"><span class="small"><b>Medios de pago que aceptas</b></span>
          <div class="row">${Object.keys(MEDIO_PAGO).map((k) => html`<${DS.Chip} key=${k} checked=${d.medios_pago.includes(k)} onChange=${medio(k)}>${MEDIO_PAGO[k]}<//>`)}</div></div>
      </div>
    <//>
    <${Caja} titulo="Contacto y disponibilidad">
      <div class="stack-sm">
        <label class="check"><input type="checkbox" checked=${d.comparte_telefono} onChange=${set('comparte_telefono')} />
          <span>Acepto que LilieVET comparta mi nombre y mi celular con el tutor <b>cuando su consulta conmigo quede confirmada</b>. Es necesario para recibir solicitudes.</span></label>
        <label class="check"><input type="checkbox" checked=${d.recibe_solicitudes} onChange=${set('recibe_solicitudes')} />
          <span>Quiero recibir solicitudes. Desmárcalo para pausar tu cuenta unos días.</span></label>
      </div>
    <//>
    ${st.error && html`<${DS.Notice} tone="error">${st.error}<//>`}
    <div class="row"><${DS.Button} disabled=${st.ocupado} onClick=${guardar}>${st.ocupado ? 'Guardando…' : 'Guardar servicios'}<//></div>
    <p class="small muted">Las recetas y documentos clínicos son tuyos: van con tus datos y tu cédula, sin la marca ni el teléfono de LilieVET.</p>
  </div>`;
}
