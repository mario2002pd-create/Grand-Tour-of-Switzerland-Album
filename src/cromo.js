// Componente de cromo: hueco vacío o cromo pegado (con foto real o en vista previa).
import { estado, t, pegado, enPrevia, fotoDe } from './data.js';
import { el, giro, url } from './util.js';
import { dialogoPrevia } from './previa.js';

export function crearCromo(c, { nuevo = false } = {}) {
  const tiene = pegado(c);
  const brillante = c.rareza === 'brillante';
  // Nombre accesible = texto visible (número y nombre) + estado en texto solo para lectores de pantalla
  const estadoSr = [
    tiene ? t('pegado').replace(/^.*?: /, ': ') : t('hueco').replace(/^.*?: /, ': '),
    brillante ? `, ${t('brillante').toLowerCase()}` : '',
    enPrevia(c) ? `, ${t('en_vista_previa').toLowerCase()}` : '',
  ].join('');

  const enlace = el(
    'a.cromo',
    {
      href: `#/cromo/${c.id}`,
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
    tiene ? contenidoPegado(c, brillante, estadoSr) : contenidoHueco(c, brillante, estadoSr),
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

function contenidoHueco(c, brillante, estadoSr) {
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
    el('span.hueco__num', {}, c.numero, el('span.sr', {}, ' ')),
    el('span.hueco__nombre', {}, c.nombre, el('span.sr', {}, estadoSr)),
    brillante ? el('span.hueco__brillo', { 'aria-hidden': 'true' }, '✦') : null,
    estado.modoPrevia ? el('span.hueco__soltar', { 'aria-hidden': 'true' }, 'Suelta aquí una foto') : null,
  );
}

function contenidoPegado(c, brillante, estadoSr) {
  return el(
    'span.pegado' + (brillante ? '.holo' : ''),
    {},
    el(
      'span.pegado__marco',
      {},
      el('img.pegado__foto', { src: fotoDe(c), alt: '', loading: 'lazy', decoding: 'async' }),
      brillante ? el('span.holo__capa', { 'aria-hidden': 'true' }) : null,
      brillante ? el('span.holo__destello', { 'aria-hidden': 'true' }) : null,
    ),
    el(
      'span.pegado__pie',
      {},
      el('span.pegado__num', {}, c.numero, el('span.sr', {}, ' ')),
      el('span.pegado__nombre', {}, c.nombre, el('span.sr', {}, estadoSr)),
    ),
    enPrevia(c) ? el('span.etiqueta.etiqueta--previa.pegado__marca', {}, t('vista_previa')) : null,
    c.foto_de_prueba && !enPrevia(c) ? el('span.etiqueta.etiqueta--prueba.pegado__marca', {}, t('foto_prueba')) : null,
  );
}
