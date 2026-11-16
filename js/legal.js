// Enlaces a los documentos legales y avisos fijos de la app.
import { html, DS } from './lib.js';

const cfg = window.LV_CONFIG || {};
// Solo se aceptan enlaces https escritos en config.js
const seguro = (u) => (/^https:\/\/[^\s"'<>]+$/.test(u || '') ? u : null);
export const DOCS = {
  terminos: { titulo: 'Términos y Condiciones', url: seguro(cfg.terminosUrl) },
  privacidad: { titulo: 'Aviso de Privacidad', url: seguro(cfg.privacidadUrl) },
  carta: { titulo: 'Carta del Médico Veterinario', url: seguro(cfg.cartaUrl) },
};

export function EnlaceDoc({ doc }) {
  const d = DOCS[doc];
  return d.url
    ? html`<a href=${d.url} target="_blank" rel="noopener noreferrer">${d.titulo}</a>`
    : html`<a href=${'#/' + doc}>${d.titulo}</a>`;
}

// Página provisional mientras el documento no tenga enlace en config.js
export function PaginaDoc({ doc }) {
  const d = DOCS[doc] || DOCS.terminos;
  return html`<div class="page page-narrow">
    <img src="img/lilievet-logo.svg" alt="LilieVET · Tu vet a domicilio" style=${{ width: 160 }} />
    <h1 class="titulo-1">${d.titulo}</h1>
    <${DS.Notice} tone="info">Este documento se publica aquí antes de abrir el registro. Si necesitas una copia, escríbenos.<//>
    <p><a href="#/entrar">Volver</a></p>
  </div>`;
}

export function AvisoUrgencias() {
  return html`<${DS.Notice} title="No es un servicio de urgencias.">Si tu mascota tiene dificultad para respirar, convulsiones, sangrado abundante, no puede orinar, se envenenó o sufrió un golpe fuerte, llévala de inmediato a un hospital veterinario.<//>`;
}

export function Soporte() {
  const tel = String(cfg.soporteWhatsapp || '').replace(/\D/g, '');
  if (tel.length !== 10) return null;
  return html`<p class="small muted">¿Necesitas ayuda? Escríbenos por WhatsApp al <a href=${'https://wa.me/52' + tel} target="_blank" rel="noopener noreferrer">${tel.slice(0, 2)} ${tel.slice(2, 6)} ${tel.slice(6)}</a>. Por WhatsApp no valoramos síntomas ni damos indicaciones médicas.</p>`;
}
