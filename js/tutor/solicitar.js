// Solicitar una consulta: servicio → domicilio → horario → médicos (1ª, 2ª y 3ª opción) → confirmar.
import { html, DS, Icon, useState, useEffect, SERVICIO, SERVICIO_DESC, ESPECIE, SEXO, mascotaTxt, MEDIO_PAGO, hora, diaRelativo, diaISO, ventana, fechaDia, money, leyenda, FotoMvz, alcaldiaDeCP } from '../lib.js';
import { api } from '../api.js';
import { PageHead, ir, useToast } from '../shell.js';
import { useAccion } from '../cuenta.js';
import { AvisoUrgencias } from '../legal.js';

const PASOS = ['Servicio', 'Domicilio', 'Horario', 'Médico veterinario', 'Confirmar'];
const ORDEN = ['Primera opción', 'Segunda opción', 'Tercera opción'];

// "Buscar de nuevo" desde Inicio: la siguiente solicitud empieza con los datos de una anterior
let borrador = null;
export const prellenarSolicitud = (s) => { borrador = s; };
const VACIA = { servicio: 'consulta', mascota: '', especie: 'perro', sexo: '', edad: '', edadUnidad: 'anios', motivo: '', alcaldia: '', colonia: '', calle_numero: '', cp: '', referencias: '', inicia_at: null, medicos: [], no_es_urgencia: false, acepta_transferencia: false };

// Borrador en esta pestaña (sessionStorage): sobrevive a recargar la página y se borra al cerrar la pestaña.
// Lleva el domicilio, así que no se guarda de forma permanente. Caduca a las 12 horas.
const claveBorrador = (uid) => `lv-solicitud-${uid}`;
const DOCE_H = 12 * 36e5;
function leerGuardado(uid) {
  try {
    const g = JSON.parse(sessionStorage.getItem(claveBorrador(uid)) || 'null');
    if (!g || typeof g !== 'object' || !g.d || Date.now() - g.guardado > DOCE_H) return null;
    const d = { ...VACIA, ...g.d, no_es_urgencia: false, acepta_transferencia: false }; // el consentimiento se vuelve a pedir
    let paso = Math.min(Math.max(Number(g.paso) || 1, 1), 5);
    if (d.inicia_at && new Date(d.inicia_at).getTime() < Date.now()) { d.inicia_at = null; d.medicos = []; }
    if (paso >= 4 && !d.inicia_at) paso = 3;
    if (paso >= 5 && !(d.medicos || []).length) paso = 4;
    return [d, paso];
  } catch (e) { return null; }
}
const vacio = (d) => JSON.stringify({ ...d, no_es_urgencia: false, acepta_transferencia: false }) === JSON.stringify(VACIA);
export const guardarBorrador = (uid, d, paso) => {
  try {
    if (paso === 1 && vacio(d)) sessionStorage.removeItem(claveBorrador(uid)); // nada que guardar todavía
    else sessionStorage.setItem(claveBorrador(uid), JSON.stringify({ d, paso, guardado: Date.now() }));
  } catch (e) { /* sin almacenamiento */ }
};
export const borrarBorrador = (uid) => { try { sessionStorage.removeItem(claveBorrador(uid)); } catch (e) { /* nada */ } };

function desdeBorrador(uid) {
  const b = borrador; borrador = null;
  if (!b) {
    const g = leerGuardado(uid);
    return g ? [g[0], g[1], true] : [VACIA, 1, false];
  }
  const base = VACIA;
  const m = b.edad_meses;
  const enAnios = m != null && m >= 12 && m % 12 === 0;
  const d = { ...base, servicio: b.servicio, mascota: b.mascota || '', especie: b.especie || 'perro', sexo: b.sexo || '',
    edad: m == null ? '' : String(enAnios ? m / 12 : m), edadUnidad: enAnios ? 'anios' : 'meses', motivo: b.motivo || '',
    alcaldia: b.alcaldia || '', colonia: b.colonia || '', calle_numero: b.calle_numero || '', cp: b.cp || '', referencias: b.referencias || '' };
  // Con los datos completos se va directo a elegir horario; si falta algo, desde el principio
  const completo = d.sexo && d.edad !== '' && d.alcaldia && d.colonia && d.calle_numero && /^\d{5}$/.test(d.cp) && (d.servicio !== 'consulta' || d.motivo.length >= 10);
  return [d, completo ? 3 : 1, false];
}

// "Para continuar falta: …" bajo un botón deshabilitado
const lista = (xs) => (xs.length > 1 ? `${xs.slice(0, -1).join(', ')} y ${xs[xs.length - 1]}` : xs[0]);
const Falta = ({ que }) => (que.length ? html`<p class="small falta-aviso" role="status"><${Icon} name="alert" /> Para continuar falta ${lista(que)}.</p>` : null);

export function Solicitar({ perfil }) {
  const toast = useToast();
  const P = perfil.parametros;
  const [inicial] = useState(() => desdeBorrador(perfil.id));
  const [paso, setPaso] = useState(inicial[1]);
  // La alcaldía siempre sale del código postal (también en borradores y en "Buscar de nuevo")
  const [d, setD] = useState(() => ({ ...inicial[0], alcaldia: alcaldiaDeCP(inicial[0].cp, P.alcaldias) || '' }));
  const [recuperado, setRecuperado] = useState(inicial[2]);
  // Se guarda el borrador conforme avanza (y el paso donde va)
  useEffect(() => { guardarBorrador(perfil.id, d, paso); }, [d, paso]);
  const empezarDeNuevo = () => { borrarBorrador(perfil.id); setD(VACIA); setPaso(1); setRecuperado(false); setBloques(null); setMedicos(null); setDia(null); };
  const [bloques, setBloques] = useState(null);
  const [dia, setDia] = useState(null);
  const [medicos, setMedicos] = useState(null);
  const [carga, setCarga] = useState(null);
  const [st, correr] = useAccion();
  const set = (k) => (e) => setD({ ...d, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value });

  // Horarios con médicos disponibles en la zona
  useEffect(() => {
    if (paso !== 3) return;
    setBloques(null); setCarga(null);
    api.bloquesEnZona(d.alcaldia, d.servicio).then((b) => { setBloques(b); setDia((x) => x || (b[0] && diaISO(b[0].inicia_at))); }).catch((e) => setCarga(e.message));
  }, [paso, d.alcaldia, d.servicio]);
  // Médicos disponibles en el horario elegido; si solo hay uno, queda elegido
  useEffect(() => {
    if (paso !== 4 || !d.inicia_at) return;
    setMedicos(null); setCarga(null);
    api.medicosEnBloque(d.alcaldia, d.servicio, d.inicia_at).then((m) => {
      setMedicos(m);
      setD((x) => ({ ...x, medicos: m.length === 1 ? [m[0].id] : x.medicos.filter((id) => m.some((y) => y.id === id)) }));
    }).catch((e) => setCarga(e.message));
  }, [paso, d.inicia_at]);

  // Máximo tres solicitudes en curso (regla de la base): se avisa desde el inicio, no hasta el último paso
  const [enCurso, setEnCurso] = useState(0);
  useEffect(() => {
    api.misSolicitudes().then((l) => setEnCurso(l.filter((x) => ['buscando', 'por_pagar', 'confirmada'].includes(x.estado)).length)).catch(() => {});
  }, []);
  if (enCurso >= 3) {
    return html`<div class="page page-narrow"><${PageHead} titulo="Solicitar consulta" />
      <${DS.Notice} title="Ya tienes tres solicitudes en curso.">
        Es el máximo al mismo tiempo. Cuando alguna se confirme y se realice, o si cancelas una, podrás pedir otra. <a href="#/consultas">Ver mis consultas</a><//></div>`;
  }

  if (P.exigir_telefono && !perfil.telefono_verificado) {
    return html`<div class="page page-narrow"><${PageHead} titulo="Solicitar consulta" />
      <${DS.EmptyState} who="lilie" title="Primero verifica tu celular" action=${html`<${DS.Button} block onClick=${() => ir('perfil')}>Ir a mi perfil<//>`}>
        Así el médico veterinario puede contactarte cuando tu consulta quede confirmada.<//></div>`;
  }

  const edadMeses = /^\d{1,2}$/.test(String(d.edad)) ? Number(d.edad) * (d.edadUnidad === 'anios' ? 12 : 1) : null;
  const motivoMin = d.servicio === 'consulta' ? 10 : 0;
  const largoMotivo = d.motivo.trim().length;
  // Lo que falta en cada paso: se muestra bajo el botón para que nadie se quede sin saber por qué no avanza
  const faltan1 = [
    !d.mascota.trim() && 'el nombre de tu mascota',
    !d.sexo && 'si es macho o hembra',
    edadMeses === null && 'su edad',
    edadMeses !== null && edadMeses > 360 && 'una edad de hasta 30 años',
    largoMotivo < motivoMin && (largoMotivo ? `contar un poco más de qué le pasa (mínimo ${motivoMin} caracteres; llevas ${largoMotivo})` : `contar qué le pasa a tu mascota (mínimo ${motivoMin} caracteres)`),
  ].filter(Boolean);
  const cpFuera = /^\d{5}$/.test(d.cp) && !alcaldiaDeCP(d.cp, P.alcaldias);
  const faltan2 = [
    !/^\d{5}$/.test(d.cp) && 'el código postal de 5 dígitos',
    cpFuera && 'un código postal de la Ciudad de México',
    d.colonia.trim().length < 2 && 'la colonia',
    d.calle_numero.trim().length < 3 && 'la calle y el número',
  ].filter(Boolean);
  const ok1 = !faltan1.length;
  const ok2 = !faltan2.length;
  const elegidos = d.medicos.map((id) => (medicos || []).find((m) => m.id === id)).filter(Boolean);
  const precios = elegidos.map((m) => m.precio);
  const rango = precios.length ? (Math.min(...precios) === Math.max(...precios) ? money(precios[0]) : `${money(Math.min(...precios))} a ${money(Math.max(...precios))}`) : '';
  const dias = [...new Set((bloques || []).map((b) => diaISO(b.inicia_at)))];
  const alternar = (id) => setD({ ...d, medicos: d.medicos.includes(id) ? d.medicos.filter((x) => x !== id) : d.medicos.length < 3 ? [...d.medicos, id] : d.medicos });

  const enviar = async () => {
    const { edad, edadUnidad, ...resto } = d;
    const id = await correr(() => api.crearSolicitud({ ...resto, mascota: d.mascota.trim(), motivo: d.motivo.trim(), edad_meses: edadMeses, no_es_urgencia: 'true', acepta_transferencia: 'true' }));
    if (id) { borrarBorrador(perfil.id); toast('Solicitud enviada.', { sparks: true }); ir('consultas'); }
  };

  return html`<div class="page page-narrow">
    <${PageHead} titulo="Solicitar consulta" />
    ${recuperado && html`<${DS.Notice} tone="info">Recuperamos lo que llevabas de tu solicitud. <button type="button" class="linkish" onClick=${empezarDeNuevo}>Empezar de nuevo</button><//>`}
    <${DS.Steps} current=${paso} total=${5} label=${PASOS[paso - 1]} />

    ${paso === 1 && html`<section class="box stack">
      <${AvisoUrgencias} />
      <div class="stack-sm" role="radiogroup" aria-label="Servicio">
        ${Object.keys(SERVICIO).map((k) => html`<${DS.OptionCard} key=${k} name="servicio" title=${SERVICIO[k]} description=${SERVICIO_DESC[k]} checked=${d.servicio === k} onChange=${() => setD({ ...d, servicio: k, inicia_at: null, medicos: [] })} />`)}
      </div>
      <h3 class="section-title">Tu mascota</h3>
      <${DS.Field} label="Nombre de tu mascota" maxLength=${40} value=${d.mascota} onChange=${set('mascota')} />
      <div class="stack-sm"><span class="small"><b>Especie</b></span>
        <div class="row" role="radiogroup" aria-label="Especie">
          ${Object.keys(ESPECIE).map((k) => html`<${DS.Chip} key=${k} type="radio" name="especie" checked=${d.especie === k} onChange=${() => setD({ ...d, especie: k })}>${ESPECIE[k]}<//>`)}
        </div></div>
      <div class="stack-sm"><span class="small"><b>Sexo</b></span>
        <div class="row" role="radiogroup" aria-label="Sexo">
          ${Object.keys(SEXO).map((k) => html`<${DS.Chip} key=${k} type="radio" name="sexo" checked=${d.sexo === k} onChange=${() => setD({ ...d, sexo: k })}>${SEXO[k]}<//>`)}
        </div></div>
      <div class="field-row">
        <${DS.Field} label="Edad" inputMode="numeric" maxLength=${2} value=${d.edad} onChange=${(e) => setD({ ...d, edad: e.target.value.replace(/\D/g, '').slice(0, 2) })} hint="Si no la sabes exacta, una aproximada." />
        <${DS.Field} as="select" label="En" value=${d.edadUnidad} onChange=${set('edadUnidad')} options=${[{ value: 'anios', label: 'Años' }, { value: 'meses', label: 'Meses' }]} />
      </div>
      <${DS.Field} as="textarea" label=${d.servicio === 'consulta' ? '¿Qué le pasa a tu mascota?' : '¿Algo que deba saber el médico? (opcional)'} maxLength=${400} value=${d.motivo} onChange=${set('motivo')}
        hint=${d.servicio === 'consulta'
          ? `En pocas palabras: qué notas y desde cuándo (mínimo ${motivoMin} caracteres; llevas ${largoMotivo}). Lo lee el médico veterinario al recibir tu solicitud para ir preparado. No escribas teléfonos ni tu dirección.`
          : 'Por ejemplo, su última vacuna o desparasitación. No escribas teléfonos ni tu dirección.'} />
      <p class="small muted">Si tu mascota tiene dificultad para respirar, convulsiones, sangrado abundante o se envenenó, no esperes: llévala a un hospital veterinario.</p>
      <div class="row"><${DS.Button} disabled=${!ok1} onClick=${() => setPaso(2)}>Continuar<//></div>
      <${Falta} que=${faltan1} />
    </section>`}

    ${paso === 2 && html`<section class="box stack">
      <${DS.Notice} tone="info">Tu domicilio completo solo se comparte con el médico veterinario cuando la consulta queda confirmada. Antes solo ve la colonia y la alcaldía.<//>
      <div class="field-row">
        <${DS.Field} label="Código postal" inputMode="numeric" maxLength=${5} autoComplete="postal-code" value=${d.cp}
          onChange=${(e) => { const cp = e.target.value.replace(/\D/g, '').slice(0, 5); const a = alcaldiaDeCP(cp, P.alcaldias) || ''; setD({ ...d, cp, alcaldia: a, ...(a !== d.alcaldia ? { inicia_at: null, medicos: [] } : {}) }); }}
          hint=${cpFuera ? '' : 'Con tu código postal sabemos tu alcaldía.'} />
        <div class="stack-sm"><span class="small"><b>Alcaldía</b></span>
          <p class="cp-alcaldia">${d.alcaldia || html`<span class="muted">Escribe tu código postal</span>`}</p></div>
      </div>
      ${cpFuera && html`<${DS.Notice} tone="error">Ese código postal no es de la Ciudad de México. Por ahora LilieVET solo atiende en la CDMX; revisa que esté bien escrito.<//>`}
      <${DS.Field} label="Colonia" maxLength=${80} autoComplete="address-level3" value=${d.colonia} onChange=${set('colonia')} />
      <${DS.Field} label="Calle y número" maxLength=${120} autoComplete="address-line1" value=${d.calle_numero} onChange=${set('calle_numero')} />
      <${DS.Field} label="Referencias (opcional)" maxLength=${200} value=${d.referencias} onChange=${set('referencias')} hint="Color de la fachada, entre qué calles, número interior." />
      <div class="row"><${DS.Button} variant="secondary" onClick=${() => setPaso(1)}>Atrás<//><${DS.Button} disabled=${!ok2} onClick=${() => setPaso(3)}>Continuar<//></div>
      <${Falta} que=${faltan2} />
    </section>`}

    ${paso === 3 && html`<section class="box stack">
      ${carga && html`<${DS.Notice} tone="error">${carga}<//>`}
      ${!bloques && !carga && html`<p class="muted">Buscando horarios…</p>`}
      ${bloques && !bloques.length && html`<${DS.EmptyState} who="liebe" title="Aún no hay médicos en tu zona">
        Por ahora ningún médico veterinario atiende ${d.alcaldia} para este servicio. Ya anotamos tu búsqueda para sumar médicos en tu zona; vuelve a intentar pronto.<//>`}
      ${bloques && bloques.length > 0 && html`
        <div class="row" role="radiogroup" aria-label="Día">
          ${dias.map((x) => html`<${DS.Chip} key=${x} type="radio" name="dia" checked=${dia === x} onChange=${() => setDia(x)}>${fechaDia(x).replace(/ de \d{4}| \d{4}/, '')}<//>`)}
        </div>
        <div class="slots" role="radiogroup" aria-label="Horario">
          ${bloques.filter((b) => diaISO(b.inicia_at) === dia).map((b) => html`<${DS.OptionCard} key=${b.inicia_at} name="bloque" size="sm"
            title=${`${hora(b.inicia_at)} a ${hora(new Date(new Date(b.inicia_at).getTime() + 72e5))}`}
            description=${b.medicos === 1 ? '1 médico disponible' : `${b.medicos} médicos disponibles`}
            checked=${d.inicia_at === b.inicia_at} onChange=${() => setD({ ...d, inicia_at: b.inicia_at, medicos: [] })} />`)}
        </div>
        <p class="small muted">El médico veterinario llega dentro del bloque de dos horas que elijas.</p>`}
      <div class="row"><${DS.Button} variant="secondary" onClick=${() => setPaso(2)}>Atrás<//><${DS.Button} disabled=${!d.inicia_at} onClick=${() => setPaso(4)}>Continuar<//></div>
      ${bloques && bloques.length > 0 && html`<${Falta} que=${d.inicia_at ? [] : ['elegir un día y un horario']} />`}
    </section>`}

    ${paso === 4 && html`<section class="box stack">
      ${carga && html`<${DS.Notice} tone="error">${carga}<//>`}
      ${!medicos && !carga && html`<p class="muted">Buscando médicos veterinarios…</p>`}
      ${medicos && !medicos.length && html`<${DS.Notice}>Ese horario se acaba de ocupar. Regresa y elige otro.<//>`}
      ${medicos && medicos.length > 1 && html`<p>Elige hasta tres, en el orden que prefieras. Tu solicitud va primero con tu primera opción; si no puede o no responde en ${P.minutos_respuesta} minutos, pasa a la siguiente.</p>`}
      ${medicos && medicos.length === 1 && html`<p>En este horario hay un médico veterinario disponible.</p>`}
      <div class="stack-sm">
        ${(medicos || []).map((m) => {
          const pos = d.medicos.indexOf(m.id);
          return html`<article class=${'medico' + (pos >= 0 ? ' on' : '')} key=${m.id}>
            <div class="spread">
              <div class="medico-cab"><${FotoMvz} ruta=${m.foto} nombre=${m.nombre} />
                <div><h3 class="lv-card-name">${m.nombre}</h3>
                <p class="lv-card-sub">Cédula ${m.cedula} · médico veterinario independiente</p></div></div>
              ${pos >= 0 && html`<${DS.Badge} tone="completado">${ORDEN[pos]}<//>`}
            </div>
            <div><${DS.Badge} tone="verificado">Cédula verificada el ${fechaDia(diaISO(m.cedula_verificada_at))}<//></div>
            ${m.presentacion && html`<p class="small">${m.presentacion}</p>`}
            <div class="spread">
              <div class="lv-price">${money(m.precio)}<small>${d.servicio === 'consulta' ? 'consulta, directo al médico' : 'desde, directo al médico'} · ${m.medios_pago.map((x) => MEDIO_PAGO[x]).join(', ').toLowerCase() || 'pregunta el medio de pago'}</small></div>
              ${medicos.length > 1 && html`<${DS.Button} size="sm" variant=${pos >= 0 ? 'secondary' : 'primary'} disabled=${pos < 0 && d.medicos.length >= 3} onClick=${() => alternar(m.id)}>${pos >= 0 ? 'Quitar' : 'Elegir'}<//>`}
            </div>
          </article>`;
        })}
      </div>
      <div class="row"><${DS.Button} variant="secondary" onClick=${() => setPaso(3)}>Atrás<//><${DS.Button} disabled=${!d.medicos.length} onClick=${() => setPaso(5)}>Continuar<//></div>
      ${medicos && medicos.length > 0 && html`<${Falta} que=${d.medicos.length ? [] : ['elegir al menos un médico veterinario']} />`}
    </section>`}

    ${paso === 5 && html`<section class="box stack">
      <dl class="datos">
        <dt>Servicio</dt><dd>${SERVICIO[d.servicio]} para ${d.mascota.trim()}</dd>
        <dt>Mascota</dt><dd>${mascotaTxt({ especie: d.especie, sexo: d.sexo, edad_meses: edadMeses })}</dd>
        ${d.motivo.trim() && html`<dt>Para el médico</dt><dd>${d.motivo.trim()}</dd>`}
        <dt>Horario</dt><dd>${ventana(d.inicia_at, new Date(new Date(d.inicia_at).getTime() + 72e5))}</dd>
        <dt>Domicilio</dt><dd>${d.calle_numero}, ${d.colonia}, ${d.alcaldia}, C.P. ${d.cp}</dd>
        <dt>Médicos</dt><dd>${elegidos.map((m, i) => html`<div key=${m.id}>${i + 1}. ${m.nombre}</div>`)}</dd>
      </dl>
      <${DS.BillSummary}
        items=${[{ label: `${SERVICIO[d.servicio]}${d.servicio === 'consulta' ? '' : ' (desde)'} · se paga directo al médico veterinario`, amount: rango }]}
        payNow=${P.cuota} payNowLabel="Cuota de servicio LilieVET · se paga aquí cuando un médico acepte" />
      <p class="small muted">Hoy no se cobra nada. La cuota incluye IVA. Vacunas, medicamentos y productos también se pagan directo al médico veterinario.</p>
      <div class="stack-sm">
        <label class="check"><input type="checkbox" checked=${d.no_es_urgencia} onChange=${set('no_es_urgencia')} />
          <span>Confirmo que <b>no es una urgencia</b>. Entiendo que LilieVET no es un servicio de urgencias.</span></label>
        <label class="check"><input type="checkbox" checked=${d.acepta_transferencia} onChange=${set('acepta_transferencia')} />
          <span>Acepto que LilieVET comparta mi nombre, celular y domicilio con el médico veterinario que acepte, <b>una vez que la consulta quede confirmada</b>, para que pueda atenderme.</span></label>
      </div>
      ${elegidos[0] && html`<p class="small muted">${elegidos.length === 1 ? leyenda(elegidos[0]) + '.' : 'El servicio lo presta el médico veterinario independiente que acepte tu solicitud; verás su nombre y cédula al confirmarse.'}</p>`}
      ${st.error && html`<${DS.Notice} tone="error">${st.error}<//>`}
      <div class="row"><${DS.Button} variant="secondary" onClick=${() => setPaso(4)}>Atrás<//>
        <${DS.Button} disabled=${st.ocupado || !d.no_es_urgencia || !d.acepta_transferencia} onClick=${enviar}>${st.ocupado ? 'Enviando…' : 'Enviar solicitud'}<//></div>
      <${Falta} que=${[!d.no_es_urgencia && 'confirmar que no es una urgencia', !d.acepta_transferencia && 'aceptar que compartamos tus datos con el médico que confirme'].filter(Boolean)} />
    </section>`}
  </div>`;
}
