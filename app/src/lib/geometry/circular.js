/** Circular statistics for headings (POS-2 smoothing, POS-5 disturbance). */

const D2R = Math.PI / 180;
const R2D = 180 / Math.PI;

/** Shortest signed angular difference a→b in degrees, (-180, 180].
 * @param {number} a @param {number} b */
export function angDiffDeg(a, b) {
  return ((b - a + 540) % 360) - 180;
}

/** Circular mean of headings in degrees. @param {number[]} degs */
export function circMeanDeg(degs) {
  let x = 0, y = 0;
  for (const d of degs) { x += Math.cos(d * D2R); y += Math.sin(d * D2R); }
  return (Math.atan2(y, x) * R2D + 360) % 360;
}

/** Circular standard deviation in degrees: sqrt(-2 ln R̄). Empty/degenerate → 0.
 * @param {number[]} degs */
export function circStdDeg(degs) {
  if (degs.length < 2) return 0;
  let x = 0, y = 0;
  for (const d of degs) { x += Math.cos(d * D2R); y += Math.sin(d * D2R); }
  const rbar = Math.min(1, Math.hypot(x, y) / degs.length);
  return Math.sqrt(Math.max(0, -2 * Math.log(Math.max(rbar, 1e-12)))) * R2D;
}

/**
 * Exponential moving average over a circle (POS-2).
 * Cold start takes the first sample; a jump ≥170° snaps instead of lerping
 * through 90° (decided: post-calibration jumps must not oscillate).
 * @param {number|null} prev @param {number} next @param {number} [alpha]
 */
export function emaAngle(prev, next, alpha = 0.2) {
  if (prev == null) return ((next % 360) + 360) % 360;
  const d = angDiffDeg(prev, next);
  if (Math.abs(d) >= 170) return ((next % 360) + 360) % 360;
  return ((prev + alpha * d) % 360 + 360) % 360;
}

/**
 * Heading smoother: EMA over the stream plus a raw 2 s window for POS-5
 * disturbance detection (variance is computed on raw, never smoothed, values).
 */
export function createHeadingSmoother({ alpha = 0.2, windowMs = 2000 } = {}) {
  /** @type {number|null} */ let smoothed = null;
  /** @type {{ deg: number, t: number }[]} */ let raw = [];
  return {
    /** @param {number} deg @param {number} t ms */
    push(deg, t) {
      smoothed = emaAngle(smoothed, deg, alpha);
      raw.push({ deg, t });
      raw = raw.filter((s) => t - s.t <= windowMs);
      return smoothed;
    },
    get value() { return smoothed; },
    /** Raw-stream circular std over the window (POS-5 compares against 25°). */
    get disturbanceStd() { return circStdDeg(raw.map((s) => s.deg)); },
    reset() { smoothed = null; raw = []; },
  };
}
