/**
 * Capability tiers (§2) and denial memory (CAP-2). Pure logic — browser
 * permission queries happen in the sensors layer and feed this.
 *
 * @typedef {'granted'|'denied'|'prompt'|'unknown'} PermState
 * @typedef {'T0'|'T1'|'T2'|'T3'} Tier
 */

/**
 * @param {{ orientation: PermState, geo: PermState, camera: PermState }} perms
 * @param {boolean} hasPose any live pose (ancre, manual, or GPS fix)
 * @returns {Tier}
 */
export function computeTier(perms, hasPose) {
  if (!hasPose) return 'T0'; // guidance needs a position, whatever was granted
  if (perms.camera === 'granted') return 'T3'; // v0.3: camera + any live pose
  if (perms.geo === 'granted') return 'T2';
  if (perms.orientation === 'granted') return 'T1';
  return 'T0';
}

/** @param {string} p */
const KEY = (p) => `boussole:denied:${p}`;

/**
 * CAP-2: denied permissions are remembered and never re-prompted automatically.
 * @param {Storage} storage @param {string} perm @param {boolean} [denied]
 */
export function rememberDenial(storage, perm, denied = true) {
  if (denied) storage.setItem(KEY(perm), '1');
  else storage.setItem(KEY(perm), '0');
}

/** @param {Storage} storage @param {string} perm */
export function wasDenied(storage, perm) {
  try { return storage.getItem(KEY(perm)) === '1'; } catch { return false; }
}
