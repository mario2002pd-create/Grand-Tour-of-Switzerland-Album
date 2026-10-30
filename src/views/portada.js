// A) PORTADA: tapa de álbum de cartón. Al tocarla, el álbum «se abre».
import { estado, t, totalPegados } from '../data.js';
import { el, fmt, reduceMotion } from '../util.js';

const MONTANAS = `
<svg class="tapa__ilustracion" viewBox="0 0 600 260" aria-hidden="true" focusable="false" preserveAspectRatio="xMidYMax slice">
  <defs>
    <linearGradient id="cielo" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#f5dfb0"/><stop offset="1" stop-color="#efc98a"/>
    </linearGradient>
  </defs>
  <rect width="600" height="260" fill="url(#cielo)"/>
  <circle cx="455" cy="78" r="34" fill="#f7efd8" opacity=".9"/>
  <path d="M0 190 L70 120 L110 150 L180 70 L235 130 L290 95 L350 150 L420 60 L470 110 L520 85 L600 140 L600 260 L0 260Z" fill="#7d98a6"/>
  <path d="M180 70 L200 92 L190 95 L208 108 L180 100 L165 86Z M420 60 L440 84 L428 86 L450 100 L418 92 L404 78Z M290 95 L303 110 L284 106Z" fill="#fbf8f1"/>
  <path d="M0 215 L60 170 L130 200 L210 150 L300 205 L380 160 L460 195 L540 165 L600 190 L600 260 L0 260Z" fill="#4d6b45"/>
  <path d="M0 236 C120 220 220 248 330 230 S520 222 600 236 L600 260 L0 260Z" fill="#6f9fb4"/>
  <path d="M0 246 C140 238 260 252 380 244 S540 240 600 248" stroke="#b9d3dc" stroke-width="2" fill="none"/>
</svg>`;

export function vistaPortada(main) {
  const n = estado.cromos.length;
  const x = totalPegados();
  const pct = n ? Math.round((x / n) * 100) : 0;

  const tapa = el(
    'button.tapa',
    {
      type: 'button',
      'aria-label': `${t('abrir_album')}. ${fmt(t('contador'), { x, n })}`,
      onclick: abrir,
    },
    el('span.tapa__lomo', { 'aria-hidden': 'true' }),
    el('span.tapa__cruz', { 'aria-hidden': 'true' }),
    el(
      'span.tapa__etiqueta',
      {},
      el('span.tapa__sobre', {}, t('subtitulo')),
      el('span.tapa__titulo', {}, 'Grand Tour'),
      el('span.tapa__de', {}, 'of Switzerland'),
      el('span.tapa__ilustracion-marco', { html: MONTANAS }),
      el('span.tapa__cifras', {}, el('strong', {}, String(x)), el('span', {}, ` / ${n}`)),
      el('span.tapa__contador', {}, fmt(t('contador'), { x, n }).replace(/^\d+ \/ \d+ /, '')),
      el(
        'span.progreso',
        { role: 'progressbar', 'aria-valuemin': '0', 'aria-valuemax': String(n), 'aria-valuenow': String(x), 'aria-label': fmt(t('contador'), { x, n }) },
        el('span.progreso__barra', { style: { width: `${pct}%` } }),
      ),
      el('span.tapa__accion', {}, t('toca_para_abrir')),
    ),
  );

  function abrir() {
    if (reduceMotion()) {
      location.hash = '#/album';
      return;
    }
    tapa.classList.add('tapa--abriendo');
    tapa.addEventListener('animationend', () => (location.hash = '#/album'), { once: true });
    setTimeout(() => (location.hash = '#/album'), 1100);
  }

  main.append(
    el(
      'section.portada',
      { 'aria-labelledby': 'portada-titulo' },
      el('h1.sr#portada-titulo', {}, `${t('titulo')} · ${t('subtitulo')}`),
      el('div.escena', {}, el('div.libro', {}, el('div.libro__paginas', { 'aria-hidden': 'true' }), tapa)),
      el('p.no-oficial.portada__aviso', {}, t('aviso_no_oficial')),
    ),
  );
  requestAnimationFrame(() => tapa.focus({ preventScroll: true }));
  return {};
}
