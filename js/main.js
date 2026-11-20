// Punto de entrada: sesión → perfil → vista (tutor, médico veterinario o Panel).
import { html, useState, useEffect, useCallback } from './lib.js';
import { api, esDemo } from './api.js';
import { Layout, ToastProvider, useRuta, ir, Cargando, ErrorCarga, NAV } from './shell.js';
import { Entrar, Registro, Recuperar, NuevaContrasena, SinConfig } from './auth.js';
import { PaginaDoc } from './legal.js';
import { Perfil } from './cuenta.js';
import { InicioTutor } from './tutor/inicio.js';
import { Solicitar } from './tutor/solicitar.js';
import { Consultas } from './tutor/consultas.js';
import { SolicitudesMvz } from './mvz/inicio.js';
import { Agenda } from './mvz/agenda.js';
import { Servicios } from './mvz/servicios.js';
import { Panel, PuertaPanel, tituloPanel } from './admin/panel.js';

// ───────── Tema: automático, claro u oscuro ─────────
function useTema() {
  const [tema, setTema] = useState(() => { try { const t = localStorage.getItem('lv-tema'); return ['auto', 'light', 'dark'].includes(t) ? t : 'auto'; } catch (e) { return 'auto'; } });
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const aplicar = () => { document.documentElement.dataset.theme = tema === 'auto' ? (mq.matches ? 'dark' : 'light') : tema; };
    aplicar();
    mq.addEventListener('change', aplicar);
    try { localStorage.setItem('lv-tema', tema); } catch (e) { /* sin almacenamiento */ }
    return () => mq.removeEventListener('change', aplicar);
  }, [tema]);
  return [tema, () => setTema((t) => ({ auto: 'light', light: 'dark', dark: 'auto' }[t]))];
}

const TITULOS = { inicio: 'Inicio', solicitar: 'Solicitar', consultas: 'Consultas', perfil: 'Perfil', solicitudes: 'Solicitudes', agenda: 'Agenda', servicios: 'Servicios' };

function Vista({ vista, seccion, sub, perfil, onPerfil, setConteos }) {
  if (vista === 'tutor') {
    if (seccion === 'solicitar') return html`<${Solicitar} perfil=${perfil} />`;
    if (seccion === 'consultas') return html`<${Consultas} perfil=${perfil} sub=${sub} />`;
    if (seccion === 'perfil') return html`<${Perfil} perfil=${perfil} onPerfil=${onPerfil} />`;
    return html`<${InicioTutor} perfil=${perfil} />`;
  }
  if (vista === 'mvz') {
    if (seccion === 'agenda') return html`<${Agenda} perfil=${perfil} onPerfil=${onPerfil} />`;
    if (seccion === 'servicios') return html`<${Servicios} perfil=${perfil} onPerfil=${onPerfil} />`;
    if (seccion === 'perfil') return html`<${Perfil} perfil=${perfil} onPerfil=${onPerfil} />`;
    return html`<${SolicitudesMvz} perfil=${perfil} onPerfil=${onPerfil} onConteos=${setConteos} />`;
  }
  // El Panel exige doble factor. Aunque alguien se salte esta pantalla, la base rechaza cada función.
  if (!perfil.panel_abierto) return html`<${PuertaPanel} onAbierto=${onPerfil} />`;
  return html`<${Panel} seccion=${seccion} onConteos=${setConteos} />`;
}

function App() {
  const ruta = useRuta();
  const [seccion, sub] = ruta.split('/');
  const [tema, cambiarTema] = useTema();
  const [sesion, setSesion] = useState(undefined);
  const [perfil, setPerfil] = useState(null);
  const [errorPerfil, setErrorPerfil] = useState(null);
  const [vista, setVista] = useState(null);
  const [conteos, setConteos] = useState({});
  const [recuperando, setRecuperando] = useState(false);

  useEffect(() => {
    api.session().then(setSesion);
    return api.onAuth((s, evento) => { if (evento === 'PASSWORD_RECOVERY') setRecuperando(true); setSesion(s); });
  }, []);

  const recargarPerfil = useCallback(() => api.perfil().then((p) => { setPerfil(p); return p; }), []);
  const uid = sesion?.user?.id;

  useEffect(() => {
    if (!uid) { setPerfil(null); setVista(null); return; }
    setErrorPerfil(null);
    api.perfil().then((p) => {
      if (!p) { setErrorPerfil(new Error('Tu cuenta no tiene perfil. Escríbenos para ayudarte.')); return; }
      setPerfil(p);
      const pedida = esDemo ? new URLSearchParams(location.search).get('demo') : null;
      const v = p.es_admin && (pedida === 'admin' || !pedida) ? 'admin' : p.rol;
      setVista(v);
      const valida = NAV[v].grupos.flatMap((g) => g.items).some((i) => i.id === seccion) || (v === 'admin' && seccion === 'mas');
      if (!valida) ir(NAV[v].grupos[0].items[0].id);
    }).catch(setErrorPerfil);
  }, [uid]);

  if (['terminos', 'privacidad', 'carta'].includes(seccion)) return html`<${PaginaDoc} doc=${seccion} />`;
  if (api.mode === 'sin_config') return html`<${SinConfig} />`;
  if (sesion === undefined) return html`<${Cargando} />`;
  if ((recuperando || seccion === 'nueva-contrasena') && sesion) return html`<${NuevaContrasena} onListo=${() => { setRecuperando(false); ir(''); }} />`;
  if (!sesion) {
    if (seccion === 'registro') return html`<${Registro} />`;
    if (seccion === 'recuperar') return html`<${Recuperar} />`;
    return html`<${Entrar} />`;
  }
  if (errorPerfil) return html`<div class="page page-narrow"><${ErrorCarga} error=${errorPerfil} onReintentar=${() => setSesion({ ...sesion })} />
    <p><button type="button" class="linkish" onClick=${() => api.salir()}>Cerrar sesión</button></p></div>`;
  if (!perfil || !vista) return html`<${Cargando} texto="Preparando tu cuenta…" />`;

  const cambiarVista = perfil.es_admin
    ? () => { const v = vista === 'admin' ? perfil.rol : 'admin'; setVista(v); setConteos({}); ir(NAV[v].grupos[0].items[0].id); }
    : null;
  const items = NAV[vista].grupos.flatMap((g) => g.items);
  const actual = items.some((i) => i.id === seccion) || (vista === 'admin' && seccion === 'mas') ? seccion : items[0].id;
  const pendiente = vista === 'mvz' && perfil.mvz?.estado !== 'aprobado';
  const titulo = vista === 'admin' ? tituloPanel(actual) : pendiente && actual === 'solicitudes' ? 'Tu alta' : TITULOS[actual];
  const etiquetas = pendiente ? { solicitudes: 'Tu alta' } : null;

  return html`<${Layout} vista=${vista} ruta=${actual} perfil=${perfil} conteos=${conteos} etiquetas=${etiquetas}
      titulo=${titulo} tema=${tema} onTema=${cambiarTema} onSalir=${() => api.salir()} onCambiarVista=${cambiarVista}>
    <${Vista} vista=${vista} seccion=${actual} sub=${actual === seccion ? sub : undefined} perfil=${perfil} onPerfil=${recargarPerfil} setConteos=${setConteos} />
  <//>`;
}

ReactDOM.createRoot(document.getElementById('root')).render(html`<${ToastProvider}><${App} /><//>`);

if ('serviceWorker' in navigator && location.protocol === 'https:' && !esDemo) {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}
