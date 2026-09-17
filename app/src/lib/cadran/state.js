/**
 * Cadran display state (CAD-1..4): pure mapping pose+target → HUD state.
 * createCadran() keeps the previous 10 m band in a closure (CAD-3 tick
 * detection) — one per mounted HUD.
 */
import { haversineM, bearingDeg } from '../geometry/geo.js';
import { angDiffDeg } from '../geometry/circular.js';

const HOT_M = 5;
const ARRIVE_M = 4; // default captureRadius; per-repère override applies upstream

export function createCadran() {
  /** @type {number | null} */ let prevBand = null;

  /**
   * @param {import('../types.js').Pose | null} pose
   * @param {import('../types.js').LatLon | null} target
   */
  function cadranState(pose, target) {
    if (!pose || !target) {
      return { bearingDelta: null, bearingDeg: null, distanceM: null, distanceText: '',
        roseDeg: 0, ring: { band: 'none', pulseMs: 0, shape: 'circle' },
        label: null, arrowDimmed: true, haptic: null };
    }
    const d = haversineM(pose, target);
    const b = bearingDeg(pose, target);
    const delta = pose.heading == null ? null : angDiffDeg(pose.heading, b);
    const distanceText = d < 10 ? `${d.toFixed(1)} m` : `${Math.round(d)} m`;

    // CAD-2: band by distance; pulse faster when closer; shape varies by band (A11Y-1)
    const band = d < HOT_M ? 'hot' : d < 25 ? 'warm' : 'cold';
    const pulseMs = Math.max(600, Math.min(2400, d * 80));
    const shape = band === 'hot' ? 'double' : band === 'warm' ? 'dash' : 'circle';

    // CAD-4/POS-4/CAP-3 labels
    const label = pose.source === 'manual' ? 'pos.manual'
      : pose.estimated ? 'pos.estimated' : null;
    const arrowDimmed = pose.accuracy > 15 || pose.heading == null;

    // CAD-3: haptic tick per 10 m approach band crossing, arrival under capture
    const band10 = Math.floor(d / 10);
    /** @type {{ type: 'tick' | 'arrive' } | null} */
    const haptic = d <= ARRIVE_M ? { type: 'arrive' }
      : prevBand != null && band10 < prevBand ? { type: 'tick' } : null;
    prevBand = band10;

    return { bearingDelta: delta, bearingDeg: b, distanceM: d, distanceText,
      roseDeg: -(pose.heading ?? 0), ring: { band, pulseMs, shape },
      label, arrowDimmed, haptic };
  }
  return { cadranState };
}

/** Shared singleton for simple consumers. */
const shared = createCadran();
export const cadranState = shared.cadranState;
