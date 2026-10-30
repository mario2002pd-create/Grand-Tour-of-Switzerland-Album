#!/usr/bin/env node
// Comprueba que data/cromos.json y los textos de cada idioma están completos.
//   npm run validar
import { readFile, readdir, access } from 'node:fs/promises';
import { join } from 'node:path';

const RAIZ = new URL('..', import.meta.url).pathname;
const leer = async (p) => JSON.parse(await readFile(join(RAIZ, p), 'utf8'));
const existe = (p) =>
  access(join(RAIZ, p)).then(
    () => true,
    () => false,
  );

const errores = [];
const avisos = [];
const { cromos } = await leer('data/cromos.json');
const album = await leer('data/album.json');
const regiones = new Set(album.regiones.map((r) => r.id));
const categorias = new Set(album.categorias);

const CAMPOS = ['id', 'numero', 'nombre', 'canton', 'region', 'categoria', 'coordenadas', 'altitud', 'rareza', 'enlace_oficial', 'imagen'];
const CAMPOS_USUARIO = ['foto_mia', 'fecha_visita', 'nota_personal', 'visitado'];
const ids = new Set();
const numeros = new Set();

for (const c of cromos) {
  const q = `${c.numero ?? '??'} ${c.id ?? '(sin id)'}`;
  for (const k of [...CAMPOS, ...CAMPOS_USUARIO]) if (!(k in c)) errores.push(`${q}: falta el campo «${k}»`);
  if (ids.has(c.id)) errores.push(`${q}: id repetido`);
  if (numeros.has(c.numero)) errores.push(`${q}: número repetido`);
  ids.add(c.id);
  numeros.add(c.numero);
  if (!regiones.has(c.region)) errores.push(`${q}: región desconocida «${c.region}»`);
  if (!categorias.has(c.categoria)) errores.push(`${q}: categoría desconocida «${c.categoria}»`);
  if (!['normal', 'brillante'].includes(c.rareza)) errores.push(`${q}: rareza no válida`);
  const { lat, lon } = c.coordenadas || {};
  if (!(lat > 45.8 && lat < 47.9 && lon > 5.9 && lon < 10.6)) errores.push(`${q}: coordenadas fuera de Suiza`);
  if (!(c.altitud > 150 && c.altitud < 4700)) errores.push(`${q}: altitud sospechosa (${c.altitud})`);
  for (const k of ['autor', 'licencia', 'licencia_url', 'fuente']) if (!c.imagen?.[k]) errores.push(`${q}: falta imagen.${k}`);
  for (const k of ['fondo', 'miniatura', 'silueta']) if (c.imagen?.[k] && !(await existe(c.imagen[k]))) avisos.push(`${q}: aún no existe ${c.imagen[k]} (ejecuta «npm run fondos»)`);
  if (c.visitado && !c.foto_mia) errores.push(`${q}: visitado=true pero sin foto_mia`);
  if (c.foto_mia && !(await existe(c.foto_mia))) errores.push(`${q}: no existe la foto ${c.foto_mia}`);
  if (c.fecha_visita && !/^\d{4}-\d{2}-\d{2}$/.test(c.fecha_visita)) errores.push(`${q}: fecha_visita debe ser AAAA-MM-DD`);
}

// Textos por idioma
for (const f of (await readdir(join(RAIZ, 'data/i18n'))).filter((n) => n.endsWith('.json'))) {
  const i18n = await leer(`data/i18n/${f}`);
  for (const c of cromos) {
    const tx = i18n.cromos?.[c.id];
    if (!tx) {
      (f === 'es.json' ? errores : avisos).push(`${f}: faltan los textos de ${c.id}`);
      continue;
    }
    for (const k of ['nombre', 'descripcion', 'curiosidades', 'mejor_epoca', 'como_llegar']) {
      if (!tx[k] || (Array.isArray(tx[k]) && tx[k].length < 2)) errores.push(`${f}: ${c.id} sin «${k}» completo`);
    }
  }
}

const brillantes = cromos.filter((c) => c.rareza === 'brillante').length;
console.log(`${cromos.length} cromos · ${brillantes} brillantes · ${cromos.filter((c) => c.visitado).length} pegados`);
for (const a of avisos) console.log('⚠ ' + a);
for (const e of errores) console.log('✗ ' + e);
if (errores.length) {
  console.log(`\n${errores.length} errores.`);
  process.exit(1);
}
console.log(avisos.length ? `\nOK, con ${avisos.length} avisos.` : '\nTodo OK.');
