/** Geodesy at venue scale (POS-6): WGS84 at the edges, local ENU inside. */

const R = 6371008.8; // IUGG mean Earth radius, m
const D2R = Math.PI / 180;
const R2D = 180 / Math.PI;

/** @param {import('../types.js').LatLon} a @param {import('../types.js').LatLon} b @returns {number} metres */
export function haversineM(a, b) {
  const dLat = (b.lat - a.lat) * D2R, dLon = (b.lon - a.lon) * D2R;
  const s = Math.sin(dLat / 2) ** 2
    + Math.cos(a.lat * D2R) * Math.cos(b.lat * D2R) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(s)));
}

/** Initial bearing a→b, degrees clockwise from north, [0, 360).
 * @param {import('../types.js').LatLon} a @param {import('../types.js').LatLon} b */
export function bearingDeg(a, b) {
  const dLon = (b.lon - a.lon) * D2R;
  const y = Math.sin(dLon) * Math.cos(b.lat * D2R);
  const x = Math.cos(a.lat * D2R) * Math.sin(b.lat * D2R)
    - Math.sin(a.lat * D2R) * Math.cos(b.lat * D2R) * Math.cos(dLon);
  return (Math.atan2(y, x) * R2D + 360) % 360;
}

/**
 * Local tangent-plane frame centred on `origin` (equirectangular — fine under ~1 km).
 * @param {import('../types.js').LatLon} origin
 */
export function enuFrame(origin) {
  const kLat = R * D2R;
  const kLon = R * D2R * Math.cos(origin.lat * D2R);
  return {
    /** @param {import('../types.js').LatLon} p @returns {{ e: number, n: number }} metres */
    toENU(p) { return { e: (p.lon - origin.lon) * kLon, n: (p.lat - origin.lat) * kLat }; },
    /** @param {{ e: number, n: number }} v @returns {import('../types.js').LatLon} */
    fromENU(v) { return { lat: origin.lat + v.n / kLat, lon: origin.lon + v.e / kLon }; },
  };
}

/** Bearing in an ENU frame: degrees clockwise from +n.
 * @param {{ e: number, n: number }} from @param {{ e: number, n: number }} to */
export function bearingENU(from, to) {
  return (Math.atan2(to.e - from.e, to.n - from.n) * R2D + 360) % 360;
}
