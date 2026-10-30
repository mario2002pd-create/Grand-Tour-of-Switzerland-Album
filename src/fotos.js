// Tus fotos de cada cromo: varias por cromo, una de portada. Se guardan en GitHub
// (carpeta fotos/ + data/cromos.json) desde la propia web, con un solo commit por cambio.
import { estado, t, srcFoto } from './data.js';
import {
  conexion,
  guardarConexion,
  olvidarConexion,
  probarConexion,
  leerJSON,
  commit,
  urlCruda,
  REPO_POR_DEFECTO,
} from './github.js';
import { reducir, fechaExif, montarDialogo } from './previa.js';
import { el, anunciar } from './util.js';

// ——— Rutas e imágenes ———

/** <img> de una foto propia; si la web aún no la ha publicado, la toma directamente de GitHub. */
export function imgFoto(ruta, attrs = {}) {
  return el('img', {
    src: srcFoto(ruta),
    decoding: 'async',
    ...attrs,
    onerror: (e) => {
      const img = e.currentTarget;
      if (img.dataset.cruda) return;
      img.dataset.cruda = '1';
      img.src = urlCruda(ruta);
    },
  });
}

export const fotosDe = (c) => (c.fotos?.length ? c.fotos : c.foto_mia ? [c.foto_mia] : []);

const rutaNueva = (id) => `fotos/${id}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}.jpg`;

// ——— Edición (siempre sobre la última versión de cromos.json en GitHub) ———

function normalizar(c) {
  c.fotos = [...new Set((c.fotos || []).filter(Boolean))];
  if (!c.fotos.includes(c.foto_mia)) c.foto_mia = c.fotos[0] || null;
  c.visitado = c.fotos.length > 0;
  if (!c.visitado) c.foto_de_prueba = false;
}

/** Quita las fotos de prueba de un cromo antes de poner las tuyas. */
function quitarPrueba(c, borrar) {
  if (!c.foto_de_prueba) return;
  borrar.push(...(c.fotos || []));
  c.fotos = [];
  c.foto_mia = null;
  c.foto_de_prueba = false;
  delete c.foto_credito;
  c.nota_personal = '';
  c.fecha_visita = null;
}

const CAMPOS = ['fotos', 'foto_mia', 'foto_de_prueba', 'foto_credito', 'fecha_visita', 'nota_personal', 'visitado'];

function aplicarALocal(datos) {
  for (const remoto of datos.cromos) {
    const local = estado.porId.get(remoto.id);
    if (!local) continue;
    for (const k of CAMPOS) {
      if (k in remoto) local[k] = remoto[k];
      else delete local[k];
    }
  }
}

async function editar(id, mensaje, fn) {
  const datos = await leerJSON('data/cromos.json');
  const c = datos.cromos.find((x) => x.id === id);
  if (!c) throw new Error(`El cromo ${id} no existe en el repositorio.`);
  const subir = [];
  const borrar = [];
  await fn(c, { subir, borrar });
  normalizar(c);
  const quedan = new Set(datos.cromos.flatMap((x) => x.fotos || []));
  const cambios = [
    ...subir.map((s) => ({ ruta: s.ruta, contenido: s.blob })),
    ...borrar.filter((r) => !quedan.has(r)).map((r) => ({ ruta: r, borrar: true })),
    { ruta: 'data/cromos.json', contenido: JSON.stringify(datos, null, 2) + '\n' },
  ];
  await commit(mensaje, cambios);
  for (const s of subir) estado.fotosLocales.set(s.ruta, URL.createObjectURL(s.blob));
  aplicarALocal(datos);
  window.dispatchEvent(new CustomEvent('album:cambio'));
}

export function anadirFotos(cromo, blobs, { fecha, nota, portada }) {
  const n = blobs.length;
  return editar(
    cromo.id,
    `${n > 1 ? `Añado ${n} fotos` : 'Añado una foto'} al cromo ${cromo.numero} (${cromo.nombre})`,
    (c, { subir, borrar }) => {
      quitarPrueba(c, borrar);
      const nuevas = blobs.map((blob) => ({ ruta: rutaNueva(c.id), blob }));
      subir.push(...nuevas);
      c.fotos = [...(c.fotos || []), ...nuevas.map((x) => x.ruta)];
      if (portada || !c.foto_mia) c.foto_mia = nuevas[0].ruta;
      if (fecha) c.fecha_visita = fecha;
      if (nota !== undefined) c.nota_personal = nota;
    },
  );
}

export function cambiarFoto(cromo, rutaVieja, blob) {
  return editar(cromo.id, `Cambio una foto del cromo ${cromo.numero} (${cromo.nombre})`, (c, { subir, borrar }) => {
    const ruta = rutaNueva(c.id);
    subir.push({ ruta, blob });
    if (c.foto_de_prueba) {
      quitarPrueba(c, borrar);
      c.fotos = [ruta];
      c.foto_mia = ruta;
      return;
    }
    const fotos = c.fotos || [];
    const i = fotos.indexOf(rutaVieja);
    if (i >= 0) {
      fotos[i] = ruta;
      borrar.push(rutaVieja);
    } else fotos.push(ruta);
    c.fotos = fotos;
    if (c.foto_mia === rutaVieja || !c.foto_mia) c.foto_mia = ruta;
  });
}

export function hacerPortada(cromo, ruta) {
  return editar(cromo.id, `Nueva portada para el cromo ${cromo.numero} (${cromo.nombre})`, (c) => {
    if ((c.fotos || []).includes(ruta)) c.foto_mia = ruta;
  });
}

export function borrarFoto(cromo, ruta) {
  return editar(cromo.id, `Borro una foto del cromo ${cromo.numero} (${cromo.nombre})`, (c, { borrar }) => {
    c.fotos = (c.fotos || []).filter((r) => r !== ruta);
    borrar.push(ruta);
    if (!c.fotos.length) {
      c.foto_de_prueba = false;
      delete c.foto_credito;
    }
  });
}

export function guardarTextos(cromo, { fecha, nota }) {
  return editar(cromo.id, `Actualizo fecha y nota del cromo ${cromo.numero} (${cromo.nombre})`, (c) => {
    c.fecha_visita = fecha || null;
    c.nota_personal = nota;
  });
}

// ——— Interfaz ———

const enlaceToken =
  'https://github.com/settings/personal-access-tokens/new?name=%C3%81lbum%20Grand%20Tour&description=Subir%20fotos%20desde%20la%20web%20del%20%C3%A1lbum';

/** Pide conectar con GitHub; resuelve true si queda conectado. */
export function dialogoConectar() {
  return new Promise((resolver) => {
    let resultado = false;
    const inToken = el('input#gh-token', {
      type: 'password',
      autocomplete: 'off',
      spellcheck: 'false',
      placeholder: 'github_pat_…',
    });
    const estadoTxt = el('p.conectar__estado', { role: 'status' });
    const btn = el('button.boton.boton--rojo', { type: 'button' }, 'Conectar');
    const caja = el(
      'div.dialogo__caja',
      { role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'gh-titulo' },
      el('h2#gh-titulo', {}, 'Conectar con GitHub'),
      el(
        'p',
        {},
        'Para guardar tus fotos desde la web (en el móvil o en el ordenador), el álbum las sube al repositorio de GitHub. Hace falta un ',
        el('strong', {}, 'token'),
        ' una vez en cada dispositivo:',
      ),
      el(
        'ol.conectar__pasos',
        {},
        el('li', {}, 'Abre ', el('a', { href: enlaceToken, target: '_blank', rel: 'noopener' }, 'crear token en GitHub ↗'), '.'),
        el(
          'li',
          {},
          'En «Repository access» elige ',
          el('strong', {}, 'Only select repositories'),
          ` → ${REPO_POR_DEFECTO.repo}.`,
        ),
        el('li', {}, 'En «Permissions → Repository permissions» pon ', el('strong', {}, 'Contents: Read and write'), '.'),
        el('li', {}, 'Pulsa «Generate token», cópialo y pégalo aquí.'),
      ),
      el('div.campo', {}, el('label', { for: 'gh-token' }, 'Token'), inToken),
      el(
        'p.no-oficial',
        {},
        'El token se guarda solo en este navegador. Puedes desconectarlo aquí o revocarlo en GitHub cuando quieras. Las fotos que subas serán públicas.',
      ),
      estadoTxt,
      el('div.dialogo__acciones', {}, el('button.boton', { type: 'button', onclick: () => cerrar() }, 'Cancelar'), btn),
    );
    btn.addEventListener('click', async () => {
      const cx = { ...REPO_POR_DEFECTO, token: inToken.value.trim() };
      if (!cx.token) {
        estadoTxt.textContent = 'Pega el token primero.';
        inToken.focus();
        return;
      }
      btn.disabled = true;
      estadoTxt.textContent = 'Comprobando…';
      try {
        const { usuario } = await probarConexion(cx);
        guardarConexion(cx);
        resultado = true;
        anunciar(`Conectado con GitHub${usuario ? ` como ${usuario}` : ''}.`);
        window.dispatchEvent(new CustomEvent('album:conexion'));
        cerrar();
      } catch (e) {
        estadoTxt.textContent = e.message;
        btn.disabled = false;
      }
    });
    inToken.addEventListener('keydown', (e) => e.key === 'Enter' && btn.click());
    const cerrar = montarDialogo(caja, { alCerrar: () => resolver(resultado) });
  });
}

export function dialogoDesconectar() {
  const caja = el(
    'div.dialogo__caja',
    { role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'gh-off' },
    el('h2#gh-off', {}, 'Conectado con GitHub'),
    el(
      'p',
      {},
      'Este navegador puede guardar fotos en el repositorio. Si lo desconectas, se borra el token de este dispositivo (en GitHub sigue existiendo hasta que lo revoques).',
    ),
    el(
      'div.dialogo__acciones',
      {},
      el('button.boton', { type: 'button', autofocus: true, onclick: () => cerrar() }, 'Seguir conectado'),
      el(
        'button.boton.boton--rojo',
        {
          type: 'button',
          onclick: () => {
            olvidarConexion();
            anunciar('Desconectado de GitHub.');
            window.dispatchEvent(new CustomEvent('album:conexion'));
            cerrar();
          },
        },
        'Desconectar',
      ),
    ),
  );
  const cerrar = montarDialogo(caja);
}

async function asegurarConexion() {
  return conexion() ? true : dialogoConectar();
}

function elegirArchivos({ multiple }) {
  return new Promise((resolver) => {
    const input = el('input', { type: 'file', accept: 'image/*', class: 'sr', ...(multiple ? { multiple: true } : {}) });
    document.body.append(input);
    input.addEventListener('change', () => {
      resolver([...(input.files || [])].filter((f) => f.type.startsWith('image/')));
      input.remove();
    });
    input.addEventListener('cancel', () => {
      resolver([]);
      input.remove();
    });
    input.click();
  });
}

/** Ventana de «Guardando…» que bloquea mientras se sube a GitHub. */
async function conProgreso(texto, tarea) {
  const caja = el(
    'div.dialogo__caja.progreso-gh',
    { role: 'alertdialog', 'aria-modal': 'true', 'aria-labelledby': 'prog-t' },
    el('h2#prog-t', {}, texto),
    el('p.progreso-gh__barra', { 'aria-hidden': 'true' }),
    el('p', {}, 'Guardando en GitHub…'),
  );
  const cerrar = montarDialogo(caja);
  try {
    await tarea();
    cerrar();
    avisoGuardado();
    return true;
  } catch (e) {
    cerrar();
    mostrarError(e);
    return false;
  }
}

function avisoGuardado() {
  document.querySelectorAll('.tostada').forEach((t) => t.remove());
  const aviso = el(
    'div.tostada',
    { role: 'status' },
    'Guardado en GitHub. Aparecerá en todos tus dispositivos cuando se publique (1–2 min).',
  );
  document.body.append(aviso);
  setTimeout(() => aviso.remove(), 6000);
}

function mostrarError(e) {
  const caja = el(
    'div.dialogo__caja',
    { role: 'alertdialog', 'aria-modal': 'true', 'aria-labelledby': 'err-t' },
    el('h2#err-t', {}, 'No se pudo guardar'),
    el('p', {}, e.message || String(e)),
    el(
      'div.dialogo__acciones',
      {},
      el('button.boton.boton--rojo', { type: 'button', autofocus: true, onclick: () => cerrar() }, 'Vale'),
    ),
  );
  const cerrar = montarDialogo(caja);
}

/** Añadir una o varias fotos a un cromo (con fecha, nota y portada). */
export async function flujoAnadir(cromo, archivosIniciales) {
  if (!(await asegurarConexion())) return;
  const archivos = archivosIniciales?.length ? archivosIniciales : await elegirArchivos({ multiple: true });
  if (!archivos.length) return;
  const blobs = await Promise.all(archivos.map((f) => reducir(f)));
  const exif = await fechaExif(archivos[0]);
  const yaTiene = fotosDe(cromo).length > 0 && !cromo.foto_de_prueba;
  const vistas = blobs.map((b) => URL.createObjectURL(b));
  const inFecha = el('input#anadir-fecha', { type: 'date', value: (!cromo.foto_de_prueba && cromo.fecha_visita) || exif || '' });
  const inNota = el('textarea#anadir-nota', { maxlength: '400' }, cromo.foto_de_prueba ? '' : cromo.nota_personal || '');
  const chkPortada = el('input#anadir-portada', { type: 'checkbox', ...(yaTiene ? {} : { checked: true, disabled: true }) });
  const caja = el(
    'div.dialogo__caja',
    { role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'anadir-t' },
    el('h2#anadir-t', {}, `${blobs.length > 1 ? `${blobs.length} fotos` : 'Nueva foto'} · ${cromo.numero} ${cromo.nombre}`),
    cromo.foto_de_prueba
      ? el('p.album__ayuda-previa', {}, 'La foto de prueba de este cromo se borrará y quedarán solo las tuyas.')
      : null,
    el(
      'ul.anadir__minis',
      {},
      vistas.map((src, i) => el('li', {}, el('img', { src, alt: `Foto ${i + 1} de ${vistas.length}` }))),
    ),
    el('div.campo', {}, el('label', { for: 'anadir-fecha' }, t('fecha_visita')), inFecha),
    el('div.campo', {}, el('label', { for: 'anadir-nota' }, 'Nota personal (detrás del cromo)'), inNota),
    el(
      'div.campo.campo--check',
      {},
      chkPortada,
      el('label', { for: 'anadir-portada' }, blobs.length > 1 ? 'Usar la primera como portada' : 'Usar como portada'),
    ),
    el('p.no-oficial', {}, 'Se reducen a 1600 px y se les quitan la ubicación GPS y el resto de metadatos antes de subirlas.'),
    el(
      'div.dialogo__acciones',
      {},
      el('button.boton', { type: 'button', onclick: () => cerrar() }, 'Cancelar'),
      el(
        'button.boton.boton--rojo',
        {
          type: 'button',
          autofocus: true,
          onclick: async () => {
            const opciones = { fecha: inFecha.value, nota: inNota.value.trim(), portada: chkPortada.checked };
            cerrar();
            await conProgreso(blobs.length > 1 ? `Pegando ${blobs.length} fotos` : 'Pegando la foto', () =>
              anadirFotos(cromo, blobs, opciones),
            );
          },
        },
        'Guardar',
      ),
    ),
  );
  const cerrar = montarDialogo(caja, { alCerrar: () => vistas.forEach((v) => URL.revokeObjectURL(v)) });
}

export async function flujoCambiar(cromo, ruta) {
  if (!(await asegurarConexion())) return;
  const [archivo] = await elegirArchivos({ multiple: false });
  if (!archivo) return;
  const blob = await reducir(archivo);
  await conProgreso('Cambiando la foto', () => cambiarFoto(cromo, ruta, blob));
}

export async function flujoPortada(cromo, ruta) {
  if (!(await asegurarConexion())) return;
  await conProgreso('Cambiando la portada', () => hacerPortada(cromo, ruta));
}

export async function flujoBorrar(cromo, ruta) {
  if (!(await asegurarConexion())) return;
  const unica = fotosDe(cromo).length === 1;
  const caja = el(
    'div.dialogo__caja',
    { role: 'alertdialog', 'aria-modal': 'true', 'aria-labelledby': 'borrar-t' },
    el('h2#borrar-t', {}, '¿Borrar esta foto?'),
    imgFoto(ruta, { class: 'previa__img', alt: 'Foto que se va a borrar' }),
    el(
      'p',
      {},
      unica ? 'Es la única foto: el cromo volverá a quedar como hueco vacío.' : 'Se borrará del álbum y del repositorio.',
    ),
    el(
      'div.dialogo__acciones',
      {},
      el('button.boton', { type: 'button', autofocus: true, onclick: () => cerrar() }, 'Cancelar'),
      el(
        'button.boton.boton--rojo',
        {
          type: 'button',
          onclick: async () => {
            cerrar();
            await conProgreso('Borrando la foto', () => borrarFoto(cromo, ruta));
          },
        },
        'Borrar',
      ),
    ),
  );
  const cerrar = montarDialogo(caja);
}

export async function flujoTextos(cromo) {
  if (!(await asegurarConexion())) return;
  const inFecha = el('input#txt-fecha', { type: 'date', value: cromo.fecha_visita || '' });
  const inNota = el('textarea#txt-nota', { maxlength: '400' }, cromo.nota_personal || '');
  const caja = el(
    'div.dialogo__caja',
    { role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'txt-t' },
    el('h2#txt-t', {}, `Fecha y nota · ${cromo.numero} ${cromo.nombre}`),
    el('div.campo', {}, el('label', { for: 'txt-fecha' }, t('fecha_visita')), inFecha),
    el('div.campo', {}, el('label', { for: 'txt-nota' }, 'Nota personal'), inNota),
    el(
      'div.dialogo__acciones',
      {},
      el('button.boton', { type: 'button', onclick: () => cerrar() }, 'Cancelar'),
      el(
        'button.boton.boton--rojo',
        {
          type: 'button',
          autofocus: true,
          onclick: async () => {
            const v = { fecha: inFecha.value, nota: inNota.value.trim() };
            cerrar();
            await conProgreso('Guardando fecha y nota', () => guardarTextos(cromo, v));
          },
        },
        'Guardar',
      ),
    ),
  );
  const cerrar = montarDialogo(caja);
}
