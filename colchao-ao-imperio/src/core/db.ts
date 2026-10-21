/**
 * Persistência local: IndexedDB como armazenamento principal e localStorage como espelho
 * síncrono (garante que o último estado sobreviva a um fechamento abrupto da aba).
 * Nenhum dado sai do navegador.
 */
const DB_NAME = 'colchao-ao-imperio';
const STORE = 'kv';
const LS_KEY = 'colchao-ao-imperio:save';

function openDB(): Promise<IDBDatabase | null> {
  return new Promise((resolve) => {
    try {
      if (typeof indexedDB === 'undefined') return resolve(null);
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => req.result.createObjectStore(STORE);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

let dbPromise: Promise<IDBDatabase | null> | null = null;
function db() {
  return (dbPromise ??= openDB());
}

export async function idbGet<T>(key: string): Promise<T | undefined> {
  const d = await db();
  if (!d) return undefined;
  return new Promise((resolve) => {
    try {
      const tx = d.transaction(STORE, 'readonly');
      const req = tx.objectStore(STORE).get(key);
      req.onsuccess = () => resolve(req.result as T | undefined);
      req.onerror = () => resolve(undefined);
    } catch {
      resolve(undefined);
    }
  });
}

export async function idbSet(key: string, value: unknown): Promise<boolean> {
  const d = await db();
  if (!d) return false;
  return new Promise((resolve) => {
    try {
      const tx = d.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).put(value, key);
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => resolve(false);
    } catch {
      resolve(false);
    }
  });
}

export async function idbDelete(key: string): Promise<void> {
  const d = await db();
  if (!d) return;
  await new Promise<void>((resolve) => {
    const tx = d.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).delete(key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => resolve();
  });
}

export interface Stamped { savedAt: number }

export async function loadSave<T extends Stamped>(): Promise<T | null> {
  const fromIdb = await idbGet<T>('save');
  let fromLs: T | null = null;
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) fromLs = JSON.parse(raw);
  } catch { /* ignore */ }
  if (fromIdb && fromLs) return fromLs.savedAt > fromIdb.savedAt ? fromLs : fromIdb;
  return fromIdb ?? fromLs ?? null;
}

export function saveMirrorSync(value: Stamped) {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(value));
  } catch { /* cota cheia: IndexedDB continua como principal */ }
}

export async function saveData(value: Stamped) {
  saveMirrorSync(value);
  await idbSet('save', value);
}

export async function wipeAll() {
  try { localStorage.removeItem(LS_KEY); } catch { /* ignore */ }
  await idbDelete('save');
}
