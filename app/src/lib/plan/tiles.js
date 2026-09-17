/**
 * Web-Mercator (EPSG:3857) slippy-tile math (PLAN-6). Pure functions.
 * Tile numbers are fractional (use Math.floor for indices, fraction for
 * sub-tile positioning).
 */

const MAX_LAT = 85.05112878;

/** @param {number} lon @param {number} z @returns {number} fractional tile x */
export function lonToTileX(lon, z) {
  return ((lon + 180) / 360) * 2 ** z;
}

/** @param {number} lat @param {number} z @returns {number} fractional tile y */
export function latToTileY(lat, z) {
  const c = Math.max(-MAX_LAT, Math.min(MAX_LAT, lat));
  const r = c * Math.PI / 180;
  return ((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * 2 ** z;
}

/** NW corner of a tile in degrees. @param {number} x @param {number} y @param {number} z */
export function tileToLonLat(x, y, z) {
  const lon = (x / 2 ** z) * 360 - 180;
  const n = Math.PI - (2 * Math.PI * y) / 2 ** z;
  return { lat: Math.atan(Math.sinh(n)) * 180 / Math.PI, lon };
}

/** @param {number} x @param {number} y @param {number} z
 * @returns {{ north: number, south: number, west: number, east: number }} */
export function tileBounds(x, y, z) {
  const nw = tileToLonLat(x, y, z);
  const se = tileToLonLat(x + 1, y + 1, z);
  return { north: nw.lat, south: se.lat, west: nw.lon, east: se.lon };
}

/**
 * Pick the zoom where `spanM` metres (at `lat`) covers ≈2 tiles.
 * Tile width in metres ≈ 40075017·cos(lat) / 2^z.
 * @param {number} spanM @param {number} lat
 */
export function zoomForSpan(spanM, lat) {
  const earth = 40075017 * Math.cos(lat * Math.PI / 180);
  return Math.max(0, Math.min(19, Math.round(Math.log2(earth / spanM)) + 1));
}
