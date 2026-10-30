// Guardar fotos y datos directamente en el repositorio de GitHub desde la web.
// Usa un token personal (fine-grained) con permiso «Contents: read and write»
// limitado a este repositorio. El token se guarda solo en este navegador.

const CLAVE = 'github-conexion';
const API = 'https://api.github.com';

export const REPO_POR_DEFECTO = { owner: 'mario2002pd-create', repo: 'Grand-Tour-of-Switzerland-Album', rama: 'main' };

export function conexion() {
  try {
    const c = JSON.parse(localStorage.getItem(CLAVE) || 'null');
    return c?.token ? { ...REPO_POR_DEFECTO, ...c } : null;
  } catch {
    return null;
  }
}

export function guardarConexion(c) {
  localStorage.setItem(CLAVE, JSON.stringify(c));
}

export function olvidarConexion() {
  try {
    localStorage.removeItem(CLAVE);
  } catch {
    /* sin almacenamiento */
  }
}

export const conectado = () => Boolean(conexion());

async function api(cx, ruta, { method = 'GET', body } = {}) {
  const r = await fetch(API + ruta, {
    method,
    cache: 'no-store',
    headers: {
      Authorization: `Bearer ${cx.token}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!r.ok) {
    let detalle = '';
    try {
      detalle = (await r.json()).message || '';
    } catch {
      /* sin cuerpo */
    }
    const e = new Error(mensajeError(r.status, detalle));
    e.status = r.status;
    throw e;
  }
  return r.status === 204 ? null : r.json();
}

function mensajeError(status, detalle) {
  if (status === 401) return 'El token no es válido o ha caducado.';
  if (status === 403) return 'El token no tiene permiso de escritura en el repositorio (Contents: Read and write).';
  if (status === 404) return 'No encuentro el repositorio o la rama (¿el token incluye este repositorio?).';
  if (status === 409 || status === 422) return `GitHub rechazó el cambio (${detalle || status}).`;
  return `Error de GitHub ${status}${detalle ? `: ${detalle}` : ''}`;
}

/** Comprueba el token y devuelve el usuario y si puede escribir. */
export async function probarConexion(cx) {
  const repo = await api(cx, `/repos/${cx.owner}/${cx.repo}`);
  if (!repo.permissions?.push)
    throw new Error('El token no tiene permiso de escritura en el repositorio (Contents: Read and write).');
  await api(cx, `/repos/${cx.owner}/${cx.repo}/git/ref/heads/${encodeURIComponent(cx.rama)}`);
  let usuario = '';
  try {
    usuario = (await api(cx, '/user')).login;
  } catch {
    /* los tokens fine-grained pueden no tener acceso a /user */
  }
  return { usuario };
}

const aBase64 = async (blob) => {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
};
const textoABase64 = (txt) => aBase64(new Blob([txt], { type: 'text/plain' }));

/** Lee un JSON del repositorio en su última versión (sin esperar a que se publique la web). */
export async function leerJSON(ruta, cx = conexion()) {
  const r = await api(cx, `/repos/${cx.owner}/${cx.repo}/contents/${ruta}?ref=${encodeURIComponent(cx.rama)}`);
  const bin = atob(r.content.replace(/\n/g, ''));
  const bytes = Uint8Array.from(bin, (ch) => ch.charCodeAt(0));
  return JSON.parse(new TextDecoder().decode(bytes));
}

/**
 * Crea un único commit con varios cambios.
 * cambios: [{ ruta, contenido: Blob | string }] o [{ ruta, borrar: true }]
 */
export async function commit(mensaje, cambios, cx = conexion()) {
  const base = `/repos/${cx.owner}/${cx.repo}`;
  const arbol = [];
  for (const c of cambios) {
    if (c.borrar) {
      arbol.push({ path: c.ruta, mode: '100644', type: 'blob', sha: null });
      continue;
    }
    const content = typeof c.contenido === 'string' ? await textoABase64(c.contenido) : await aBase64(c.contenido);
    const blob = await api(cx, `${base}/git/blobs`, { method: 'POST', body: { content, encoding: 'base64' } });
    arbol.push({ path: c.ruta, mode: '100644', type: 'blob', sha: blob.sha });
  }
  // Si otra edición se coló entre medias, se reintenta sobre el último commit
  for (let intento = 0; intento < 3; intento++) {
    const ref = await api(cx, `${base}/git/ref/heads/${encodeURIComponent(cx.rama)}`);
    const padre = await api(cx, `${base}/git/commits/${ref.object.sha}`);
    const tree = await api(cx, `${base}/git/trees`, { method: 'POST', body: { base_tree: padre.tree.sha, tree: arbol } });
    const nuevo = await api(cx, `${base}/git/commits`, {
      method: 'POST',
      body: { message: mensaje, tree: tree.sha, parents: [ref.object.sha] },
    });
    try {
      await api(cx, `${base}/git/refs/heads/${encodeURIComponent(cx.rama)}`, { method: 'PATCH', body: { sha: nuevo.sha } });
      return nuevo.sha;
    } catch (e) {
      if (e.status !== 422 || intento === 2) throw e;
    }
  }
}

/** URL directa al archivo en GitHub, útil mientras la web publicada aún no lo tiene. */
export function urlCruda(ruta, cx = conexion() || REPO_POR_DEFECTO) {
  return `https://raw.githubusercontent.com/${cx.owner}/${cx.repo}/${cx.rama}/${ruta}`;
}
