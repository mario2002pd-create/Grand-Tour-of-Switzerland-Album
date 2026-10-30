// Componente de cromo: hueco vacío o cromo pegado (con foto real o en vista previa).
import { estado, t, pegado, enPrevia, fotoDe, nombreCategoria } from './data.js';
import { el, fmt, giro, url } from './util.js';
import { dialogoPrevia } from './previa.js';

export function crearCromo(c, { nuevo = false } = {}) {
  const tiene = pegado(c);
  const brillante = c.rareza === 'brillante';
  const etiqueta = tiene ? fmt(t('pegado'), { num: c.numero, nombre: c.nombre }) : fmt(t('hueco'), { num: c.numero, nombre: c.nombre });

  const enlace = el(
    'a.cromo',
    {
      href: `#/cromo/${c.id}`,
      'aria-label': `${etiqueta}${brillante ? `. ${t('brillante')}` : ''}${enPrevia(c) ? `. ${t('en_vista_previa')}` : ''}`,
      dataset: { id: c.id },
      class: [
        'cromo',
        tiene ? 'cromo--pegado' : 'cromo--hueco',
        brillante ? 'cromo--brillante' : '',
        nuevo ? 'cromo--nuevo' : '',
        enPrevia(c) ? 'cromo--previa' : '',
      ]
        .filter(Boolean)
        .join(' '),
      style: { '--giro': `${giro(c.id)}deg` },
    },
    tiene ? contenidoPegado(c, brillante) : contenidoHueco(c, brillante),
  );

  // Vista previa: soltar una foto sobre el hueco (o sobre un cromo en previa).
  if (estado.modoPrevia && !(c.visitado && c.foto_mia)) {
    enlace.addEventListener('dragover', (e) => {
      e.preventDefault();
      enlace.classList.add('cromo--soltar');
    });
    enlace.addEventListener('dragleave', () => enlace.classList.remove('cromo--soltar'));
    enlace.addEventListener('drop', (e) => {
      e.preventDefault();
      enlace.classList.remove('cromo--soltar');
      const f = e.dataTransfer?.files?.[0];
      if (f) dialogoPrevia(c, f);
    });
  }
  return enlace;
}

function contenidoHueco(c, brillante) {
  return el(
    'span.hueco',
    {},
    el('img.hueco__silueta', {
      src: url(c.imagen.silueta),
      alt: '',
      loading: 'lazy',
      decoding: 'async',
      onerror: (e) => e.currentTarget.remove(),
    }),
    el('span.hueco__num', { 'aria-hidden': 'true' }, c.numero),
    el('span.hueco__nombre', { 'aria-hidden': 'true' }, c.nombre),
    brillante ? el('span.hueco__brillo', { 'aria-hidden': 'true' }, '✦') : null,
    estado.modoPrevia ? el('span.hueco__soltar', { 'aria-hidden': 'true' }, 'Suelta aquí una foto') : null,
  );
}

function contenidoPegado(c, brillante) {
  return el(
    'span.pegado' + (brillante ? '.holo' : ''),
    {},
    el(
      'span.pegado__marco',
      {},
      el('img.pegado__foto', { src: fotoDe(c), alt: `Tu foto de ${c.nombre}`, loading: 'lazy', decoding: 'async' }),
      brillante ? el('span.holo__capa', { 'aria-hidden': 'true' }) : null,
      brillante ? el('span.holo__destello', { 'aria-hidden': 'true' }) : null,
    ),
    el(
      'span.pegado__pie',
      { 'aria-hidden': 'true' },
      el('span.pegado__num', {}, c.numero),
      el('span.pegado__nombre', {}, c.nombre),
    ),
    enPrevia(c) ? el('span.etiqueta.etiqueta--previa.pegado__marca', { 'aria-hidden': 'true' }, t('vista_previa')) : null,
    c.foto_de_prueba && !enPrevia(c) ? el('span.etiqueta.etiqueta--prueba.pegado__marca', { 'aria-hidden': 'true' }, t('foto_prueba')) : null,
    el('span.sr', {}, nombreCategoria(c.categoria)),
  );
}
