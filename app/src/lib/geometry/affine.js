/**
 * Affine georeference (PLAN-1): control points {px,py,lat,lon} → transform.
 * Exactly 3 points: exact solve. More: least squares. Collinear sets rejected.
 */

/** Solve 3x3 by Cramer; returns null if singular. @param {number[][]} A @param {number[]} b */
function solve3(A, b) {
  /** @param {number[][]} M */
  const det = (M) =>
    M[0][0] * (M[1][1] * M[2][2] - M[1][2] * M[2][1])
    - M[0][1] * (M[1][0] * M[2][2] - M[1][2] * M[2][0])
    + M[0][2] * (M[1][0] * M[2][1] - M[1][1] * M[2][0]);
  const d = det(A);
  if (Math.abs(d) < 1e-12) return null;
  return [0, 1, 2].map((i) =>
    det(A.map((row, r) => row.map((v, c) => (c === i ? b[r] : v)))) / d);
}

export class GeoreferenceError extends Error {}

/**
 * @param {{ px: number, py: number, lat: number, lon: number }[]} cps (≥3)
 * @returns {{ forward(px: number, py: number): import('../types.js').LatLon,
 *   inverse(lat: number, lon: number): { px: number, py: number },
 *   residuals: number[] }} residuals in degrees lat/lon per control point
 */
export function fitAffine(cps) {
  if (!Array.isArray(cps) || cps.length < 3)
    throw new GeoreferenceError('need at least 3 control points');
  // Normal equations for [a b c] with lat = a*px + b*py + c (same matrix for lon).
  let sxx = 0, sxy = 0, sx = 0, syy = 0, sy = 0, n = cps.length;
  let bl = [0, 0, 0], bo = [0, 0, 0];
  for (const p of cps) {
    sxx += p.px * p.px; sxy += p.px * p.py; sx += p.px;
    syy += p.py * p.py; sy += p.py;
    bl[0] += p.px * p.lat; bl[1] += p.py * p.lat; bl[2] += p.lat;
    bo[0] += p.px * p.lon; bo[1] += p.py * p.lon; bo[2] += p.lon;
  }
  const A = [[sxx, sxy, sx], [sxy, syy, sy], [sx, sy, n]];
  const latC = solve3(A, bl);
  const lonC = solve3(A, bo);
  if (!latC || !lonC) throw new GeoreferenceError('control points are collinear');
  const [a, b, c] = latC, [d, e, f] = lonC;
  const det = a * e - b * d;
  if (Math.abs(det) < 1e-20) throw new GeoreferenceError('transform is degenerate');
  return {
    forward: (px, py) => ({ lat: a * px + b * py + c, lon: d * px + e * py + f }),
    inverse: (lat, lon) => ({
      px: (e * (lat - c) - b * (lon - f)) / det,
      py: (-d * (lat - c) + a * (lon - f)) / det,
    }),
    residuals: cps.map((p) => Math.hypot(
      a * p.px + b * p.py + c - p.lat, d * p.px + e * p.py + f - p.lon)),
  };
}
