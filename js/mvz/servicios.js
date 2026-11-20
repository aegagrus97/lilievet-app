// Servicios del médico veterinario: cédula, presentación, precios, medios de pago y permisos.
import { html, DS, useState, MEDIO_PAGO, fechaDia, diaISO, soloDigitos, money, FotoMvz } from '../lib.js';
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

// La foto se recorta en cuadro y se reduce a 600 px en el navegador antes de subirla.
// Al redibujarla se pierden los datos ocultos del archivo (por ejemplo, la ubicación GPS del celular).
async function abrirImagen(archivo) {
  try { return await createImageBitmap(archivo, { imageOrientation: 'from-image' }); } catch (e) { /* se intenta con <img> */ }
  const url = URL.createObjectURL(archivo);
  try {
    return await new Promise((ok, mal) => { const i = new Image(); i.onload = () => ok(i); i.onerror = mal; i.src = url; });
  } catch (e) {
    throw new Error('No pudimos abrir esa imagen. Prueba con una foto JPG o PNG.');
  } finally { setTimeout(() => URL.revokeObjectURL(url), 1000); }
}
async function prepararFoto(archivo) {
  if (!/^image\//.test(archivo.type)) throw new Error('Elige una imagen (JPG o PNG).');
  if (archivo.size > 15 * 1024 * 1024) throw new Error('La imagen pesa más de 15 MB. Elige otra.');
  const img = await abrirImagen(archivo);
  const lado = Math.min(img.width, img.height);
  const tam = Math.min(600, lado);
  const c = document.createElement('canvas');
  c.width = tam; c.height = tam;
  c.getContext('2d').drawImage(img, (img.width - lado) / 2, (img.height - lado) / 2, lado, lado, 0, 0, tam, tam);
  for (const q of [0.85, 0.7, 0.55]) {
    const b = await new Promise((ok) => c.toBlob(ok, 'image/jpeg', q));
    if (b && b.size <= 1024 * 1024) return b;
  }
  throw new Error('No pudimos reducir la foto. Elige otra.');
}

function FotoPerfil({ perfil, onPerfil }) {
  const toast = useToast();
  const m = perfil.mvz;
  const [st, correr] = useAccion();
  const nombre = `${perfil.nombre} ${perfil.apellidos}`;
  const elegir = async (e) => {
    const f = e.target.files && e.target.files[0];
    e.target.value = '';
    if (!f) return;
    if (await correr(async () => { await api.subirFotoMvz(await prepararFoto(f)); })) { await onPerfil(); toast('Foto guardada.'); }
  };
  const quitar = async () => { if (await correr(() => api.quitarFotoMvz())) { await onPerfil(); toast('Foto quitada.'); } };
  return html`<div class="stack-sm">
    <div class="foto-editor">
      <${FotoMvz} ruta=${m.foto} nombre=${nombre} tam=${96} />
      <div class="stack-sm">
        <div class="row">
          <label class=${'lv-btn lv-btn-secondary lv-btn-sm' + (st.ocupado ? ' is-disabled' : '')}>
            <input type="file" accept="image/jpeg,image/png,image/webp,image/heic" disabled=${st.ocupado} onChange=${elegir} />
            ${st.ocupado ? 'Subiendo…' : m.foto ? 'Cambiar foto' : 'Subir foto'}
          </label>
          ${m.foto && html`<${DS.Button} size="sm" variant="ghost" disabled=${st.ocupado} onClick=${quitar}>Quitar<//>`}
        </div>
        <span class="small muted">De frente, con buena luz y de preferencia con bata o filipina. Una foto genera confianza: los tutores eligen más a quien pueden ver.</span>
      </div>
    </div>
    ${st.error && html`<${DS.Notice} tone="error">${st.error}<//>`}
  </div>`;
}

// Así ve el tutor tu tarjeta cuando elige médico veterinario
function VistaPrevia({ perfil, d }) {
  const m = perfil.mvz;
  const nombre = `${perfil.nombre} ${perfil.apellidos}`;
  const precio = d.precio_consulta || d.precio_vacunacion || d.precio_desparasitacion;
  return html`<div class="vista-previa stack-sm">
    <span class="small muted"><b>Vista previa:</b> así te ven los tutores al elegir médico.</span>
    <article class="medico" style=${{ margin: 0 }}>
      <div class="medico-cab"><${FotoMvz} ruta=${m.foto} nombre=${nombre} />
        <div><h3 class="lv-card-name">${nombre}</h3><p class="lv-card-sub">Cédula ${d.cedula || '—'} · médico veterinario independiente</p></div></div>
      ${d.presentacion.trim() ? html`<p class="small">${d.presentacion.trim()}</p>` : html`<p class="small muted">Aquí aparecerá tu presentación.</p>`}
      ${precio && html`<div class="lv-price">${money(precio)}<small>${d.precio_consulta ? 'consulta' : 'desde'}, directo al médico</small></div>`}
    </article>
  </div>`;
}

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
    <${Caja} titulo="Tu perfil para los tutores" sub="Esto es lo que ven los tutores cuando eligen médico veterinario: tu foto, tu nombre, tu cédula, tu presentación y tus precios.">
      <div class="stack">
        <${FotoPerfil} perfil=${perfil} onPerfil=${onPerfil} />
        <${DS.Field} as="textarea" label="Presentación" maxLength=${400} value=${d.presentacion} onChange=${set('presentacion')}
          placeholder="MVZ Katia Moctezuma. 10 años de experiencia atendiendo perros y gatos. Cuento con certificación en medicina felina. Me distingo por consultas tranquilas y explicar todo con calma."
          hint=${`Es lo primero que leen los tutores, así que vale la pena llenarlo. Una buena fórmula: tu título y nombre, cuántos años de experiencia tienes y con qué especies, tus certificaciones o especialidades, y qué te distingue. Sin teléfonos ni enlaces. (${d.presentacion.length}/400)`} />
        <${VistaPrevia} perfil=${perfil} d=${d} />
      </div>
    <//>
    <${Caja} titulo="Cédula profesional" extra=${verificada ? html`<${DS.Badge} tone="verificado">Verificada el ${fechaDia(diaISO(m.cedula_verificada_at))}<//>` : html`<${DS.Badge} tone="pendiente">Por verificar<//>`}>
      <div class="stack">
        <${DS.Field} label="Número de cédula" inputMode="numeric" maxLength=${9} disabled=${verificada} value=${d.cedula} onChange=${(e) => setD({ ...d, cedula: soloDigitos(e.target.value) })}
          hint=${verificada ? 'Ya la verificamos. Para corregirla, escríbenos.' : 'La consultamos en el Registro Nacional de Profesionistas. Los tutores ven tu nombre y este número.'} />
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
