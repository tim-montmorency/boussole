/**
 * AR projection (AR-2..5): heading-based, no SLAM. Given a pose and a repère,
 * where does its marker land on screen? Pure math — the canvas component
 * renders whatever this returns.
 */
import { haversineM, bearingDeg } from '../geometry/geo.js';
import { angDiffDeg } from '../geometry/circular.js';

/**
 * @param {import('../types.js').Pose} pose
 * @param {import('../types.js').LatLon & { id?: string }} target
 * @param {{ w: number, h: number, hFov: number, pitchDeg: number,
 *   arRange: number, captureRadius: number }} view
 */
export function projectMarker(pose, target, view) {
  const distanceM = haversineM(pose, target);
  if (distanceM > view.arRange) {
    return { id: target.id, visible: false, distanceM, x: 0, y: 0, size: 0, opacity: 0,
      tappable: false, chevron: null };
  }
  const bearing = bearingDeg(pose, target);
  const delta = angDiffDeg(pose.heading ?? 0, bearing); // signed, (-180, 180]
  const halfFov = view.hFov / 2;

  // AR-3: outside the FOV → edge chevron pointing the way
  const chevron = delta > halfFov ? 'right' : delta < -halfFov ? 'left' : null;
  const x = view.w / 2 + (delta / view.hFov) * view.w;
  // AR-2: y rides the horizon line, offset by device pitch (single level: no
  // target elevation)
  const horizon = view.h / 2 + (view.pitchDeg / 90) * view.h;
  const y = horizon - 40;

  // AR-4: size and opacity scale with distance
  const size = Math.max(18, 120 / (1 + distanceM / 8));
  const opacity = Math.max(0.3, 1 - distanceM / view.arRange);

  return {
    id: target.id, visible: true, distanceM,
    x: chevron === 'left' ? 16 : chevron === 'right' ? view.w - 16 : x,
    y, size, opacity, chevron,
    tappable: distanceM <= view.captureRadius, // AR-5
  };
}

/**
 * All repère markers for the current frame: filtered to arRange, sorted
 * far→near for correct paint order.
 * @param {import('../types.js').Pose} pose @param {any[]} reperes
 * @param {Parameters<typeof projectMarker>[2]} view
 */
export function arMarkers(pose, reperes, view) {
  return reperes
    .map((r) => projectMarker(pose, r, view))
    .filter((m) => m.visible)
    .sort((a, b) => b.distanceM - a.distanceM);
}
