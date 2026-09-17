/**
 * Step detection (POS-3): accel-magnitude gait counter.
 * Second-order Butterworth band-pass 1–3 Hz over the magnitude (high-pass
 * removes gravity, low-pass removes jitter), then peak-picking with an
 * adaptive threshold (half the recent mean peak amplitude), a 300 ms
 * refractory, and an inter-step interval gate of 333–1000 ms (the 1–3 Hz
 * band enforced on decisions, not just filtering).
 * Pure DSP; DeviceMotion wires samples in.
 */

/** RBJ biquad, Direct Form I.
 * @param {number} b0 @param {number} b1 @param {number} b2
 * @param {number} a1 @param {number} a2 */
function biquad(b0, b1, b2, a1, a2) {
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
  return (/** @type {number} */ x) => {
    const y = b0 * x + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2;
    x2 = x1; x1 = x; y2 = y1; y1 = y;
    return y;
  };
}
/** @param {'lowpass'|'highpass'} kind @param {number} fc Hz @param {number} fs Hz */
function rbj(kind, fc, fs) {
  const w0 = 2 * Math.PI * fc / fs;
  const alpha = Math.sin(w0) / (2 * Math.SQRT1_2); // Q = 1/√2
  const cw = Math.cos(w0);
  const n = 1 + alpha;
  return kind === 'lowpass'
    ? biquad((1 - cw) / 2 / n, (1 - cw) / n, (1 - cw) / 2 / n, -2 * cw / n, (1 - alpha) / n)
    : biquad((1 + cw) / 2 / n, -(1 + cw) / n, (1 + cw) / 2 / n, -2 * cw / n, (1 - alpha) / n);
}

export function createStepDetector({
  refractoryMs = 300,
  minIntervalMs = 333,   // ≤3 Hz
  maxIntervalMs = 1000,  // ≥1 Hz
  minPeakAmp = 0.8,      // m/s² filtered — under this it never walks (rest/jitter)
  sampleHz = 50,
} = {}) {
  const hp = rbj('highpass', 1, sampleHz);
  const lp = rbj('lowpass', 3, sampleHz);
  let prev = 0, rising = false, peakVal = 0;
  /** @type {number | null} */ let lastStepT = null;
  let count = 0;
  /** @type {number[]} */ let peakAmps = [];
  /** @type {number[]} */ let intervals = [];
  /** @type {Set<(t: number) => void>} */ const listeners = new Set();

  /** @param {number} t ms @param {number} mag accel magnitude m/s² */
  function push(t, mag) {
    const y = lp(hp(mag));
    const threshold = thresholdNow();
    if (y > prev) { rising = true; peakVal = y; }
    else if (rising && y < prev) {
      // Local maximum just passed — evaluate it exactly once.
      rising = false;
      if (peakVal > threshold) {
        const gap = lastStepT === null ? null : t - lastStepT;
        if (gap === null || gap >= refractoryMs) {
          // Interval gate: hard band 333–1000 ms (1–3 Hz), plus cadence
          // consistency — an established gait only accepts intervals within
          // ±50% of its running median (kills aliased out-of-band rhythms).
          let inBand = gap === null || (gap >= minIntervalMs && gap <= maxIntervalMs);
          if (inBand && gap !== null && intervals.length >= 3) {
            const med = [...intervals].sort((a, b) => a - b)[Math.floor(intervals.length / 2)];
            if (gap < med * 0.5 || gap > med * 1.5) inBand = false;
          }
          if (inBand) {
            count++;
            // Only gait-confirmed peaks (a second in-band arrival) seed the
            // adaptive threshold — the very first peak is transient-suspect
            // (filter warmup) and must not raise it.
            if (gap !== null) {
              peakAmps.push(peakVal);
              if (peakAmps.length > 8) peakAmps.shift();
              intervals.push(gap);
              if (intervals.length > 8) intervals.shift();
            }
            for (const fn of [...listeners]) fn(t);
          }
          lastStepT = t; // a real peak still refracts, even off-band
        }
        // gap < refractoryMs: filter transient right after a step — ignore
        // this peak entirely; the real gait peak arrives after the refractory.
      }
    }
    prev = y;
  }

  // 0.35 × median of recent gait-confirmed step peaks (adapts to a softening
  // gait), floored at the noise floor. Needs two confirmed steps before
  // adapting; until then only the floor applies.
  function thresholdNow() {
    if (peakAmps.length < 2) return minPeakAmp;
    const sorted = [...peakAmps].sort((a, b) => a - b);
    const median = sorted[Math.floor(sorted.length / 2)];
    return Math.max(minPeakAmp, 0.35 * median);
  }

  return {
    push,
    get count() { return count; },
    /** @param {(t: number) => void} fn */
    onStep(fn) { listeners.add(fn); return () => listeners.delete(fn); },
    reset() { prev = 0; rising = false; peakVal = 0; lastStepT = null; count = 0; peakAmps = []; intervals = []; },
  };
}
