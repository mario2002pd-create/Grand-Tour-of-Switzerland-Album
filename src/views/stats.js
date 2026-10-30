// E) ESTADÍSTICAS: por región, por categoría, especiales y el sitio más alto.
import { estado, t, pegado, nombreCategoria } from '../data.js';
import { el, formatoNumero } from '../util.js';

function barra(etiqueta, x, n, color) {
  const pct = n ? Math.round((x / n) * 100) : 0;
  return el(
    'li.barra-stat',
    {},
    el('span.barra-stat__etiqueta', {}, etiqueta),
    el('span.barra-stat__cifra', { 'aria-hidden': 'true' }, `${x}/${n}`),
    el(
      'span.barra-stat__pista',
      { role: 'img', 'aria-label': `${etiqueta}: ${x} de ${n} (${pct} %)` },
      el('span.barra-stat__relleno', { style: { width: `${pct}%`, background: color } }),
    ),
  );
}

function tarjeta(titulo, x, n, nota) {
  return el(
    'div.tarjeta-stat',
    {},
    el('h2.tarjeta-stat__titulo', {}, titulo),
    el('p.tarjeta-stat__cifra', {}, el('strong', {}, String(x)), el('span', {}, ` / ${n}`)),
    nota ? el('p.tarjeta-stat__nota', {}, nota) : null,
  );
}

export function vistaStats(main) {
  const todos = estado.cromos;
  const tengo = todos.filter(pegado);
  const cuenta = (f) => [todos.filter(f).filter(pegado).length, todos.filter(f).length];

  const [lx, ln] = cuenta((c) => c.categoria === 'lago');
  const [px, pn] = cuenta((c) => c.categoria === 'puerto alpino');
  const [ux, un] = cuenta((c) => c.unesco === 'patrimonio');
  const [bx, bn] = cuenta((c) => c.rareza === 'brillante');
  const biosfera = todos.filter((c) => c.unesco === 'biosfera');
  const bioTengo = biosfera.filter(pegado).length;

  const masAlto = [...tengo].sort((a, b) => b.altitud - a.altitud)[0];

  main.append(
    el(
      'section.stats',
      { 'aria-labelledby': 'stats-titulo' },
      el('h1#stats-titulo', {}, t('stats_titulo')),
      el(
        'div.stats__resumen',
        {},
        tarjeta(t('stats_total'), tengo.length, todos.length),
        tarjeta(t('stats_lagos'), lx, ln),
        tarjeta(t('stats_puertos'), px, pn),
        tarjeta(
          t('stats_unesco'),
          ux,
          un,
          `Patrimonio Mundial. Biosfera de Entlebuch: ${bioTengo ? 'conseguida' : 'pendiente'} (${bioTengo}/${biosfera.length}).`,
        ),
        tarjeta(t('stats_brillantes'), bx, bn),
      ),
      el(
        'div.stats__alto',
        {},
        el('h2', {}, t('stats_mas_alto')),
        masAlto
          ? el(
              'a.alto',
              { href: `#/cromo/${masAlto.id}` },
              el('span.alto__cifra', {}, formatoNumero(masAlto.altitud), el('small', {}, ' m')),
              el('span.alto__nombre', {}, `${masAlto.numero} · ${masAlto.nombre}`),
            )
          : el('p', {}, t('stats_ninguno')),
        masAlto
          ? el(
              'p.no-oficial',
              {},
              'Según la altitud de las coordenadas del cromo (en cumbres y puertos, la de la cima o el collado).',
            )
          : null,
      ),
      el(
        'div.stats__columnas',
        {},
        el(
          'section',
          {},
          el('h2', {}, t('stats_por_region')),
          el(
            'ul.barras',
            {},
            estado.regiones.map((r) =>
              barra(`${r.etiqueta} · ${r.nombre}`, r.cromos.filter(pegado).length, r.cromos.length, r.color),
            ),
          ),
        ),
        el(
          'section',
          {},
          el('h2', {}, t('stats_por_categoria')),
          el(
            'ul.barras',
            {},
            estado.categorias.map((cat) => {
              const [x, n] = cuenta((c) => c.categoria === cat);
              return barra(nombreCategoria(cat), x, n, 'var(--rojo)');
            }),
          ),
        ),
      ),
      el(
        'section.stats__creditos',
        {},
        el('h2', {}, t('creditos')),
        el('p', {}, t('creditos_ayuda')),
        el('p', {}, t('fuente_puertos')),
        el(
          'details',
          {},
          el('summary', {}, 'Ver los 64 créditos'),
          el(
            'ol.creditos',
            {},
            todos.map((c) =>
              el(
                'li',
                {},
                `${c.numero} ${c.nombre}: `,
                el('a', { href: c.imagen.fuente, target: '_blank', rel: 'noopener' }, c.imagen.autor),
                ` · ${c.imagen.licencia}`,
              ),
            ),
          ),
        ),
        el('p.no-oficial', {}, t('aviso_no_oficial'), ' ', t('pie'), '.'),
      ),
    ),
  );
  return {};
}
