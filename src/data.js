// Carga los datos del álbum y une los textos del idioma activo.
import { url } from './util.js';
import { leerTodas, guardar, borrar } from './idb.js';
import { conexion, leerJSON } from './github.js';

export const IDIOMA = 'es';

export const estado = {
  cromos: [],
  porId: new Map(),
  regiones: [],
  categorias: [],
  ruta: null,
  i18n: null,
  previas: new Map(), // id -> { blob, fecha, nota, objectURL }
  fotosLocales: new Map(), // ruta -> objectURL de fotos recién subidas a GitHub (aún sin publicar)
  modoPrevia: false,
};

const cargarJSON = async (ruta) => {
  const r = await fetch(url(ruta), { cache: 'no-cache' });
  if (!r.ok) throw new Error(`No se pudo cargar ${ruta} (${r.status})`);
  return r.json();
};

/** Si estás conectado a GitHub, se leen tus datos más recientes (sin esperar a que se publique la web). */
async function cargarCromos() {
  if (conexion()) {
    try {
      return await leerJSON('data/cromos.json');
    } catch {
      /* sin red o token caducado: se usa la versión publicada */
    }
  }
  return cargarJSON('data/cromos.json');
}

export async function cargarDatos() {
  const [base, i18n, album] = await Promise.all([
    cargarCromos(),
    cargarJSON(`data/i18n/${IDIOMA}.json`),
    cargarJSON('data/album.json'),
  ]);
  estado.i18n = i18n;
  estado.cromos = base.cromos.map((c) => ({ ...c, ...(i18n.cromos?.[c.id] || {}), nombre_local: c.nombre }));
  estado.porId = new Map(estado.cromos.map((c) => [c.id, c]));
  estado.regiones = album.regiones.map((r) => ({
    ...r,
    ...(i18n.regiones?.[r.id] || {}),
    cromos: estado.cromos.filter((c) => c.region === r.id),
  }));
  estado.categorias = album.categorias;
  estado.ruta = album.ruta;
  for (const p of await leerTodas()) {
    if (estado.porId.has(p.id)) estado.previas.set(p.id, { ...p, objectURL: URL.createObjectURL(p.blob) });
  }
  try {
    estado.modoPrevia = localStorage.getItem('modo-previa') === '1';
  } catch {
    /* almacenamiento no disponible */
  }
}

/** Texto de la interfaz. */
export const t = (clave) => estado.i18n?.ui?.[clave] ?? clave;
export const nombreCategoria = (c) => estado.i18n?.categorias?.[c] ?? c;
export const nombreCanton = (cod) => estado.i18n?.cantones?.[cod] ?? cod;
export const region = (id) => estado.regiones.find((r) => r.id === id);

/** ¿Está el cromo «pegado»? (de verdad, o en vista previa) */
export const pegado = (c) => Boolean((c.visitado && c.foto_mia) || estado.previas.has(c.id));
export const pegadoDeVerdad = (c) => Boolean(c.visitado && c.foto_mia);
export const enPrevia = (c) => estado.previas.has(c.id) && !pegadoDeVerdad(c);

/** src de una foto propia: la copia local recién subida o la publicada en la web. */
export const srcFoto = (ruta) => estado.fotosLocales.get(ruta) || url(ruta);

export function fotoDe(c) {
  const p = estado.previas.get(c.id);
  if (p && !pegadoDeVerdad(c)) return p.objectURL;
  return c.foto_mia ? srcFoto(c.foto_mia) : null;
}
export function fechaDe(c) {
  return enPrevia(c) ? estado.previas.get(c.id).fecha : c.fecha_visita;
}
export function notaDe(c) {
  return enPrevia(c) ? estado.previas.get(c.id).nota : c.nota_personal;
}

export const totalPegados = () => estado.cromos.filter(pegado).length;

export async function guardarPrevia(id, { blob, fecha, nota }) {
  const anterior = estado.previas.get(id);
  if (anterior?.objectURL) URL.revokeObjectURL(anterior.objectURL);
  const reg = { id, blob, fecha: fecha || null, nota: nota || '' };
  await guardar(reg);
  estado.previas.set(id, { ...reg, objectURL: URL.createObjectURL(blob) });
}

export async function borrarPrevia(id) {
  const p = estado.previas.get(id);
  if (p?.objectURL) URL.revokeObjectURL(p.objectURL);
  estado.previas.delete(id);
  await borrar(id);
}

export function setModoPrevia(v) {
  estado.modoPrevia = v;
  try {
    localStorage.setItem('modo-previa', v ? '1' : '0');
  } catch {
    /* sin almacenamiento */
  }
}

/** JSON exportable: cromos.json original + vistas previas marcadas como visitadas. */
export async function jsonExportado() {
  const base = await cargarJSON('data/cromos.json');
  for (const c of base.cromos) {
    const p = estado.previas.get(c.id);
    if (!p) continue;
    c.visitado = true;
    c.foto_mia = `fotos/${c.id}.jpg`;
    c.fotos = [...new Set([...(c.foto_de_prueba ? [] : c.fotos || []), c.foto_mia])];
    c.foto_de_prueba = false;
    c.fecha_visita = p.fecha || c.fecha_visita || null;
    c.nota_personal = p.nota || c.nota_personal || '';
  }
  return JSON.stringify(base, null, 2) + '\n';
}

// Cromos ya «vistos» (para la animación de pegar solo la primera vez).
const CLAVE_VISTOS = 'cromos-vistos';
export function vistos() {
  try {
    return new Set(JSON.parse(localStorage.getItem(CLAVE_VISTOS) || '[]'));
  } catch {
    return new Set();
  }
}
export function marcarVisto(id) {
  try {
    const v = vistos();
    v.add(id);
    localStorage.setItem(CLAVE_VISTOS, JSON.stringify([...v]));
  } catch {
    /* sin almacenamiento */
  }
}
