/**
 * CarnetState persistence (DATA-1): single `put` writes; the previous record is
 * kept one deep as `state:<venue>:prev`; corrupt main state falls back to `prev`,
 * then to a fresh state. `version` drives migrations.
 */
import { memoryStore } from './idb.js';

export const CARNET_VERSION = 1;

/** @param {string} venueId @returns {import('../types.js').CarnetState} */
export function freshCarnet(venueId) {
  return {
    version: CARNET_VERSION,
    venueId,
    encountered: {},
    audioUnlocked: false,
    parcours: {},
    permissions: { geo: 'unknown', orientation: 'unknown', camera: 'unknown' },
  };
}

/** @param {any} s @returns {boolean} */
function isCarnet(s) {
  return !!s && typeof s === 'object' && typeof s.venueId === 'string'
    && typeof s.encountered === 'object' && s.encountered !== null;
}

/** Migrate older shapes forward. @param {any} s @returns {any} */
export function migrateCarnet(s) {
  if (!isCarnet(s)) return s;
  if (s.version == null) s.version = 1; // v0 → v1: stamp version
  return s;
}

/**
 * @param {import('./idb.js').KvStore} store
 * @param {string} venueId
 * @returns {Promise<import('../types.js').CarnetState>}
 */
export async function loadCarnet(store, venueId) {
  const main = migrateCarnet(await store.get(`state:${venueId}`));
  if (isCarnet(main)) return main;
  const prev = migrateCarnet(await store.get(`state:${venueId}:prev`));
  if (isCarnet(prev)) return prev;
  return freshCarnet(venueId);
}

/**
 * @param {import('./idb.js').KvStore} store
 * @param {import('../types.js').CarnetState} state
 */
export async function saveCarnet(store, state) {
  const cur = await store.get(`state:${state.venueId}`);
  if (isCarnet(cur)) await store.set(`state:${state.venueId}:prev`, cur);
  await store.set(`state:${state.venueId}`, state);
}

/** Debug/sim poses are never persisted (DEMO-3). @param {import('../types.js').Pose} pose */
export function shouldPersistPose(pose) {
  return pose.source !== 'sim';
}
