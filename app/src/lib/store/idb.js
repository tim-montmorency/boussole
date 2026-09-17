/**
 * Minimal IndexedDB promise wrapper + in-memory fake with the same API.
 * Real implementation is used in the browser; the fake backs Node tests.
 * @typedef {{ get(k: string): Promise<any>, set(k: string, v: any): Promise<void>,
 *   del(k: string): Promise<void> }} KvStore
 */

/** @returns {KvStore} */
export function memoryStore() {
  /** @type {Map<string, any>} */ const m = new Map();
  return {
    async get(k) { return m.has(k) ? m.get(k) : undefined; },
    async set(k, v) { m.set(k, structuredClone(v)); },
    async del(k) { m.delete(k); },
  };
}

/**
 * @param {string} dbName
 * @returns {KvStore}
 */
export function idbStore(dbName) {
  const db = /** @type {Promise<IDBDatabase>} */ (new Promise((resolve, reject) => {
    const req = indexedDB.open(dbName, 1);
    req.onupgradeneeded = () => req.result.createObjectStore('kv');
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  }));
  /** @param {'readonly'|'readwrite'} mode @param {(s: IDBObjectStore) => IDBRequest} op */
  async function tx(mode, op) {
    const d = await db;
    return new Promise((resolve, reject) => {
      const t = d.transaction('kv', mode);
      const req = op(t.objectStore('kv'));
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }
  return {
    get: (k) => tx('readonly', (s) => s.get(k)),
    set: (k, v) => tx('readwrite', (s) => s.put(v, k)).then(() => {}),
    del: (k) => tx('readwrite', (s) => s.delete(k)).then(() => {}),
  };
}
