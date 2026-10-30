// B) ÁLBUM: una página por región; se pasa con swipe, flechas o teclado.
import { estado, t, pegado, pegadoDeVerdad, nombreCategoria, setModoPrevia, vistos, marcarVisto } from '../data.js';
import { el, fmt, anunciar, reduceMotion } from '../util.js';
import { crearCromo } from '../cromo.js';
import {
  activarHolo,
  iniciarGiroscopioSiSePuede,
  giroscopioNecesitaPermiso,
  pedirPermisoGiroscopio,
  giroscopioActivo,
  esTactil,
} from '../holo.js';
import { dialogoExportar } from '../previa.js';
import { conectado } from '../github.js';
import { dialogoConectar, dialogoDesconectar, flujoCambiar } from '../fotos.js';

/** Celda de la rejilla: el cromo y, si estás conectado a GitHub, un botón para cambiar su foto. */
function celda(c) {
  const li = el('li.celda', {}, crearCromo(c));
  if (conectado() && pegadoDeVerdad(c)) {
    li.append(
      el(
        'button.celda__cambiar',
        {
          type: 'button',
          'aria-label': `Cambiar foto de ${c.numero} ${c.nombre}`,
          title: 'Cambiar foto',
          onclick: () => flujoCambiar(c, c.foto_mia),
        },
        el('span', { 'aria-hidden': 'true' }, '⟳'),
      ),
    );
  }
  return li;
}

const normalizar = (s) =>
  String(s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');

export function vistaAlbum(main, args) {
  const regiones = estado.regiones;
  let indice = paginaDesdeArg(args[0]);
  const filtros = { texto: '', categoria: '' };

  // ——— Herramientas: buscador, filtros, vista previa ———
  const inBuscar = el('input#buscar', { type: 'search', placeholder: t('buscar'), autocomplete: 'off', enterkeyhint: 'search' });
  const selCat = el(
    'select#filtro-cat',
    {},
    el('option', { value: '' }, t('todas')),
    estado.categorias.map((c) => el('option', { value: c }, nombreCategoria(c))),
  );
  const selReg = el(
    'select#filtro-reg',
    {},
    regiones.map((r, i) => el('option', { value: String(i) }, `${r.etiqueta} · ${r.nombre}`)),
  );
  const btnPrevia = el(
    'button.boton.boton--mini.interruptor',
    { type: 'button', 'aria-pressed': String(estado.modoPrevia) },
    t('modo_vista_previa'),
  );
  const btnExportar = el('button.boton.boton--mini', { type: 'button', onclick: dialogoExportar }, t('exportar'));
  const btnGitHub = el('button.boton.boton--mini.boton-gh', { type: 'button' });
  const pintarGitHub = () => {
    btnGitHub.textContent = conectado() ? '✓ GitHub conectado' : 'Conectar GitHub';
    btnGitHub.title = conectado() ? 'Puedes guardar fotos desde esta web' : 'Para guardar tus fotos desde la web';
  };
  pintarGitHub();
  btnGitHub.addEventListener('click', () => (conectado() ? dialogoDesconectar() : dialogoConectar()));
  const btnGiro = el('button.boton.boton--mini', { type: 'button', hidden: true }, t('activar_giroscopio'));
  const ayudaPrevia = el('p.album__ayuda-previa', { hidden: !estado.modoPrevia }, t('vista_previa_ayuda'));

  const herramientas = el(
    'div.album__herramientas',
    {},
    el('div.campo-buscar', {}, el('label.sr', { for: 'buscar' }, t('buscar')), inBuscar),
    el('div.campo-sel', {}, el('label', { for: 'filtro-cat' }, t('filtro_categoria')), selCat),
    el('div.campo-sel', {}, el('label', { for: 'filtro-reg' }, t('filtro_region')), selReg),
    el('div.album__acciones', {}, btnGitHub, btnPrevia, btnExportar, btnGiro),
  );

  // ——— Páginas ———
  const pista = el('div.album__pista');
  const visor = el(
    'div.album__visor',
    { role: 'region', 'aria-roledescription': 'carrusel', 'aria-label': 'Páginas del álbum' },
    pista,
  );
  const btnAnt = el('button.boton.boton--icono.album__flecha', { type: 'button', 'aria-label': t('anterior') }, '‹');
  const btnSig = el('button.boton.boton--icono.album__flecha', { type: 'button', 'aria-label': t('siguiente') }, '›');
  const puntos = el('div.album__puntos', { role: 'group', 'aria-label': 'Páginas' });
  const indicador = el('span.album__indicador', { 'aria-live': 'polite' });
  const navegacion = el('div.album__nav', {}, btnAnt, el('div.album__centro', {}, puntos, indicador), btnSig);
  const resultados = el('section.album__resultados', { hidden: true, 'aria-label': 'Resultados de búsqueda' });

  const raiz = el(
    'section.album',
    { 'aria-labelledby': 'album-titulo' },
    el('h1.sr#album-titulo', {}, t('nav_album')),
    herramientas,
    ayudaPrevia,
    resultados,
    visor,
    navegacion,
  );
  main.append(raiz);

  function renderPaginas() {
    pista.replaceChildren(
      ...regiones.map((r, i) => {
        const tengo = r.cromos.filter(pegado).length;
        return el(
          'article.pagina',
          { 'aria-labelledby': `pag-${r.id}`, dataset: { indice: String(i) }, style: { '--color-region': r.color } },
          el(
            'header.pagina__cabecera',
            {},
            el('span.pagina__etapa', {}, r.etiqueta),
            el('h2.pagina__titulo', { id: `pag-${r.id}` }, r.nombre),
            el('span.pagina__cuenta', {}, `${tengo} / ${r.cromos.length}`),
          ),
          el(
            'ul.rejilla',
            { role: 'list' },
            r.cromos.map((c) => celda(c)),
          ),
          el('footer.pagina__pie', { 'aria-hidden': 'true' }, `— ${i + 1} —`),
        );
      }),
    );
    puntos.replaceChildren(
      ...regiones.map((r, i) =>
        el('button.punto', { type: 'button', 'aria-label': `${r.etiqueta}: ${r.nombre}`, onclick: () => irA(i + 1) }),
      ),
    );
    for (const pag of pista.children) ro.observe(pag);
    colocar(false);
  }

  function colocar(animado = true) {
    pista.style.transition = animado && !reduceMotion() ? '' : 'none';
    pista.style.transform = `translateX(${-indice * 100}%)`;
    for (const [i, p] of [...pista.children].entries()) {
      const activa = i === indice;
      p.toggleAttribute('inert', !activa);
      p.setAttribute('aria-hidden', String(!activa));
    }
    for (const [i, b] of [...puntos.children].entries()) {
      if (i === indice) b.setAttribute('aria-current', 'true');
      else b.removeAttribute('aria-current');
    }
    const r = regiones[indice];
    indicador.textContent = fmt(t('pagina'), { p: indice + 1, t: regiones.length });
    btnAnt.disabled = indice === 0;
    btnSig.disabled = indice === regiones.length - 1;
    selReg.value = String(indice);
    raiz.style.setProperty('--color-region', r.color);
    ajustarAltura();
    animarNuevos();
  }

  // El visor toma la altura de la página activa
  function ajustarAltura() {
    const pag = pista.children[indice];
    if (pag) visor.style.height = `${pag.scrollHeight}px`;
  }

  /** «Pegar cromo»: la primera vez que se ve uno nuevo, cae y se asienta. */
  function animarNuevos() {
    const pag = pista.children[indice];
    if (!pag) return;
    const ya = vistos();
    let n = 0;
    for (const a of pag.querySelectorAll('.cromo--pegado')) {
      const id = a.dataset.id;
      if (ya.has(id)) continue;
      if (!reduceMotion()) {
        a.style.animationDelay = `${0.25 + n * 0.18}s`;
        a.classList.add('cromo--nuevo');
        a.addEventListener('animationend', () => a.classList.remove('cromo--nuevo'), { once: true });
        n++;
      }
      marcarVisto(id);
    }
    if (n) anunciar(t('nuevo_cromo'));
  }

  function irA(pagina, { actualizarHash = true } = {}) {
    const nuevo = Math.min(regiones.length - 1, Math.max(0, (Number(pagina) || 1) - 1));
    const cambia = nuevo !== indice;
    indice = nuevo;
    colocar(true);
    if (actualizarHash && location.hash !== `#/album/${indice + 1}`) history.replaceState(null, '', `#/album/${indice + 1}`);
    if (cambia) anunciar(`${regiones[indice].etiqueta}: ${regiones[indice].nombre}`);
  }

  // ——— Filtros y búsqueda ———
  function aplicarFiltros() {
    const activo = filtros.texto || filtros.categoria;
    resultados.hidden = !activo;
    visor.hidden = Boolean(activo);
    navegacion.hidden = Boolean(activo);
    if (!activo) {
      colocar(false);
      return;
    }
    const q = normalizar(filtros.texto);
    const lista = estado.cromos.filter(
      (c) =>
        (!filtros.categoria || c.categoria === filtros.categoria) &&
        (!q || normalizar(`${c.nombre} ${c.nombre_local} ${c.numero} ${c.descripcion} ${c.canton.join(' ')}`).includes(q)),
    );
    resultados.replaceChildren(
      el(
        'p.resultados__cuenta',
        { role: 'status' },
        lista.length ? fmt(t('resultados'), { n: lista.length }) : t('sin_resultados'),
      ),
      el(
        'ul.rejilla',
        { role: 'list' },
        lista.map((c) => celda(c)),
      ),
    );
  }
  inBuscar.addEventListener('input', () => {
    filtros.texto = inBuscar.value.trim();
    aplicarFiltros();
  });
  selCat.addEventListener('change', () => {
    filtros.categoria = selCat.value;
    aplicarFiltros();
  });
  selReg.addEventListener('change', () => {
    inBuscar.value = '';
    selCat.value = '';
    filtros.texto = filtros.categoria = '';
    aplicarFiltros();
    irA(Number(selReg.value) + 1);
  });

  // ——— Vista previa ———
  btnPrevia.addEventListener('click', () => {
    setModoPrevia(!estado.modoPrevia);
    btnPrevia.setAttribute('aria-pressed', String(estado.modoPrevia));
    ayudaPrevia.hidden = !estado.modoPrevia;
    refrescar();
    anunciar(estado.modoPrevia ? 'Modo vista previa activado.' : 'Modo vista previa desactivado.');
  });
  const actualizarExportar = () => (btnExportar.hidden = estado.previas.size === 0);

  // ——— Giroscopio (iOS pide permiso con un toque) ———
  iniciarGiroscopioSiSePuede();
  const hayBrillantesPegados = estado.cromos.some((c) => c.rareza === 'brillante' && pegado(c));
  if (esTactil() && giroscopioNecesitaPermiso() && !giroscopioActivo() && hayBrillantesPegados) {
    btnGiro.hidden = false;
    btnGiro.addEventListener('click', async () => {
      if (await pedirPermisoGiroscopio()) btnGiro.hidden = true;
    });
  }

  // ——— Gestos: swipe ———
  let x0 = null,
    y0 = 0,
    dx = 0,
    arrastrando = false;
  visor.addEventListener('pointerdown', (e) => {
    if (e.pointerType === 'mouse') return;
    x0 = e.clientX;
    y0 = e.clientY;
    dx = 0;
    arrastrando = false;
  });
  visor.addEventListener('pointermove', (e) => {
    if (x0 === null) return;
    dx = e.clientX - x0;
    const dy = e.clientY - y0;
    if (!arrastrando && Math.abs(dx) > 12 && Math.abs(dx) > Math.abs(dy) * 1.3) arrastrando = true;
    if (arrastrando) {
      pista.style.transition = 'none';
      pista.style.transform = `translateX(calc(${-indice * 100}% + ${dx}px))`;
    }
  });
  const soltar = () => {
    if (x0 === null) return;
    if (arrastrando) {
      const umbral = Math.min(90, visor.clientWidth * 0.2);
      if (dx < -umbral && indice < regiones.length - 1) irA(indice + 2);
      else if (dx > umbral && indice > 0) irA(indice);
      else colocar(true);
    }
    x0 = null;
    arrastrando = false;
  };
  visor.addEventListener('pointerup', soltar);
  visor.addEventListener('pointercancel', soltar);
  // Evita abrir un cromo al terminar un arrastre
  visor.addEventListener(
    'click',
    (e) => {
      if (Math.abs(dx) > 12) {
        e.preventDefault();
        e.stopPropagation();
        dx = 0;
      }
    },
    true,
  );

  btnAnt.addEventListener('click', () => irA(indice));
  btnSig.addEventListener('click', () => irA(indice + 2));

  const tecla = (e) => {
    if (document.querySelector('.ficha') || document.querySelector('.dialogo')) return;
    if (e.target.closest('input, textarea, select')) return;
    if (!visor.hidden && e.key === 'ArrowRight') {
      e.preventDefault();
      irA(indice + 2);
    } else if (!visor.hidden && e.key === 'ArrowLeft') {
      e.preventDefault();
      irA(indice);
    }
  };
  document.addEventListener('keydown', tecla);

  const alRedimensionar = () => colocar(false);
  const ro = new ResizeObserver(ajustarAltura);
  window.addEventListener('resize', alRedimensionar);

  function refrescar() {
    renderPaginas();
    if (!resultados.hidden) aplicarFiltros();
    actualizarExportar();
  }
  window.addEventListener('album:cambio', refrescar);
  const alConectar = () => {
    pintarGitHub();
    refrescar();
  };
  window.addEventListener('album:conexion', alConectar);
  const quitarHolo = activarHolo(raiz);

  // Ajusta la altura cuando cargan las imágenes
  pista.addEventListener('load', ajustarAltura, true);

  renderPaginas();
  actualizarExportar();
  if (args[0] === undefined) history.replaceState(null, '', `#/album/${indice + 1}`);

  return {
    irA: (p) => irA(p ?? indice + 1, { actualizarHash: false }),
    destruir() {
      document.removeEventListener('keydown', tecla);
      window.removeEventListener('resize', alRedimensionar);
      window.removeEventListener('album:cambio', refrescar);
      window.removeEventListener('album:conexion', alConectar);
      quitarHolo();
      ro.disconnect();
    },
  };
}

function paginaDesdeArg(arg) {
  const n = Number(arg);
  return Number.isFinite(n) && n >= 1 ? Math.min(n, estado.regiones.length) - 1 : 0;
}
