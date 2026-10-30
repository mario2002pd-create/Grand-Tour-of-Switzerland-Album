// C) FICHA: foto libre de fondo + polaroid propia que gira (reverso: fecha y nota) + datos.
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import {
  estado,
  t,
  pegado,
  pegadoDeVerdad,
  enPrevia,
  fotoDe,
  fechaDe,
  notaDe,
  nombreCategoria,
  nombreCanton,
  region,
} from '../data.js';
import { el, fmt, url, formatoFecha, formatoNumero, anunciar, giro } from '../util.js';
import { elegirFoto, quitarPrevia, descargarFotoPrevia } from '../previa.js';
import { compartirCromo } from '../share.js';
import { activarHolo, iniciarGiroscopioSiSePuede } from '../holo.js';

let actual = null; // { nodo, mapa, id, previoFoco, limpiar }

export const fichaAbierta = () => Boolean(actual);

export function cerrarFicha({ sinNavegar = false } = {}) {
  if (!actual) return;
  const { nodo, mapa, previoFoco, limpiar, volver } = actual;
  mapa?.remove();
  limpiar?.();
  nodo.remove();
  document.body.classList.remove('con-ficha');
  actual = null;
  if (!sinNavegar) {
    // Si se llegó a la ficha navegando dentro del álbum, volvemos atrás; si se abrió con un enlace directo, al álbum.
    if (volver) history.back();
    else location.hash = '#/album';
  }
  // Devuelve el foco al cromo de origen, si sigue en la página
  requestAnimationFrame(() => previoFoco?.isConnected && previoFoco.focus({ preventScroll: false }));
}

export function abrirFicha(id) {
  const c = estado.porId.get(id);
  if (!c) {
    location.hash = '#/album';
    return;
  }
  const volver = actual?.volver ?? (window.__navegaciones || 0) > 0;
  const previoFoco = actual?.previoFoco ?? document.querySelector(`.cromo[data-id="${CSS.escape(id)}"]`) ?? document.activeElement;
  if (actual) {
    actual.mapa?.remove();
    actual.limpiar?.();
    actual.nodo.remove();
  }
  const nodo = construir(c);
  document.body.append(nodo);
  document.body.classList.add('con-ficha');
  const mapa = miniMapa(nodo.querySelector('.ficha__mapa'), c);
  const quitarHolo = activarHolo(nodo);
  iniciarGiroscopioSiSePuede();
  const tecla = (e) => {
    if (document.querySelector('.dialogo')) return;
    if (e.key === 'Escape') {
      e.preventDefault();
      cerrarFicha();
    } else if ((e.key === 'ArrowRight' || e.key === 'ArrowLeft') && !e.target.closest('input, textarea, select, .leaflet-container')) {
      const i = estado.cromos.indexOf(c);
      const sig = estado.cromos[(i + (e.key === 'ArrowRight' ? 1 : -1) + estado.cromos.length) % estado.cromos.length];
      history.replaceState(null, '', `#/cromo/${sig.id}`);
      abrirFicha(sig.id);
    }
  };
  document.addEventListener('keydown', tecla);
  const alCambiar = () => abrirFicha(c.id);
  window.addEventListener('album:cambio', alCambiar);
  actual = {
    nodo,
    mapa,
    id,
    previoFoco,
    volver,
    limpiar: () => {
      document.removeEventListener('keydown', tecla);
      window.removeEventListener('album:cambio', alCambiar);
      quitarHolo();
    },
  };
  document.title = `${c.numero} · ${c.nombre} · Álbum del Grand Tour`;
  nodo.querySelector('.ficha__titulo').focus({ preventScroll: true });
}

function construir(c) {
  const r = region(c.region);
  const tiene = pegado(c);
  const brillante = c.rareza === 'brillante';
  const i = estado.cromos.indexOf(c);
  const ant = estado.cromos[(i - 1 + estado.cromos.length) % estado.cromos.length];
  const sig = estado.cromos[(i + 1) % estado.cromos.length];
  const irA = (otro) => (e) => {
    e.preventDefault();
    history.replaceState(null, '', `#/cromo/${otro.id}`);
    abrirFicha(otro.id);
  };

  // ——— Polaroid con giro ———
  const polaroid = el(
    'button.polaroid' + (brillante && tiene ? '.holo' : ''),
    {
      type: 'button',
      'aria-pressed': 'false',
      'aria-label': `${t('girar')}: ${tiene ? `tu foto de ${c.nombre}` : t('sin_visitar')}`,
      style: { '--giro': `${giro(c.id, 2.5)}deg` },
      onclick: () => {
        const girado = polaroid.classList.toggle('polaroid--girada');
        polaroid.setAttribute('aria-pressed', String(girado));
        anunciar(girado ? reversoTexto(c) : c.nombre);
      },
    },
    el(
      'span.polaroid__cara.polaroid__frente',
      {},
      el(
        'span.polaroid__foto',
        {},
        tiene
          ? el('img', { src: fotoDe(c), alt: `Tu foto de ${c.nombre}` })
          : el(
              'span.polaroid__vacia',
              {},
              el('img', { src: url(c.imagen.silueta), alt: '', onerror: (e) => e.currentTarget.remove() }),
              el('span', {}, c.numero),
            ),
        brillante && tiene ? el('span.holo__capa', { 'aria-hidden': 'true' }) : null,
        brillante && tiene ? el('span.holo__destello', { 'aria-hidden': 'true' }) : null,
      ),
      el('span.polaroid__leyenda', {}, tiene ? c.nombre : t('sin_visitar')),
    ),
    el(
      'span.polaroid__cara.polaroid__reverso',
      { 'aria-hidden': 'true' },
      el('span.reverso__sello', {}, `Nº ${c.numero}`),
      el('span.reverso__fecha', {}, fechaDe(c) ? `${t('fecha_visita')} ${formatoFecha(fechaDe(c))}` : t('sin_visitar')),
      el('span.reverso__nota', {}, notaDe(c) || t('reverso_sin_nota')),
      el('span.reverso__lugar', {}, `${c.nombre} · ${formatoNumero(c.altitud)} m`),
    ),
  );

  const acciones = el('div.ficha__acciones');
  if (tiene) {
    acciones.append(el('button.boton.boton--rojo', { type: 'button', onclick: () => compartirCromo(c) }, t('compartir')));
  }
  if (!pegadoDeVerdad(c)) {
    acciones.append(el('button.boton.boton--claro', { type: 'button', onclick: () => elegirFoto(c) }, t('probar_foto')));
    if (enPrevia(c)) {
      acciones.append(
        el('button.boton.boton--claro', { type: 'button', onclick: () => descargarFotoPrevia(c) }, `${t('descargar')} (${c.id}.jpg)`),
        el('button.boton.boton--claro', { type: 'button', onclick: () => quitarPrevia(c) }, t('quitar_prueba')),
      );
    }
  }

  const etiquetas = el(
    'div.ficha__etiquetas',
    {},
    el('span.etiqueta', { style: { borderColor: r.color } }, `${r.etiqueta} · ${r.nombre}`),
    el('span.etiqueta', {}, nombreCategoria(c.categoria)),
    brillante ? el('span.etiqueta.etiqueta--brillante', {}, `✦ ${t('brillante')}`) : null,
    enPrevia(c) ? el('span.etiqueta.etiqueta--previa', {}, t('en_vista_previa')) : null,
    c.foto_de_prueba && !enPrevia(c) ? el('span.etiqueta.etiqueta--prueba', {}, t('foto_prueba')) : null,
  );

  const dato = (k, v) => [el('dt', {}, k), el('dd', {}, v)];
  const datos = el(
    'dl.ficha__datos',
    {},
    dato(t('canton'), c.canton.map(nombreCanton).join(' / ')),
    dato(t('altitud'), `${formatoNumero(c.altitud)} m`),
    dato(t('coordenadas'), `${c.coordenadas.lat.toFixed(4)}° N, ${c.coordenadas.lon.toFixed(4)}° E`),
    dato(t('categoria'), nombreCategoria(c.categoria)),
    dato(t('rareza'), estado.i18n.rareza?.[c.rareza] ?? c.rareza),
    c.unesco ? dato('UNESCO', estado.i18n.unesco?.[c.unesco]) : null,
    dato('Origen', estado.i18n.origen?.[c.origen] ?? c.origen),
  );

  const info = el(
    'div.ficha__info',
    {},
    etiquetas,
    el('section', {}, el('h3', {}, t('descripcion')), el('p', {}, c.descripcion)),
    c.aviso ? el('aside.ficha__aviso', { role: 'note' }, el('strong', {}, `${t('aviso')}: `), c.aviso) : null,
    el('section', {}, el('h3', {}, t('curiosidades')), el('ul.curiosidades', {}, c.curiosidades.map((x) => el('li', {}, x)))),
    el(
      'div.ficha__dos',
      {},
      el('section', {}, el('h3', {}, t('mejor_epoca')), el('p', {}, c.mejor_epoca)),
      el('section', {}, el('h3', {}, t('como_llegar')), el('p', {}, c.como_llegar)),
    ),
    el('section', {}, el('h3', {}, t('datos')), datos),
    el('div.ficha__mapa', { role: 'img', 'aria-label': `Mapa: ${c.nombre}, ${c.coordenadas.lat.toFixed(3)}° N, ${c.coordenadas.lon.toFixed(3)}° E` }),
    el(
      'p.ficha__enlace',
      {},
      el('a.boton', { href: c.enlace_oficial, target: '_blank', rel: 'noopener' }, `${t('enlace_oficial')} ↗`),
    ),
    el(
      'p.ficha__credito',
      {},
      el(
        'a',
        { href: c.imagen.fuente, target: '_blank', rel: 'noopener' },
        fmt(t('credito'), { autor: c.imagen.autor, licencia: c.imagen.licencia }),
      ),
      ' · ',
      el('a', { href: c.imagen.licencia_url, target: '_blank', rel: 'noopener' }, 'licencia'),
      c.foto_de_prueba && c.foto_credito
        ? [
            el('br'),
            'Foto de prueba: ',
            el('a', { href: c.foto_credito.fuente, target: '_blank', rel: 'noopener' }, `${c.foto_credito.autor} · ${c.foto_credito.licencia}`),
          ]
        : null,
    ),
    el('p.no-oficial', {}, t('aviso_no_oficial')),
  );

  const fondo = el('div.ficha__fondo', { 'aria-hidden': 'true' }, el('img', { src: url(c.imagen.fondo), alt: '', onerror: (e) => e.currentTarget.remove() }));

  return el(
    'div.ficha',
    { role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'ficha-titulo', style: { '--color-region': r.color } },
    fondo,
    el(
      'div.ficha__barra',
      {},
      el('a.boton.boton--claro.boton--icono', { href: `#/cromo/${ant.id}`, 'aria-label': `Anterior: ${ant.numero} ${ant.nombre}`, onclick: irA(ant) }, '‹'),
      el('a.boton.boton--claro.boton--icono', { href: `#/cromo/${sig.id}`, 'aria-label': `Siguiente: ${sig.numero} ${sig.nombre}`, onclick: irA(sig) }, '›'),
      el('button.boton.boton--claro.boton--icono', { type: 'button', 'aria-label': t('cerrar'), onclick: () => cerrarFicha() }, '✕'),
    ),
    el(
      'div.ficha__contenido',
      {},
      el(
        'header.ficha__cabecera',
        {},
        el('span.ficha__num', { 'aria-hidden': 'true' }, c.numero),
        el('h2.ficha__titulo#ficha-titulo', { tabindex: '-1' }, el('span.sr', {}, `Cromo ${c.numero}: `), c.nombre),
        c.nombre_local && c.nombre_local !== c.nombre ? el('p.ficha__local', {}, c.nombre_local) : null,
      ),
      el('div.ficha__polaroid', {}, polaroid, el('p.ficha__pista', { 'aria-hidden': 'true' }, 'Toca la foto para darle la vuelta'), acciones),
      info,
    ),
  );
}

function reversoTexto(c) {
  const f = fechaDe(c);
  return `${f ? `${t('fecha_visita')} ${formatoFecha(f)}. ` : `${t('sin_visitar')}. `}${notaDe(c) || t('reverso_sin_nota')}`;
}

function miniMapa(nodo, c) {
  if (!nodo) return null;
  try {
    const m = L.map(nodo, {
      center: [c.coordenadas.lat, c.coordenadas.lon],
      zoom: 10,
      zoomControl: false,
      attributionControl: true,
      scrollWheelZoom: false,
      dragging: !L.Browser.mobile,
      keyboard: false,
    });
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 18,
      attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    }).addTo(m);
    L.circleMarker([c.coordenadas.lat, c.coordenadas.lon], {
      radius: 9,
      color: '#fff',
      weight: 3,
      fillColor: pegado(c) ? '#d52b1e' : '#7d8589',
      fillOpacity: 1,
    }).addTo(m);
    m.getContainer().setAttribute('tabindex', '-1');
    setTimeout(() => m.invalidateSize(), 50);
    return m;
  } catch {
    return null;
  }
}
