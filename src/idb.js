// Almacén mínimo en IndexedDB para el «modo vista previa».
// Todo se queda en el navegador del usuario: nada se sube a ningún sitio.

const DB = 'album-grand-tour';
const STORE = 'vista-previa';

function abrir() {
  return new Promise((ok, mal) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE, { keyPath: 'id' });
    req.onsuccess = () => ok(req.result);
    req.onerror = () => mal(req.error);
  });
}

async function tx(modo, fn) {
  const db = await abrir();
  return new Promise((ok, mal) => {
    const t = db.transaction(STORE, modo);
    const r = fn(t.objectStore(STORE));
    t.oncomplete = () => ok(r?.result);
    t.onerror = () => mal(t.error);
  });
}

export const leerTodas = async () => {
  try {
    return (await tx('readonly', (s) => s.getAll())) || [];
  } catch {
    return [];
  }
};
export const guardar = (registro) => tx('readwrite', (s) => s.put(registro));
export const borrar = (id) => tx('readwrite', (s) => s.delete(id));
