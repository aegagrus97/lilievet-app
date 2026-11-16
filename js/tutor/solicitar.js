// Solicitar una consulta: servicio → domicilio → horario → médicos (1ª, 2ª y 3ª opción) → confirmar.
import { html, DS, Icon, useState, useEffect, SERVICIO, SERVICIO_DESC, ESPECIE, MEDIO_PAGO, hora, diaRelativo, diaISO, ventana, fechaDia, money, leyenda } from '../lib.js';
import { api } from '../api.js';
import { PageHead, ir, useToast } from '../shell.js';
import { useAccion } from '../cuenta.js';
import { AvisoUrgencias } from '../legal.js';

const PASOS = ['Servicio', 'Domicilio', 'Horario', 'Médico veterinario', 'Confirmar'];
const ORDEN = ['Primera opción', 'Segunda opción', 'Tercera opción'];

export function Solicitar({ perfil }) {
  const toast = useToast();
  const P = perfil.parametros;
  const [paso, setPaso] = useState(1);
  const [d, setD] = useState({ servicio: 'consulta', mascota: '', especie: 'perro', alcaldia: '', colonia: '', calle_numero: '', cp: '', referencias: '', inicia_at: null, medicos: [], no_es_urgencia: false, acepta_transferencia: false });
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

  if (P.exigir_telefono && !perfil.telefono_verificado) {
    return html`<div class="page page-narrow"><${PageHead} titulo="Solicitar consulta" />
      <${DS.EmptyState} who="lilie" title="Primero verifica tu celular" action=${html`<${DS.Button} block onClick=${() => ir('perfil')}>Ir a mi perfil<//>`}>
        Así el médico veterinario puede contactarte cuando tu consulta quede confirmada.<//></div>`;
  }

  const ok1 = d.mascota.trim().length >= 1;
  const ok2 = d.alcaldia && d.colonia.trim().length >= 2 && d.calle_numero.trim().length >= 3 && /^\d{5}$/.test(d.cp);
  const elegidos = d.medicos.map((id) => (medicos || []).find((m) => m.id === id)).filter(Boolean);
  const precios = elegidos.map((m) => m.precio);
  const rango = precios.length ? (Math.min(...precios) === Math.max(...precios) ? money(precios[0]) : `${money(Math.min(...precios))} a ${money(Math.max(...precios))}`) : '';
  const dias = [...new Set((bloques || []).map((b) => diaISO(b.inicia_at)))];
  const alternar = (id) => setD({ ...d, medicos: d.medicos.includes(id) ? d.medicos.filter((x) => x !== id) : d.medicos.length < 3 ? [...d.medicos, id] : d.medicos });

  const enviar = async () => {
    const id = await correr(() => api.crearSolicitud({ ...d, mascota: d.mascota.trim(), no_es_urgencia: 'true', acepta_transferencia: 'true' }));
    if (id) { toast('Solicitud enviada.', { sparks: true }); ir('consultas'); }
  };

  return html`<div class="page page-narrow">
    <${PageHead} titulo="Solicitar consulta" />
    <${DS.Steps} current=${paso} total=${5} label=${PASOS[paso - 1]} />

    ${paso === 1 && html`<section class="box stack">
      <${AvisoUrgencias} />
      <div class="stack-sm" role="radiogroup" aria-label="Servicio">
        ${Object.keys(SERVICIO).map((k) => html`<${DS.OptionCard} key=${k} name="servicio" title=${SERVICIO[k]} description=${SERVICIO_DESC[k]} checked=${d.servicio === k} onChange=${() => setD({ ...d, servicio: k, inicia_at: null, medicos: [] })} />`)}
      </div>
      <${DS.Field} label="Nombre de tu mascota" maxLength=${40} value=${d.mascota} onChange=${set('mascota')} />
      <div class="row" role="radiogroup" aria-label="Especie">
        ${Object.keys(ESPECIE).map((k) => html`<${DS.Chip} key=${k} type="radio" name="especie" checked=${d.especie === k} onChange=${() => setD({ ...d, especie: k })}>${ESPECIE[k]}<//>`)}
      </div>
      <p class="small muted">En la solicitud no pedimos síntomas ni historial: eso lo platicas directamente con tu médico veterinario.</p>
      <div class="row"><${DS.Button} disabled=${!ok1} onClick=${() => setPaso(2)}>Continuar<//></div>
    </section>`}

    ${paso === 2 && html`<section class="box stack">
      <${DS.Notice} tone="info">Tu domicilio completo solo se comparte con el médico veterinario cuando la consulta queda confirmada. Antes solo ve la colonia y la alcaldía.<//>
      <${DS.Field} as="select" label="Alcaldía" value=${d.alcaldia} onChange=${(e) => setD({ ...d, alcaldia: e.target.value, inicia_at: null, medicos: [] })}
        options=${[{ value: '', label: 'Elige tu alcaldía' }, ...P.alcaldias.map((a) => ({ value: a, label: a }))]} />
      <div class="field-row">
        <${DS.Field} label="Colonia" maxLength=${80} autoComplete="address-level3" value=${d.colonia} onChange=${set('colonia')} />
        <${DS.Field} label="Código postal" inputMode="numeric" maxLength=${5} autoComplete="postal-code" value=${d.cp} onChange=${(e) => setD({ ...d, cp: e.target.value.replace(/\D/g, '') })} />
      </div>
      <${DS.Field} label="Calle y número" maxLength=${120} autoComplete="address-line1" value=${d.calle_numero} onChange=${set('calle_numero')} />
      <${DS.Field} label="Referencias (opcional)" maxLength=${200} value=${d.referencias} onChange=${set('referencias')} hint="Color de la fachada, entre qué calles, número interior." />
      <div class="row"><${DS.Button} variant="secondary" onClick=${() => setPaso(1)}>Atrás<//><${DS.Button} disabled=${!ok2} onClick=${() => setPaso(3)}>Continuar<//></div>
    </section>`}

    ${paso === 3 && html`<section class="box stack">
      ${carga && html`<${DS.Notice} tone="error">${carga}<//>`}
      ${!bloques && !carga && html`<p class="muted">Buscando horarios…</p>`}
      ${bloques && !bloques.length && html`<${DS.EmptyState} who="liebe" title="Aún no hay médicos en tu zona">
        Por ahora ningún médico veterinario atiende ${d.alcaldia} para este servicio. Estamos sumando más; vuelve a intentar pronto o prueba otra alcaldía cercana.<//>`}
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
              <div><h3 class="lv-card-name">${m.nombre}</h3>
                <p class="lv-card-sub">Cédula ${m.cedula} · médico veterinario independiente</p></div>
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
    </section>`}

    ${paso === 5 && html`<section class="box stack">
      <dl class="datos">
        <dt>Servicio</dt><dd>${SERVICIO[d.servicio]} para ${d.mascota.trim()} (${ESPECIE[d.especie].toLowerCase()})</dd>
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
    </section>`}
  </div>`;
}
