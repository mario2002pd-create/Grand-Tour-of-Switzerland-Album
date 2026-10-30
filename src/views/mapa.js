// D) MAPA: Suiza con Leaflet + OpenStreetMap, trazado aproximado y un pin por cromo.
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { estado, t, pegado, region } from '../data.js';
import { el } from '../util.js';

export function vistaMapa(main) {
  const contMapa = el('div.mapa__lienzo', { 'aria-label': t('mapa_titulo') });
  const lista = el(
    'ol.mapa__lista',
    {},
    estado.cromos.map((c) =>
      el(
        'li',
        {},
        el(
          'a',
          { href: `#/cromo/${c.id}` },
          el('span.mapa__punto', { 'aria-hidden': 'true', style: { background: pegado(c) ? region(c.region).color : '#9aa0a3' } }),
          `${c.numero} · ${c.nombre}`,
          el('span.sr', {}, pegado(c) ? ` (${t('mapa_leyenda_tengo')})` : ` (${t('mapa_leyenda_falta')})`),
        ),
      ),
    ),
  );
  main.append(
    el(
      'section.mapa',
      { 'aria-labelledby': 'mapa-titulo' },
      el(
        'header.mapa__cabecera',
        {},
        el('h1#mapa-titulo', {}, t('mapa_titulo')),
        el(
          'ul.mapa__leyenda',
          {},
          el('li', {}, el('span.ley.ley--tengo', { 'aria-hidden': 'true' }), t('mapa_leyenda_tengo')),
          el('li', {}, el('span.ley.ley--falta', { 'aria-hidden': 'true' }), t('mapa_leyenda_falta')),
          el('li', {}, el('span.ley.ley--ruta', { 'aria-hidden': 'true' }), t('mapa_ruta')),
          el('li', {}, el('span.ley.ley--acceso', { 'aria-hidden': 'true' }), t('mapa_accesos')),
        ),
      ),
      contMapa,
      el('details.mapa__detalles', {}, el('summary', {}, 'Lista de cromos (alternativa al mapa)'), lista),
    ),
  );

  const mapa = L.map(contMapa, {
    zoomSnap: 0.25,
    minZoom: 6.5,
    maxBounds: [
      [44.9, 4.6],
      [48.6, 11.9],
    ],
  });
  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 18,
    attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
  }).addTo(mapa);

  const { principal, desvios, accesos } = estado.ruta;
  // Contorno blanco + línea roja, como en las cartas de carreteras antiguas
  L.polyline(principal, { color: '#fff', weight: 8, opacity: 0.85, interactive: false }).addTo(mapa);
  L.polyline(principal, { color: '#d52b1e', weight: 4, opacity: 0.95, interactive: false }).addTo(mapa);
  for (const tramo of [...desvios, ...accesos]) {
    L.polyline(tramo, { color: '#d52b1e', weight: 3, opacity: 0.8, dashArray: '6 7', interactive: false }).addTo(mapa);
  }

  const marcadores = [];
  for (const c of estado.cromos) {
    const tiene = pegado(c);
    const color = tiene ? region(c.region).color : '#9aa0a3';
    const icono = L.divIcon({
      className: 'pin' + (tiene ? ' pin--tengo' : '') + (c.rareza === 'brillante' ? ' pin--brillante' : ''),
      html: `<span style="--c:${color}">${c.numero}</span>`,
      iconSize: [30, 30],
      iconAnchor: [15, 15],
    });
    const m = L.marker([c.coordenadas.lat, c.coordenadas.lon], {
      icon: icono,
      title: `${c.numero} · ${c.nombre}`,
      alt: `${c.numero} · ${c.nombre}${tiene ? '' : ` (${t('mapa_leyenda_falta')})`}`,
      keyboard: true,
      riseOnHover: true,
      zIndexOffset: tiene ? 500 : 0,
    }).addTo(mapa);
    m.on('click', () => (location.hash = `#/cromo/${c.id}`));
    marcadores.push(m);
    // Accesibilidad: cada pin es un enlace a la ficha, usable con teclado
    const n = m.getElement();
    if (n) {
      n.setAttribute('role', 'link');
      n.setAttribute('aria-label', `${c.numero} · ${c.nombre}${tiene ? '' : ` (${t('mapa_leyenda_falta')})`}`);
      n.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          location.hash = `#/cromo/${c.id}`;
        }
      });
    }
  }
  mapa.fitBounds(L.latLngBounds(estado.cromos.map((c) => [c.coordenadas.lat, c.coordenadas.lon])), { padding: [24, 24] });
  const ro = new ResizeObserver(() => mapa.invalidateSize());
  ro.observe(contMapa);

  return {
    destruir() {
      ro.disconnect();
      mapa.remove();
    },
  };
}
