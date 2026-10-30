// Efecto holográfico de los cromos brillantes: reacciona al ratón/dedo y al giroscopio.
import { reduceMotion } from './util.js';

let giroActivo = false;

function aplicar(elemento, px, py) {
  // px, py en 0..1
  elemento.style.setProperty('--mx', `${(px * 100).toFixed(1)}%`);
  elemento.style.setProperty('--my', `${(py * 100).toFixed(1)}%`);
  elemento.style.setProperty('--rx', `${((0.5 - py) * 14).toFixed(2)}deg`);
  elemento.style.setProperty('--ry', `${((px - 0.5) * 18).toFixed(2)}deg`);
  elemento.style.setProperty('--brillo', (0.35 + Math.hypot(px - 0.5, py - 0.5)).toFixed(2));
}

function reiniciar(elemento) {
  for (const v of ['--mx', '--my', '--rx', '--ry', '--brillo']) elemento.style.removeProperty(v);
}

/** Activa el seguimiento del puntero dentro de un contenedor (delegado). */
export function activarHolo(contenedor) {
  if (reduceMotion()) return () => {};
  const mover = (e) => {
    const cromo = e.target.closest?.('.holo');
    if (!cromo || giroActivo) return;
    const r = cromo.getBoundingClientRect();
    aplicar(cromo, (e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height);
  };
  const salir = (e) => {
    const cromo = e.target.closest?.('.holo');
    if (cromo && !giroActivo) reiniciar(cromo);
  };
  contenedor.addEventListener('pointermove', mover);
  contenedor.addEventListener('pointerout', salir);
  return () => {
    contenedor.removeEventListener('pointermove', mover);
    contenedor.removeEventListener('pointerout', salir);
  };
}

function alGirar(e) {
  if (e.beta === null || e.gamma === null) return;
  const px = Math.min(1, Math.max(0, 0.5 + e.gamma / 50));
  const py = Math.min(1, Math.max(0, 0.5 + (e.beta - 45) / 60));
  for (const cromo of document.querySelectorAll('.holo')) aplicar(cromo, px, py);
}

/** ¿Hace falta un toque para pedir permiso (iOS)? */
export const giroscopioNecesitaPermiso = () =>
  typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function';

export const esTactil = () => window.matchMedia('(pointer: coarse)').matches;

/** En Android y similares se activa solo; en iOS, tras pulsar un botón. */
export function iniciarGiroscopioSiSePuede() {
  if (reduceMotion() || giroActivo || !esTactil() || giroscopioNecesitaPermiso()) return;
  if (typeof DeviceOrientationEvent === 'undefined') return;
  window.addEventListener('deviceorientation', alGirar);
  giroActivo = true;
}

export async function pedirPermisoGiroscopio() {
  try {
    const r = await DeviceOrientationEvent.requestPermission();
    if (r === 'granted') {
      window.addEventListener('deviceorientation', alGirar);
      giroActivo = true;
      return true;
    }
  } catch {
    /* permiso denegado o no disponible */
  }
  return false;
}

export const giroscopioActivo = () => giroActivo;
