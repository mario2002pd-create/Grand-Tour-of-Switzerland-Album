// Utilidades pequeñas compartidas por todas las vistas.

export const BASE = import.meta.env.BASE_URL;

/** Ruta absoluta (con la base de GitHub Pages) a un archivo de contenido. */
export const url = (ruta) => (ruta ? BASE + String(ruta).replace(/^\/+/, '') : '');

/** Crea un elemento: el('div.clase#id', {atributos}, ...hijos) */
export function el(selector, attrs = {}, ...hijos) {
  const [, tag = 'div', resto = ''] = selector.match(/^([a-z0-9-]*)(.*)$/i);
  const nodo = document.createElement(tag || 'div');
  for (const parte of resto.match(/[.#][^.#]+/g) || []) {
    if (parte[0] === '.') nodo.classList.add(parte.slice(1));
    else nodo.id = parte.slice(1);
  }
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v === undefined || v === null || v === false) continue;
    if (k.startsWith('on') && typeof v === 'function') nodo.addEventListener(k.slice(2), v);
    else if (k === 'style' && typeof v === 'object') Object.assign(nodo.style, v);
    else if (k === 'dataset') Object.assign(nodo.dataset, v);
    else if (k === 'html') nodo.innerHTML = v;
    else nodo.setAttribute(k, v === true ? '' : v);
  }
  for (const h of hijos.flat(Infinity)) {
    if (h === null || h === undefined || h === false) continue;
    nodo.append(h instanceof Node ? h : document.createTextNode(String(h)));
  }
  return nodo;
}

/** Sustituye {claves} en una plantilla de texto. */
export const fmt = (txt, vars = {}) => String(txt).replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? '');

/** Giro pseudoaleatorio estable por id (para que cada cromo pegado quede "torcido" siempre igual). */
export function giro(id, max = 3.2) {
  let h = 0;
  for (const c of id) h = (h * 31 + c.charCodeAt(0)) | 0;
  return (((h >>> 0) % 1000) / 1000 - 0.5) * 2 * max;
}

export const reduceMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/** Anuncia un mensaje a lectores de pantalla. */
export function anunciar(msg) {
  const vivo = document.getElementById('aviso-vivo');
  if (!vivo) return;
  vivo.textContent = '';
  requestAnimationFrame(() => (vivo.textContent = msg));
}

export function formatoFecha(iso) {
  if (!iso) return '';
  const d = new Date(iso + (iso.length === 10 ? 'T12:00:00' : ''));
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' });
}

export const formatoNumero = (n) => new Intl.NumberFormat('es-ES').format(n);

export function descargar(blob, nombre) {
  const a = el('a', { href: URL.createObjectURL(blob), download: nombre });
  document.body.append(a);
  a.click();
  setTimeout(() => {
    URL.revokeObjectURL(a.href);
    a.remove();
  }, 1000);
}
