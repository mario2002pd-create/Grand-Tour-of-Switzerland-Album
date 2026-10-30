#!/usr/bin/env node
// Descarga las fotos de fondo desde Wikimedia Commons (según data/cromos.json),
// las convierte a WebP de 1600 px + miniatura de 480 px y genera la silueta gris
// de cada sitio. Solo procesa lo que falta, salvo que se use --forzar.
//
//   npm run fondos                 # descarga lo que falte
//   npm run fondos -- --forzar     # lo regenera todo
//   npm run fondos -- --desde dir  # usa originales locales (dir/<id>.jpg|.img) si existen
//   npm run fondos -- --estricto   # sale con error si falta alguna imagen
//   npm run fondos -- --ids a,b    # solo esos cromos
import { readFile, writeFile, mkdir, access } from 'node:fs/promises';
import { join } from 'node:path';
import sharp from 'sharp';

const RAIZ = new URL('..', import.meta.url).pathname;
const UA = 'GrandTourAlbum/1.0 (+https://github.com/mario2002pd-create/Grand-Tour-of-Switzerland-Album)';
const ANCHO = 1600;
const ANCHO_MINI = 480;
const ANCHO_SILUETA = 480;

const args = process.argv.slice(2);
const forzar = args.includes('--forzar');
const estricto = args.includes('--estricto');
const desde = args.includes('--desde') ? args[args.indexOf('--desde') + 1] : null;
const soloIds = args.includes('--ids') ? new Set(args[args.indexOf('--ids') + 1].split(',')) : null;

const existe = (p) =>
  access(p).then(
    () => true,
    () => false,
  );
const espera = (ms) => new Promise((r) => setTimeout(r, ms));

function archivoCommons(fuente) {
  const m = String(fuente).match(/\/wiki\/File:(.+)$/);
  return m ? decodeURIComponent(m[1]) : null;
}

async function descargar(nombre) {
  const base = 'https://commons.wikimedia.org/wiki/Special:FilePath/' + encodeURIComponent(nombre.replace(/ /g, '_'));
  // Wikimedia solo sirve miniaturas en tamaños estándar (1920, 1280, 960…).
  for (const suf of ['?width=1920', '?width=1280', '?width=960', '']) {
    for (let intento = 0; intento < 4; intento++) {
      try {
        const r = await fetch(base + suf, { headers: { 'User-Agent': UA }, redirect: 'follow' });
        if (r.ok) {
          const buf = Buffer.from(await r.arrayBuffer());
          if (buf.length > 1000) return buf;
        }
        if (r.status === 404) break;
        await espera(4000 * (intento + 1));
      } catch {
        await espera(4000 * (intento + 1));
      }
    }
  }
  throw new Error('no se pudo descargar ' + nombre);
}

/** Umbral de Otsu sobre un histograma de grises. */
function otsu(gris) {
  const hist = new Array(256).fill(0);
  for (const v of gris) hist[v]++;
  const total = gris.length;
  let suma = 0;
  for (let i = 0; i < 256; i++) suma += i * hist[i];
  let sumaB = 0,
    pesoB = 0,
    mejor = 0,
    umbral = 128;
  for (let i = 0; i < 256; i++) {
    pesoB += hist[i];
    if (!pesoB) continue;
    const pesoF = total - pesoB;
    if (!pesoF) break;
    sumaB += i * hist[i];
    const mB = sumaB / pesoB;
    const mF = (suma - sumaB) / pesoF;
    const entre = pesoB * pesoF * (mB - mF) ** 2;
    if (entre > mejor) {
      mejor = entre;
      umbral = i;
    }
  }
  return umbral;
}

/** Silueta: zonas oscuras de la foto → gris semitransparente; zonas claras (cielo) → transparente. */
async function silueta(buf) {
  const { data, info } = await sharp(buf)
    .resize({ width: ANCHO_SILUETA, withoutEnlargement: false })
    .greyscale()
    .blur(1.6)
    .raw()
    .toBuffer({ resolveWithObject: true });
  const u = otsu(data);
  const rgba = Buffer.alloc(info.width * info.height * 4);
  for (let i = 0; i < data.length; i++) {
    const v = data[i];
    // Transición suave de ±12 niveles alrededor del umbral
    const a = Math.max(0, Math.min(1, (u + 12 - v) / 24));
    rgba[i * 4] = 112;
    rgba[i * 4 + 1] = 116;
    rgba[i * 4 + 2] = 118;
    rgba[i * 4 + 3] = Math.round(a * 235);
  }
  return sharp(rgba, { raw: { width: info.width, height: info.height, channels: 4 } })
    .webp({ quality: 70, alphaQuality: 70 })
    .toBuffer();
}

async function original(id, fuente) {
  if (desde) {
    for (const ext of ['.jpg', '.jpeg', '.png', '.img', '.webp']) {
      const p = join(desde, id + ext);
      if (await existe(p)) {
        const b = await readFile(p);
        if (b.length > 1000) return b;
      }
    }
  }
  const nombre = archivoCommons(fuente);
  if (!nombre) throw new Error('fuente no reconocida: ' + fuente);
  const b = await descargar(nombre);
  await espera(2500); // ser amables con Wikimedia
  return b;
}

async function main() {
  const { cromos } = JSON.parse(await readFile(join(RAIZ, 'data/cromos.json'), 'utf8'));
  await mkdir(join(RAIZ, 'img/fondos'), { recursive: true });
  await mkdir(join(RAIZ, 'img/siluetas'), { recursive: true });
  const fallos = [];
  let hechos = 0;
  for (const c of cromos) {
    if (soloIds && !soloIds.has(c.id)) continue;
    const dFondo = join(RAIZ, c.imagen.fondo);
    const dMini = join(RAIZ, c.imagen.miniatura);
    const dSil = join(RAIZ, c.imagen.silueta);
    if (!forzar && (await existe(dFondo)) && (await existe(dMini)) && (await existe(dSil))) continue;
    try {
      const buf = await original(c.id, c.imagen.fuente);
      const img = sharp(buf).rotate();
      await writeFile(dFondo, await img.clone().resize({ width: ANCHO, withoutEnlargement: true }).webp({ quality: 78 }).toBuffer());
      await writeFile(dMini, await img.clone().resize({ width: ANCHO_MINI, withoutEnlargement: true }).webp({ quality: 72 }).toBuffer());
      await writeFile(dSil, await silueta(buf));
      const meta = await sharp(buf).metadata();
      hechos++;
      console.log(`✓ ${c.numero} ${c.id} (${meta.width}×${meta.height})${meta.width < 1200 ? '  ⚠ original pequeño' : ''}`);
    } catch (e) {
      fallos.push(c.id);
      console.log(`✗ ${c.numero} ${c.id}: ${e.message}`);
    }
  }
  console.log(`\nProcesados: ${hechos}. Fallidos: ${fallos.length}${fallos.length ? ' → ' + fallos.join(', ') : ''}`);
  if (estricto && fallos.length) process.exit(1);
}

main();
