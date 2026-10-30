// «Compartir cromo»: genera una imagen 1080×1920 para Instagram Stories.
import { t, fotoDe, fechaDe, region } from './data.js';
import { el, url, formatoFecha, descargar, anunciar } from './util.js';
import { montarDialogo } from './previa.js';

const W = 1080;
const H = 1920;

function cargarImagen(src) {
  return new Promise((ok, mal) => {
    const img = new Image();
    img.decoding = 'async';
    img.onload = () => ok(img);
    img.onerror = () => mal(new Error('No se pudo cargar ' + src));
    img.src = src;
  });
}

/** Dibuja una imagen recortada para cubrir el rectángulo (como object-fit: cover). */
function cubrir(ctx, img, x, y, w, h) {
  const k = Math.max(w / img.width, h / img.height);
  const sw = w / k;
  const sh = h / k;
  ctx.drawImage(img, (img.width - sw) / 2, (img.height - sh) / 2, sw, sh, x, y, w, h);
}

function lineas(ctx, texto, maxAncho) {
  const palabras = String(texto).split(/\s+/);
  const res = [];
  let actual = '';
  for (const p of palabras) {
    const prueba = actual ? `${actual} ${p}` : p;
    if (ctx.measureText(prueba).width > maxAncho && actual) {
      res.push(actual);
      actual = p;
    } else actual = prueba;
  }
  if (actual) res.push(actual);
  return res;
}

function cruz(ctx, x, y, s) {
  ctx.fillStyle = '#d52b1e';
  ctx.beginPath();
  ctx.roundRect(x, y, s, s, s * 0.18);
  ctx.fill();
  ctx.fillStyle = '#fff';
  const b = s * 0.2;
  const l = s * 0.62;
  ctx.fillRect(x + (s - b) / 2, y + (s - l) / 2, b, l);
  ctx.fillRect(x + (s - l) / 2, y + (s - b) / 2, l, b);
}

export async function generarImagenStories(c) {
  await document.fonts?.ready;
  const lienzo = document.createElement('canvas');
  lienzo.width = W;
  lienzo.height = H;
  const ctx = lienzo.getContext('2d');
  const r = region(c.region);

  // Fondo: la foto libre del sitio, oscurecida, o un degradado si no está.
  ctx.fillStyle = '#1d2a30';
  ctx.fillRect(0, 0, W, H);
  try {
    const fondo = await cargarImagen(url(c.imagen.fondo));
    ctx.filter = 'blur(6px) saturate(1.1)';
    cubrir(ctx, fondo, -30, -30, W + 60, H + 60);
    ctx.filter = 'none';
  } catch {
    /* sin fondo */
  }
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, 'rgba(10,16,20,.55)');
  g.addColorStop(0.5, 'rgba(10,16,20,.35)');
  g.addColorStop(1, 'rgba(10,16,20,.9)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);

  // Cabecera tipo cartel
  cruz(ctx, 80, 120, 70);
  ctx.fillStyle = '#fbf8f1';
  ctx.font = '400 74px "Bebas Neue", Impact, sans-serif';
  ctx.textBaseline = 'alphabetic';
  ctx.fillText('GRAND TOUR', 172, 180);
  ctx.font = 'italic 600 34px Fraunces, Georgia, serif';
  ctx.fillText(`${r.etiqueta} · ${r.nombre}`, 174, 226);

  // Cromo: foto con borde blanco, girado
  const foto = await cargarImagen(fotoDe(c));
  const cw = 780;
  const ch = 1000;
  const cx = (W - cw) / 2;
  const cy = 340;
  ctx.save();
  ctx.translate(W / 2, cy + ch / 2);
  ctx.rotate((-3 * Math.PI) / 180);
  ctx.shadowColor = 'rgba(0,0,0,.55)';
  ctx.shadowBlur = 60;
  ctx.shadowOffsetY = 30;
  ctx.fillStyle = '#fbfaf6';
  ctx.fillRect(-cw / 2, -ch / 2, cw, ch);
  ctx.shadowColor = 'transparent';
  const m = 34;
  cubrir(ctx, foto, -cw / 2 + m, -ch / 2 + m, cw - 2 * m, ch - 2 * m - 120);
  if (c.rareza === 'brillante') {
    const holo = ctx.createLinearGradient(-cw / 2, -ch / 2, cw / 2, ch / 2);
    ['rgba(255,0,132,.18)', 'rgba(255,203,87,.18)', 'rgba(110,255,160,.18)', 'rgba(64,160,255,.18)', 'rgba(200,90,255,.18)'].forEach((col, i, a) =>
      holo.addColorStop(i / (a.length - 1), col),
    );
    ctx.globalCompositeOperation = 'overlay';
    ctx.fillStyle = holo;
    ctx.fillRect(-cw / 2 + m, -ch / 2 + m, cw - 2 * m, ch - 2 * m - 120);
    ctx.globalCompositeOperation = 'source-over';
  }
  // Pie del cromo: número + nombre
  ctx.fillStyle = '#d52b1e';
  ctx.font = '400 96px "Bebas Neue", Impact, sans-serif';
  ctx.fillText(c.numero, -cw / 2 + m, ch / 2 - 40);
  ctx.fillStyle = '#1d2a30';
  ctx.font = '600 40px Fraunces, Georgia, serif';
  const nombreL = lineas(ctx, c.nombre, cw - 2 * m - 130);
  nombreL.slice(0, 2).forEach((l, i) => ctx.fillText(l, -cw / 2 + m + 120, ch / 2 - (nombreL.length > 1 ? 82 : 52) + i * 44));
  ctx.restore();

  // Título grande y fecha
  ctx.fillStyle = '#fbf8f1';
  ctx.font = '800 84px Fraunces, Georgia, serif';
  const titulo = lineas(ctx, c.nombre, W - 160);
  let y = 1500;
  for (const l of titulo.slice(0, 2)) {
    ctx.fillText(l, 80, y);
    y += 92;
  }
  const f = fechaDe(c);
  ctx.font = '600 38px "Source Sans 3", system-ui, sans-serif';
  ctx.fillStyle = '#ffd9d4';
  ctx.fillText(`Cromo nº ${c.numero}${f ? ' · ' + formatoFecha(f) : ''}`, 80, y + 10);
  if (c.rareza === 'brillante') {
    ctx.fillStyle = '#f6e7a8';
    ctx.fillText(`✦ ${t('brillante')}`, 80, y + 60);
  }
  ctx.font = '400 26px "Source Sans 3", system-ui, sans-serif';
  ctx.fillStyle = 'rgba(251,248,241,.7)';
  ctx.fillText('Mi álbum del Grand Tour of Switzerland · proyecto personal no oficial', 80, H - 70);

  return new Promise((ok) => lienzo.toBlob(ok, 'image/png'));
}

export async function compartirCromo(c) {
  anunciar(t('compartiendo'));
  let blob;
  try {
    blob = await generarImagenStories(c);
  } catch (e) {
    anunciar('No se pudo generar la imagen.');
    console.error(e);
    return;
  }
  const nombre = `cromo-${c.numero}-${c.id}.png`;
  const archivo = new File([blob], nombre, { type: 'image/png' });
  const src = URL.createObjectURL(blob);
  const puedeCompartir = navigator.canShare?.({ files: [archivo] });
  const caja = el(
    'div.dialogo__caja.compartir',
    { role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'comp-titulo' },
    el('h2#comp-titulo', {}, t('compartir_listo')),
    el('img.compartir__img', { src, alt: `Imagen para Stories del cromo ${c.numero}: ${c.nombre}` }),
    el(
      'div.dialogo__acciones',
      {},
      el('button.boton', { type: 'button', onclick: () => cerrar() }, t('cerrar')),
      el('button.boton', { type: 'button', onclick: () => descargar(blob, nombre) }, t('descargar')),
      puedeCompartir
        ? el(
            'button.boton.boton--rojo',
            {
              type: 'button',
              autofocus: true,
              onclick: async () => {
                try {
                  await navigator.share({ files: [archivo], title: c.nombre });
                } catch {
                  /* cancelado */
                }
              },
            },
            t('compartir'),
          )
        : null,
    ),
  );
  const cerrar = montarDialogo(caja, { alCerrar: () => URL.revokeObjectURL(src) });
}
