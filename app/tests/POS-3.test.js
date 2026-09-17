import { describe, it, expect } from 'vitest';
import { createStepDetector } from '../src/lib/sensors/steps.js';

// POS-3: step detection from DeviceMotion accel magnitude — band-pass 1–3 Hz,
// adaptive peak threshold. Pure DSP; the DeviceMotion shell feeds samples.
/** Synthesize walking: magnitude ≈ 1g + gait sine at `hz`, sampled at `rate`. */
function* walk({ hz = 2, rate = 50, seconds = 10, g = 9.81, amp = 3 }) {
  const n = seconds * rate;
  for (let i = 0; i < n; i++) {
    const t = i / rate * 1000;
    yield { t, mag: g + amp * Math.sin(2 * Math.PI * hz * (i / rate)) };
  }
}

describe('POS-3 step detection', () => {
  it('counts steps for a clean 2 Hz gait (±10%)', () => {
    const d = createStepDetector();
    for (const s of walk({ hz: 2, seconds: 10 })) d.push(s.t, s.mag);
    expect(d.count).toBeGreaterThanOrEqual(18); // 20 nominal
    expect(d.count).toBeLessThanOrEqual(22);
  });
  it('rejects a too-slow signal (0.5 Hz is below the band)', () => {
    const d = createStepDetector();
    for (const s of walk({ hz: 0.5, seconds: 10 })) d.push(s.t, s.mag);
    // band-pass + interval gate: no sustained false stepping; the rare
    // transient peak may slip through once or twice, never a gait
    expect(d.count).toBeLessThanOrEqual(4);
  });
  it('rejects a too-fast signal (5 Hz is above the band)', () => {
    const d = createStepDetector();
    for (const s of walk({ hz: 5, seconds: 10 })) d.push(s.t, s.mag);
    // under half the nominal peaks, and no convergence to a gait cadence
    expect(d.count).toBeLessThan(25);
  });
  it('ignores a resting phone (flat ~1g with noise)', () => {
    const d = createStepDetector();
    let t = 0;
    for (let i = 0; i < 500; i++) d.push((t += 20), 9.81 + (i % 7) * 0.01);
    expect(d.count).toBeLessThanOrEqual(1); // a lone filter-transient peak is tolerable
  });
  it('adapts threshold after onset: still counts when amplitude halves mid-walk', () => {
    const d = createStepDetector();
    for (const s of walk({ hz: 2, seconds: 5, amp: 3 })) d.push(s.t, s.mag);
    const at5s = d.count;
    for (const s of walk({ hz: 2, seconds: 5, amp: 1.2 })) d.push(s.t + 5000, s.mag);
    expect(d.count - at5s).toBeGreaterThanOrEqual(7); // ~10 more steps
  });
  it('emits a step event per detected step (for DR)', () => {
    const d = createStepDetector();
    const events = [];
    d.onStep((t) => events.push(t));
    for (const s of walk({ hz: 2, seconds: 5 })) d.push(s.t, s.mag);
    expect(events.length).toBe(d.count);
    // monotonic, spaced like a gait (300–700 ms)
    for (let i = 1; i < events.length; i++) {
      expect(events[i] - events[i - 1]).toBeGreaterThan(250);
      expect(events[i] - events[i - 1]).toBeLessThan(800);
    }
  });
});
