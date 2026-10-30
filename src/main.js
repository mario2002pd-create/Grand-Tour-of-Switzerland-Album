import '@fontsource/fraunces/600.css';
import '@fontsource/fraunces/800.css';
import '@fontsource/fraunces/600-italic.css';
import '@fontsource/bebas-neue/400.css';
import '@fontsource/source-sans-3/400.css';
import '@fontsource/source-sans-3/600.css';
import './styles/base.css';
import './styles/portada.css';
import './styles/album.css';
import './styles/ficha.css';
import './styles/mapa.css';
import './styles/stats.css';

import { cargarDatos, t } from './data.js';
import { el } from './util.js';
import { vistaPortada } from './views/portada.js';
import { vistaAlbum } from './views/album.js';
import { abrirFicha, cerrarFicha, fichaAbierta } from './views/ficha.js';
import { vistaMapa } from './views/mapa.js';
import { vistaStats } from './views/stats.js';

const main = document.getElementById('contenido');
const barra = document.getElementById('barra');
let vistaActual = null;
let claveVista = '';

function parsearRuta() {
  const partes = location.hash.replace(/^#\/?/, '').split('/').filter(Boolean).map(decodeURIComponent);
  return { seccion: partes[0] || '', args: partes.slice(1) };
}

async function enrutar() {
  const { seccion, args } = parsearRuta();

  // La ficha es una capa sobre la vista actual (álbum por defecto).
  if (seccion === 'cromo') {
    if (!vistaActual || claveVista === '') await mostrar('album', []);
    abrirFicha(args[0]);
    return;
  }
  if (fichaAbierta()) cerrarFicha({ sinNavegar: true });
  await mostrar(seccion, args);
}

async function mostrar(seccion, args) {
  const clave = seccion === 'album' ? 'album' : seccion;
  // El álbum gestiona sus propias páginas sin volver a montarse.
  if (clave === 'album' && claveVista === 'album' && vistaActual?.irA) {
    vistaActual.irA(args[0]);
    return;
  }
  vistaActual?.destruir?.();
  main.replaceChildren();
  window.scrollTo(0, 0);
  claveVista = clave;
  document.body.dataset.vista = clave || 'portada';
  barra.hidden = clave === '';
  for (const a of barra.querySelectorAll('[data-nav]')) {
    if (a.dataset.nav === clave) a.setAttribute('aria-current', 'page');
    else a.removeAttribute('aria-current');
  }
  const vistas = { '': vistaPortada, album: vistaAlbum, mapa: vistaMapa, stats: vistaStats };
  const crear = vistas[clave] || vistaPortada;
  vistaActual = await crear(main, args);
  const titulos = { '': t('titulo'), album: t('nav_album'), mapa: t('mapa_titulo'), stats: t('stats_titulo') };
  document.title = `${titulos[clave] || t('titulo')} · Álbum del Grand Tour`;
}

async function iniciar() {
  try {
    await cargarDatos();
  } catch (err) {
    main.replaceChildren(
      el('div.error-carga', {}, el('h1', {}, 'No se pudo cargar el álbum'), el('p', {}, String(err.message || err))),
    );
    return;
  }
  // Textos de la barra desde el idioma.
  for (const a of barra.querySelectorAll('[data-nav]')) a.textContent = t(`nav_${a.dataset.nav}`);
  window.addEventListener('hashchange', () => {
    window.__navegaciones = (window.__navegaciones || 0) + 1;
    enrutar();
  });
  enrutar();
}

iniciar();
