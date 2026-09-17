/**
 * Pose fusion (POS-1, POS-4, POS-9, ARCH-2). Pure state machine, no browser APIs.
 *
 * Rules:
 * - ancre/manual fix: hard reset — position set, accuracy 1 m (ancre) or as given
 *   (manual), DR drift zeroed, `estimated` cleared.
 * - gps fix: accuracy > 30 m only bounds drift (dot does not move); otherwise a
 *   weighted blend by inverse squared accuracy.
 * - heading: circular EMA α=0.2 via the smoother; `headingOk` false when the raw
 *   2 s window shows disturbance > 25° (POS-5) or no event for 3 s (PLAN-2).
 * - POS-9: an active gps source with no fix for 15 s → `estimated` + nearest-ancre
 *   suggestion surfaces via `gpsSilent`.
 */
import { createHeadingSmoother } from '../geometry/circular.js';
import { haversineM } from '../geometry/geo.js';
import { observable } from '../store/observable.js';

const GPS_IGNORE_ACCURACY_M = 30;
const GPS_SILENCE_MS = 15_000;
const HEADING_STALE_MS = 3_000;
const DISTURBANCE_STD_DEG = 25;

/**
 * @param {{ now?: () => number }} [opts]
 */
export function createFusion({ now = () => Date.now() } = {}) {
  const smoother = createHeadingSmoother({ alpha: 0.2 });
  /** @type {{ lat: number, lon: number, accuracy: number } | null} */ let pos = null;
  /** @type {string} */ let posSource = 'none';
  /** @type {number} */ let lastFixT = 0;
  /** @type {number} */ let lastGpsFixT = 0;
  /** @type {boolean} */ let gpsActive = false;
  /** @type {number} */ let lastHeadingT = 0;
  /** @type {number|null} */ let drOffsetE = 0, drOffsetN = 0;

  /** @returns {import('../types.js').Pose | null} */
  function current() {
    if (!pos) return null;
    const t = now();
    return {
      lat: pos.lat, lon: pos.lon,
      heading: smoother.value,
      accuracy: pos.accuracy,
      source: posSource, t,
      estimated: gpsSilent(t),
    };
  }
  const inner = /** @type {ReturnType<typeof observable<import('../types.js').Pose|null>>} */
    (observable(null));
  // `estimated` is time-dependent (POS-9), so value is recomputed on every read.
  const pose = {
    get value() { return current(); },
    /** @param {(v: import('../types.js').Pose|null) => void} fn */
    subscribe: (fn) => inner.subscribe(fn),
  };
  const emit = () => inner.set(current());

  /** @param {number} t */
  const gpsSilent = (t) => gpsActive && lastGpsFixT > 0 && t - lastGpsFixT > GPS_SILENCE_MS
    || gpsActive && lastGpsFixT === 0 && t - startedAt > GPS_SILENCE_MS;
  let startedAt = 0;

  return {
    pose,
    /** @param {import('../types.js').Fix} fix */
    handleFix(fix) {
      lastFixT = fix.t;
      if (fix.kind === 'gps') {
        lastGpsFixT = fix.t;
        if (fix.accuracy > GPS_IGNORE_ACCURACY_M) { emit(); return; } // bound only
        if (!pos || fix.accuracy <= pos.accuracy) {
          pos = { lat: fix.lat, lon: fix.lon, accuracy: fix.accuracy };
        } else {
          const wNew = 1 / fix.accuracy ** 2, wOld = 1 / pos.accuracy ** 2;
          pos = {
            lat: (pos.lat * wOld + fix.lat * wNew) / (wOld + wNew),
            lon: (pos.lon * wOld + fix.lon * wNew) / (wOld + wNew),
            accuracy: Math.min(pos.accuracy, fix.accuracy),
          };
        }
        posSource = 'gps';
      } else { // ancre | manual | dr | sim — hard reset, DR drift zeroed (POS-1)
        pos = { lat: fix.lat, lon: fix.lon, accuracy: fix.kind === 'ancre' ? 1 : fix.accuracy };
        posSource = fix.kind;
        drOffsetE = 0; drOffsetN = 0;
      }
      emit();
    },
    /** @param {number} deg @param {number} [t] */
    handleHeading(deg, t = now()) {
      smoother.push(deg, t);
      lastHeadingT = t;
      emit();
    },
    /** Marks the gps source as (in)active — drives POS-9 silence detection.
     * @param {boolean} active */
    setGpsActive(active) { gpsActive = active; if (active) startedAt = now(); },
    /** True when an active gps source has been silent > 15 s (POS-9). */
    get gpsSilentNow() { return gpsSilent(now()); },
    /** True when the raw heading window shows magnetic disturbance (POS-5). */
    get headingDisturbed() { return smoother.disturbanceStd > DISTURBANCE_STD_DEG; },
    /** True when no heading event for 3 s (PLAN-2 falls back to north-up). */
    get headingStale() { return lastHeadingT > 0 && now() - lastHeadingT > HEADING_STALE_MS; },
    /** Distance/accuracy gate for the cadran arrow (POS-4: dim above 15 m). */
    get lowConfidence() { return !pos || pos.accuracy > 15; },
  };
}

/** Nearest ancre helper for POS-4/POS-9 suggestions.
 * @param {{ lat: number, lon: number }[] | undefined} ancres
 * @param {import('../types.js').LatLon} p */
export function nearestAncre(ancres, p) {
  let best = null, bestD = Infinity;
  for (const a of ancres ?? []) {
    const d = haversineM(a, p);
    if (d < bestD) { best = a; bestD = d; }
  }
  return best ? { ancre: best, distanceM: bestD } : null;
}
