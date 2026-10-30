#!/usr/bin/env node
// Pega una foto tuya en un cromo (cada cromo puede tener varias; una es la portada):
//   npm run pegar
//       → pregunta el cromo (id o número), la ruta de la foto, si es la portada y una nota.
//   npm run pegar -- --cromo 26 --foto ~/Fotos/IMG_1234.jpg --nota "¡Qué frío!"
//       → lo mismo sin preguntas; la foto nueva pasa a ser la portada salvo con --no-portada
//         (--fecha AAAA-MM-DD para fijar la fecha a mano).
//   npm run pegar -- --quitar 26          → despega ese cromo (borra todas sus fotos).
//   npm run pegar -- --quitar-pruebas     → quita los 3 cromos de ejemplo.
//
// La foto se redimensiona (1600 px como máximo), se guarda en fotos/<id>-<código>.jpg y
// se le quitan TODOS los metadatos (GPS incluido). La fecha se lee del EXIF original.
// También puedes hacer todo esto desde la web, conectándola a GitHub.
import { readFile, writeFile, mkdir, unlink, access } from 'node:fs/promises';
import { createInterface } from 'node:readline';
import { stdin, stdout, argv, exit } from 'node:process';
import { join, resolve } from 'node:path';
import { homedir } from 'node:os';
import sharp from 'sharp';
import exifr from 'exifr';

const RAIZ = new URL('..', import.meta.url).pathname;
const RUTA_JSON = join(RAIZ, 'data/cromos.json');
const LADO_MAX = 1600;

const args = argv.slice(2);
const opcion = (n) => (args.includes(`--${n}`) ? args[args.indexOf(`--${n}`) + 1] : undefined);
const existe = (p) =>
  access(p).then(
    () => true,
    () => false,
  );

const leerDatos = async () => JSON.parse(await readFile(RUTA_JSON, 'utf8'));
// Nombre en español (data/i18n/es.json) solo para mostrarlo en la consola
let nombresES = {};
try {
  nombresES = JSON.parse(await readFile(join(RAIZ, 'data/i18n/es.json'), 'utf8')).cromos || {};
} catch {
  /* sin textos */
}
const nombre = (c) => nombresES[c.id]?.nombre || c.nombre;
const guardarDatos = (d) => writeFile(RUTA_JSON, JSON.stringify(d, null, 2) + '\n');

function buscarCromo(cromos, q) {
  const s = String(q || '')
    .trim()
    .toLowerCase();
  if (!s) return null;
  return (
    cromos.find((c) => c.id === s) ||
    cromos.find((c) => c.numero === s.padStart(2, '0')) ||
    cromos.find((c) => c.nombre.toLowerCase() === s || nombre(c).toLowerCase() === s) ||
    null
  );
}

const expandir = (p) =>
  resolve(
    String(p)
      .trim()
      .replace(/^['"]|['"]$/g, '')
      .replace(/^~(?=$|\/)/, homedir()),
  );

async function fechaExif(ruta) {
  try {
    const d = await exifr.parse(ruta, ['DateTimeOriginal', 'CreateDate', 'ModifyDate']);
    const f = d?.DateTimeOriginal || d?.CreateDate || d?.ModifyDate;
    if (f instanceof Date && !Number.isNaN(f.getTime())) {
      const z = (n) => String(n).padStart(2, '0');
      return `${f.getFullYear()}-${z(f.getMonth() + 1)}-${z(f.getDate())}`;
    }
  } catch {
    /* sin EXIF */
  }
  return null;
}

async function despegar(datos, c) {
  for (const ruta of new Set([...(c.fotos || []), c.foto_mia].filter(Boolean))) {
    if (await existe(join(RAIZ, ruta))) await unlink(join(RAIZ, ruta));
  }
  c.fotos = [];
  c.foto_mia = null;
  c.fecha_visita = null;
  c.nota_personal = '';
  c.visitado = false;
  c.foto_de_prueba = false;
  delete c.foto_credito;
  await guardarDatos(datos);
  console.log(`Cromo ${c.numero} · ${nombre(c)} despegado.`);
}

async function main() {
  const datos = await leerDatos();
  const { cromos } = datos;

  if (args.includes('--quitar-pruebas')) {
    const pruebas = cromos.filter((c) => c.foto_de_prueba);
    for (const c of pruebas) await despegar(datos, c);
    console.log(pruebas.length ? `Quitados ${pruebas.length} cromos de prueba.` : 'No había cromos de prueba.');
    return;
  }
  if (opcion('quitar')) {
    const c = buscarCromo(cromos, opcion('quitar'));
    if (!c) throw new Error(`No encuentro el cromo «${opcion('quitar')}».`);
    await despegar(datos, c);
    return;
  }

  // Cola de líneas: funciona igual tecleando que con la entrada redirigida (printf … | npm run pegar)
  const rl = createInterface({ input: stdin, terminal: stdin.isTTY });
  const lineas = [];
  const esperando = [];
  let cerrado = false;
  rl.on('line', (l) => (esperando.length ? esperando.shift()(l) : lineas.push(l)));
  rl.on('close', () => {
    cerrado = true;
    while (esperando.length) esperando.shift()(null);
  });
  const siguienteLinea = () =>
    lineas.length ? Promise.resolve(lineas.shift()) : cerrado ? Promise.resolve(null) : new Promise((ok) => esperando.push(ok));
  const preguntar = async (txt, porDefecto) => {
    stdout.write(porDefecto ? `${txt} [${porDefecto}]: ` : `${txt}: `);
    const r = await siguienteLinea();
    if (r === null) throw new Error('Entrada terminada antes de tiempo.');
    if (!stdin.isTTY) stdout.write(r + '\n');
    return r.trim() || porDefecto || '';
  };

  try {
    // 1. Cromo
    let c = buscarCromo(cromos, opcion('cromo'));
    while (!c) {
      const r = await preguntar('¿Qué cromo? (id como «matterhorn» o número como «26»)');
      c = buscarCromo(cromos, r);
      if (!c)
        console.log(
          '  No lo encuentro. Ejemplos: ' +
            cromos
              .slice(0, 4)
              .map((x) => `${x.numero}=${x.id}`)
              .join(', ') +
            '…',
        );
    }
    const previas = c.foto_de_prueba ? [] : c.fotos || [];
    console.log(
      `→ ${c.numero} · ${nombre(c)}${previas.length ? `  (ya tiene ${previas.length} foto${previas.length > 1 ? 's' : ''}: se añade otra)` : ''}`,
    );

    // 2. Foto
    let origen = opcion('foto') ? expandir(opcion('foto')) : null;
    while (!origen || !(await existe(origen))) {
      if (origen) console.log(`  No existe: ${origen}`);
      origen = expandir(await preguntar('Ruta de la foto (puedes arrastrarla aquí)'));
    }

    // 3. Fecha (EXIF) y nota
    const exif = await fechaExif(origen);
    let fecha = opcion('fecha') || (opcion('cromo') && opcion('foto') ? exif : null);
    if (!fecha) fecha = await preguntar('Fecha de la visita (AAAA-MM-DD)', exif || new Date().toISOString().slice(0, 10));
    if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) throw new Error(`Fecha no válida: ${fecha}`);
    const sinPreguntas = Boolean(opcion('cromo') && opcion('foto'));
    const nota =
      opcion('nota') ??
      (sinPreguntas
        ? c.foto_de_prueba
          ? ''
          : c.nota_personal || ''
        : await preguntar('Nota personal (opcional)', c.foto_de_prueba ? '' : c.nota_personal));
    let portada = !args.includes('--no-portada');
    if (previas.length && !sinPreguntas) portada = !/^n/i.test(await preguntar('¿Usarla como portada del cromo? (s/n)', 's'));

    // 4. Redimensionar, quitar metadatos y guardar
    await mkdir(join(RAIZ, 'fotos'), { recursive: true });
    const destinoRel = `fotos/${c.id}-${Date.now().toString(36)}.jpg`;
    const info = await sharp(origen)
      .rotate() // aplica la orientación EXIF antes de descartar los metadatos
      .resize({ width: LADO_MAX, height: LADO_MAX, fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: 85, mozjpeg: true })
      .toFile(join(RAIZ, destinoRel)); // sharp no copia EXIF/GPS salvo que se pida con withMetadata()

    // 5. Actualizar el JSON (la foto de prueba, si la había, se borra)
    if (c.foto_de_prueba) {
      for (const ruta of c.fotos || []) if (await existe(join(RAIZ, ruta))) await unlink(join(RAIZ, ruta));
      c.fotos = [];
    }
    c.fotos = [...(c.fotos || []), destinoRel];
    if (portada || !c.foto_mia || c.foto_de_prueba) c.foto_mia = destinoRel;
    c.fecha_visita = fecha;
    c.nota_personal = nota;
    c.visitado = true;
    c.foto_de_prueba = false;
    delete c.foto_credito;
    await guardarDatos(datos);

    console.log(`\n✓ Cromo ${c.numero} · ${nombre(c)} pegado.`);
    console.log(
      `  Foto: ${destinoRel} (${info.width}×${info.height}, sin metadatos)${c.foto_mia === destinoRel ? ' · portada' : ''}`,
    );
    console.log(`  Fotos del cromo: ${c.fotos.length}`);
    console.log(`  Fecha: ${fecha}${exif && exif === fecha ? ' (del EXIF)' : ''}`);
    if (nota) console.log(`  Nota: ${nota}`);
    console.log('\nAhora: git add fotos data && git commit -m "Pego el cromo ' + c.numero + '" && git push');
  } finally {
    rl.close();
  }
}

main().catch((e) => {
  console.error('✗ ' + e.message);
  exit(1);
});
