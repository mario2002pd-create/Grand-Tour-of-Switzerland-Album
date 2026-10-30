// «Modo vista previa»: probar una foto en un hueco sin tocar el repositorio.
// La foto se reduce y se vuelve a codificar en el navegador (sin EXIF ni GPS)
// y se guarda solo en IndexedDB.
import exifr from 'exifr/dist/lite.esm.mjs';
import { estado, t, guardarPrevia, borrarPrevia, jsonExportado } from './data.js';
import { el, descargar, anunciar } from './util.js';

const LADO_MAX = 1600;

async function fechaExif(archivo) {
  try {
    const d = await exifr.parse(archivo, ['DateTimeOriginal', 'CreateDate']);
    const f = d?.DateTimeOriginal || d?.CreateDate;
    if (f instanceof Date && !Number.isNaN(f.getTime())) {
      return `${f.getFullYear()}-${String(f.getMonth() + 1).padStart(2, '0')}-${String(f.getDate()).padStart(2, '0')}`;
    }
  } catch {
    /* sin EXIF */
  }
  return '';
}

/** Redimensiona y re-codifica a JPEG (elimina cualquier metadato). */
export async function reducir(archivo, lado = LADO_MAX, calidad = 0.85) {
  const bmp = await createImageBitmap(archivo, { imageOrientation: 'from-image' });
  const k = Math.min(1, lado / Math.max(bmp.width, bmp.height));
  const lienzo = document.createElement('canvas');
  lienzo.width = Math.round(bmp.width * k);
  lienzo.height = Math.round(bmp.height * k);
  lienzo.getContext('2d').drawImage(bmp, 0, 0, lienzo.width, lienzo.height);
  bmp.close?.();
  return new Promise((ok) => lienzo.toBlob(ok, 'image/jpeg', calidad));
}

function cerrarDialogo(raiz, previoFoco) {
  raiz.replaceChildren();
  document.removeEventListener('keydown', raiz._tecla);
  previoFoco?.focus?.();
}

/** Trampa de foco sencilla + Escape. */
export function montarDialogo(caja, { alCerrar } = {}) {
  const raiz = document.getElementById('dialogo-raiz');
  const previoFoco = document.activeElement;
  const fondo = el('div.dialogo', { role: 'presentation' }, caja);
  raiz.replaceChildren(fondo);
  const cerrar = () => {
    cerrarDialogo(raiz, previoFoco);
    alCerrar?.();
  };
  raiz._tecla = (e) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      cerrar();
    } else if (e.key === 'Tab') {
      const f = [...caja.querySelectorAll('button, [href], input, textarea, select, [tabindex]:not([tabindex="-1"])')].filter(
        (n) => !n.disabled && n.offsetParent !== null,
      );
      if (!f.length) return;
      const [primero, ultimo] = [f[0], f[f.length - 1]];
      if (e.shiftKey && document.activeElement === primero) {
        e.preventDefault();
        ultimo.focus();
      } else if (!e.shiftKey && document.activeElement === ultimo) {
        e.preventDefault();
        primero.focus();
      }
    }
  };
  document.addEventListener('keydown', raiz._tecla);
  fondo.addEventListener('click', (e) => e.target === fondo && cerrar());
  requestAnimationFrame(() => (caja.querySelector('[autofocus]') || caja.querySelector('button, input'))?.focus());
  return cerrar;
}

const avisarCambio = () => window.dispatchEvent(new CustomEvent('album:cambio'));

/** Abre el selector de archivos y después el diálogo de vista previa. */
export function elegirFoto(cromo) {
  const input = el('input', { type: 'file', accept: 'image/*', class: 'sr' });
  document.body.append(input);
  input.addEventListener('change', () => {
    const f = input.files?.[0];
    input.remove();
    if (f) dialogoPrevia(cromo, f);
  });
  input.click();
}

export async function dialogoPrevia(cromo, archivo) {
  if (!archivo?.type?.startsWith('image/')) {
    anunciar('Ese archivo no es una imagen.');
    return;
  }
  const [fecha, blob] = await Promise.all([fechaExif(archivo), reducir(archivo)]);
  const vista = URL.createObjectURL(blob);
  const existente = estado.previas.get(cromo.id);
  const idF = `previa-fecha-${cromo.id}`;
  const idN = `previa-nota-${cromo.id}`;
  const inFecha = el('input', { id: idF, type: 'date', value: fecha || existente?.fecha || '' });
  const inNota = el('textarea', { id: idN, maxlength: '400' }, existente?.nota || '');
  const caja = el(
    'div.dialogo__caja',
    { role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'previa-titulo' },
    el('h2#previa-titulo', {}, `${t('vista_previa')} · ${cromo.numero} ${cromo.nombre}`),
    el('p.no-oficial', {}, t('vista_previa_ayuda')),
    el('img.previa__img', { src: vista, alt: `Tu foto para ${cromo.nombre}` }),
    el('div.campo', {}, el('label', { for: idF }, t('fecha_visita')), inFecha),
    el('div.campo', {}, el('label', { for: idN }, 'Nota personal'), inNota),
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
            await guardarPrevia(cromo.id, { blob, fecha: inFecha.value, nota: inNota.value.trim() });
            cerrar();
            anunciar(`Vista previa guardada para ${cromo.nombre}.`);
            avisarCambio();
          },
        },
        'Pegar en vista previa',
      ),
    ),
  );
  const cerrar = montarDialogo(caja, { alCerrar: () => URL.revokeObjectURL(vista) });
}

export async function quitarPrevia(cromo) {
  await borrarPrevia(cromo.id);
  anunciar(`Vista previa eliminada de ${cromo.nombre}.`);
  avisarCambio();
}

export async function exportarJSON() {
  const txt = await jsonExportado();
  descargar(new Blob([txt], { type: 'application/json' }), 'cromos.json');
  anunciar('cromos.json exportado.');
}

/** Descarga la foto ya reducida y sin metadatos, con el nombre que espera el repositorio. */
export function descargarFotoPrevia(cromo) {
  const p = estado.previas.get(cromo.id);
  if (p) descargar(p.blob, `${cromo.id}.jpg`);
}

/** Diálogo con las instrucciones de exportación. */
export function dialogoExportar() {
  const ids = [...estado.previas.keys()];
  const caja = el(
    'div.dialogo__caja',
    { role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'exp-titulo' },
    el('h2#exp-titulo', {}, t('exportar')),
    el('p', {}, t('exportar_ayuda')),
    ids.length
      ? el(
          'ul.exportar__lista',
          {},
          ids.map((id) => {
            const c = estado.porId.get(id);
            return el(
              'li',
              {},
              `${c.numero} · ${c.nombre} → `,
              el('button.boton.boton--mini', { type: 'button', onclick: () => descargarFotoPrevia(c) }, `fotos/${id}.jpg`),
            );
          }),
        )
      : el('p', {}, 'Todavía no hay vistas previas.'),
    el(
      'p.no-oficial',
      {},
      'Sube cada foto a la carpeta ',
      el('code', {}, 'fotos/'),
      ' del repositorio y sustituye ',
      el('code', {}, 'data/cromos.json'),
      ' por el archivo exportado. Más detalles en el ',
      el('a', { href: 'https://github.com/mario2002pd-create/Grand-Tour-of-Switzerland-Album#readme', target: '_blank', rel: 'noopener' }, 'README'),
      '.',
    ),
    el(
      'div.dialogo__acciones',
      {},
      el('button.boton', { type: 'button', onclick: () => cerrar() }, 'Cerrar'),
      el('button.boton.boton--rojo', { type: 'button', autofocus: true, onclick: exportarJSON }, 'Descargar cromos.json'),
    ),
  );
  const cerrar = montarDialogo(caja);
}
