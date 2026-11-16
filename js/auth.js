// Pantallas de acceso: entrar, crear cuenta, recuperar y cambiar contraseña.
import { html, DS, Icon, useState, quitarTitulo, soloDigitos } from './lib.js';
import { api } from './api.js';
import { ir } from './shell.js';
import { EnlaceDoc } from './legal.js';

function Marca() {
  return html`<section class="auth-brand">
    <img src="img/lilievet-logo.svg" alt="LilieVET · Tu vet a domicilio" />
    <div class="row" style=${{ justifyContent: 'center' }}>
      <${DS.Character} who="liebe" size=${72} sticker />
      <${DS.Character} who="lilie" size=${66} sticker />
    </div>
    <div>
      <p class="claim">Un médico veterinario con cédula verificada, en tu casa.</p>
      <p class="claim-sub">Agenda consultas a domicilio para perros y gatos.</p>
    </div>
    <div class="auth-points">
      <div class="auth-point"><${Icon} name="shield" /><span>Verificamos la cédula profesional de cada médico veterinario antes de su primera consulta.</span></div>
      <div class="auth-point"><${Icon} name="wallet" /><span>Solo pagas la cuota de servicio cuando un médico acepta tu solicitud. La consulta la pagas directo a él.</span></div>
      <div class="auth-point"><${Icon} name="alert" /><span>No es un servicio de urgencias.</span></div>
    </div>
  </section>`;
}

function Marco({ children }) {
  return html`<div class="auth">
    <${Marca} />
    <section class="auth-form"><div class="auth-card">
      <img class="auth-logo-m" src="img/lilievet-logo.svg" alt="LilieVET · Tu vet a domicilio" />
      ${children}
    </div></section>
  </div>`;
}

const conEnvio = (fn, setEnviando, setError) => async (e) => {
  e.preventDefault();
  setError(null); setEnviando(true);
  try { await fn(); } catch (err) { setError(err.message || 'Algo salió mal. Intenta de nuevo.'); }
  setEnviando(false);
};

export function Entrar() {
  const [correo, setCorreo] = useState('');
  const [pass, setPass] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState(null);
  const enviar = conEnvio(() => api.entrar(correo, pass), setEnviando, setError);
  return html`<${Marco}>
    <div><h1 class="titulo-2">Entra a tu cuenta</h1><p class="muted small" style=${{ marginTop: 4 }}>Tutores y médicos veterinarios entran aquí.</p></div>
    <form class="stack" onSubmit=${enviar} noValidate=${true}>
      <${DS.Field} label="Correo" type="email" autoComplete="email" required value=${correo} onChange=${(e) => setCorreo(e.target.value)} />
      <${DS.Field} label="Contraseña" type="password" autoComplete="current-password" required value=${pass} onChange=${(e) => setPass(e.target.value)} />
      ${error && html`<${DS.Notice} tone="error">${error}<//>`}
      <${DS.Button} type="submit" block disabled=${enviando || !correo || !pass}>${enviando ? 'Entrando…' : 'Entrar'}<//>
      <div class="spread small">
        <button type="button" class="linkish" onClick=${() => ir('recuperar')}>Olvidé mi contraseña</button>
      </div>
    </form>
    <div class="stack-sm" style=${{ paddingTop: 16, borderTop: '1px solid var(--line)' }}>
      <p class="small muted">¿Aún no tienes cuenta?</p>
      <${DS.Button} variant="secondary" block onClick=${() => ir('registro')}>Crear cuenta<//>
    </div>
  <//>`;
}

export function Registro() {
  const [d, setD] = useState({ rol: 'tutor', nombre: '', apellidos: '', correo: '', telefono: '', password: '', terminos: false, privacidad: false, carta: false });
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState(null);
  const [toque, setToque] = useState(false);
  const [listo, setListo] = useState(false);
  const set = (k) => (e) => setD({ ...d, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value });
  const mvz = d.rol === 'mvz';

  const errores = {
    nombre: !quitarTitulo(d.nombre) && 'Escribe tu nombre.',
    apellidos: !d.apellidos.trim() && 'Escribe tus apellidos.',
    correo: !/^\S+@\S+\.\S+$/.test(d.correo) && 'Escribe un correo válido.',
    telefono: soloDigitos(d.telefono).length !== 10 && 'Escribe tu celular a 10 dígitos.',
    password: d.password.length < 10 && 'Usa al menos 10 caracteres.',
    terminos: !d.terminos && 'Acepta los Términos y Condiciones para continuar.',
    privacidad: !d.privacidad && 'Acepta el Aviso de Privacidad para continuar.',
    carta: mvz && !d.carta && 'Acepta la Carta del Médico Veterinario para continuar.',
  };
  const valido = !Object.values(errores).some(Boolean);
  const err = (k) => (toque ? errores[k] || undefined : undefined);
  const errCasilla = (k) => err(k) && html`<small class="small" style=${{ color: 'var(--danger)', fontWeight: 500 }}>${errores[k]}</small>`;

  const enviar = async (e) => {
    e.preventDefault(); setToque(true);
    if (!valido) return;
    await conEnvio(async () => { await api.registrar({ ...d, nombre: quitarTitulo(d.nombre) }); setListo(true); }, setEnviando, setError)(e);
  };

  if (listo) {
    return html`<${Marco}>
      <div><h1 class="titulo-2">Revisa tu correo</h1></div>
      <${DS.Notice} tone="exito" title="Ya casi.">Te enviamos un enlace a ${d.correo} para confirmar tu cuenta. Ábrelo y después entra con tu correo y contraseña. Si no lo ves, revisa tu carpeta de spam.<//>
      <${DS.Button} variant="secondary" block onClick=${() => ir('entrar')}>Ir a entrar<//>
    <//>`;
  }

  return html`<${Marco}>
    <div><h1 class="titulo-2">Crea tu cuenta</h1><p class="muted small" style=${{ marginTop: 4 }}>Toma un par de minutos.</p></div>
    <form class="stack" onSubmit=${enviar} noValidate=${true}>
      <div class="role-pick" role="radiogroup" aria-label="Tipo de cuenta">
        <${DS.OptionCard} name="rol" size="sm" title="Soy tutor" description="Tengo perro o gato" checked=${!mvz} onChange=${() => setD({ ...d, rol: 'tutor' })} />
        <${DS.OptionCard} name="rol" size="sm" title="Soy médico veterinario" description="Quiero dar consultas" checked=${mvz} onChange=${() => setD({ ...d, rol: 'mvz' })} />
      </div>
      <div class="field-row">
        <${DS.Field} label="Nombre" autoComplete="given-name" maxLength=${60} value=${d.nombre} onChange=${set('nombre')} error=${err('nombre')} />
        <${DS.Field} label="Apellidos" autoComplete="family-name" maxLength=${80} value=${d.apellidos} onChange=${set('apellidos')} error=${err('apellidos')} />
      </div>
      ${mvz && html`<p class="small muted" style=${{ marginTop: -8 }}>Tu nombre como aparece en tu cédula profesional, sin “Dr.” ni “Dra.”.</p>`}
      <${DS.Field} label="Correo" type="email" autoComplete="email" maxLength=${120} value=${d.correo} onChange=${set('correo')} error=${err('correo')} />
      <${DS.Field} label="Celular" type="tel" inputMode="numeric" autoComplete="tel-national" maxLength=${14} value=${d.telefono} onChange=${set('telefono')} error=${err('telefono')}
        hint=${mvz ? 'Solo lo ve el tutor cuando su consulta contigo queda confirmada.' : 'Solo lo ve el médico veterinario cuando tu consulta queda confirmada.'} />
      <${DS.Field} label="Contraseña" type="password" autoComplete="new-password" value=${d.password} onChange=${set('password')} error=${err('password')} hint="Al menos 10 caracteres. No uses la misma de otro sitio." />
      ${mvz && html`<${DS.Notice} tone="info">Después de crear tu cuenta escribes tu número de cédula. Confirmamos tu identidad en una videollamada y revisamos tu cédula antes de que recibas solicitudes. No guardamos copia de tu identificación.<//>`}
      <div class="stack-sm">
        <label class="check"><input type="checkbox" checked=${d.terminos} onChange=${set('terminos')} />
          <span>Leí y acepto los <${EnlaceDoc} doc="terminos" />.</span></label>
        ${errCasilla('terminos')}
        <label class="check"><input type="checkbox" checked=${d.privacidad} onChange=${set('privacidad')} />
          <span>Leí y acepto el <${EnlaceDoc} doc="privacidad" />.</span></label>
        ${errCasilla('privacidad')}
        ${mvz && html`<label class="check"><input type="checkbox" checked=${d.carta} onChange=${set('carta')} />
          <span>Leí y acepto la <${EnlaceDoc} doc="carta" />: presto mis servicios de forma independiente.</span></label>`}
        ${mvz && errCasilla('carta')}
      </div>
      ${error && html`<${DS.Notice} tone="error">${error}<//>`}
      <${DS.Button} type="submit" block disabled=${enviando}>${enviando ? 'Creando tu cuenta…' : 'Crear cuenta'}<//>
    </form>
    <p class="small muted">¿Ya tienes cuenta? <button type="button" class="linkish" onClick=${() => ir('entrar')}>Entra aquí</button></p>
  <//>`;
}

export function Recuperar() {
  const [correo, setCorreo] = useState('');
  const [listo, setListo] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState(null);
  const enviar = conEnvio(async () => { await api.recuperar(correo); setListo(true); }, setEnviando, setError);
  return html`<${Marco}>
    <div><h1 class="titulo-2">Recupera tu contraseña</h1><p class="muted small" style=${{ marginTop: 4 }}>Te mandamos un enlace a tu correo para crear una nueva.</p></div>
    ${listo
      ? html`<${DS.Notice} tone="exito" title="Listo.">Si ese correo tiene una cuenta, en unos minutos llega el enlace. Revisa también tu carpeta de spam.<//>`
      : html`<form class="stack" onSubmit=${enviar} noValidate=${true}>
          <${DS.Field} label="Correo" type="email" autoComplete="email" value=${correo} onChange=${(e) => setCorreo(e.target.value)} />
          ${error && html`<${DS.Notice} tone="error">${error}<//>`}
          <${DS.Button} type="submit" block disabled=${enviando || !correo}>${enviando ? 'Enviando…' : 'Enviar enlace'}<//>
        </form>`}
    <p class="small"><button type="button" class="linkish" onClick=${() => ir('entrar')}>Volver a entrar</button></p>
  <//>`;
}

export function NuevaContrasena({ onListo }) {
  const [pass, setPass] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState(null);
  const enviar = conEnvio(async () => { await api.nuevaContrasena(pass); onListo && onListo(); }, setEnviando, setError);
  return html`<${Marco}>
    <div><h1 class="titulo-2">Crea tu nueva contraseña</h1></div>
    <form class="stack" onSubmit=${enviar} noValidate=${true}>
      <${DS.Field} label="Nueva contraseña" type="password" autoComplete="new-password" value=${pass} onChange=${(e) => setPass(e.target.value)} hint="Al menos 10 caracteres." />
      ${error && html`<${DS.Notice} tone="error">${error}<//>`}
      <${DS.Button} type="submit" block disabled=${enviando || pass.length < 10}>${enviando ? 'Guardando…' : 'Guardar contraseña'}<//>
    </form>
  <//>`;
}

export function SinConfig() {
  return html`<${Marco}>
    <div><h1 class="titulo-2">Falta conectar Supabase</h1>
      <p class="muted small" style=${{ marginTop: 4 }}>Pega la Project URL y la clave publishable de tu proyecto en <b>config.js</b> y recarga la página. Los pasos están en LEEME.md.</p></div>
    <${DS.Notice} tone="info">Mientras tanto puedes revisar el diseño con datos de ejemplo. No se guarda nada.<//>
    <div class="stack-sm">
      <${DS.Button} block onClick=${() => { location.href = '?demo=tutor#/inicio'; }}>Ver muestra: tutor<//>
      <${DS.Button} variant="secondary" block onClick=${() => { location.href = '?demo=mvz#/solicitudes'; }}>Ver muestra: médico veterinario<//>
      <${DS.Button} variant="secondary" block onClick=${() => { location.href = '?demo=admin#/resumen'; }}>Ver muestra: Panel<//>
    </div>
  <//>`;
}
