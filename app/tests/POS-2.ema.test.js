import { describe, it, expect } from 'vitest';
import { emaAngle, circMeanDeg, circStdDeg, angDiffDeg, createHeadingSmoother }
  from '../src/lib/geometry/circular.js';

// POS-2: heading smoothing with circular EMA, α = 0.2, specified edge cases.
describe('POS-2 circular EMA', () => {
  it('no wrap glitch across 359° → 1°', () => {
    const v = emaAngle(359, 1, 0.2);
    expect(Math.abs(angDiffDeg(0, v))).toBeLessThan(1); // went through 0, not 180
  });
  it('converges toward a steady stream', () => {
    let h = null;
    for (let i = 0; i < 50; i++) h = emaAngle(h, 90, 0.2);
    expect(h).toBeCloseTo(90, 3);
  });
  it('cold start takes the first value', () => {
    expect(emaAngle(null, 123, 0.2)).toBe(123);
  });
  it('a 180° jump snaps instead of lerping through 90°', () => {
    const h = emaAngle(0, 180, 0.2);
    expect(h === 180 || h === 0).toBe(true); // never mid-way nonsense like 90
    expect(h).toBe(180); // decided: snap to new
  });
  it('angDiffDeg picks the short way', () => {
    expect(angDiffDeg(350, 10)).toBeCloseTo(20);
    expect(angDiffDeg(10, 350)).toBeCloseTo(-20);
  });
});

// POS-5: magnetic disturbance = circular std of the RAW stream over 2 s.
describe('POS-5 disturbance detection', () => {
  it('quiet raw stream stays well under 25°', () => {
    const s = createHeadingSmoother();
    let t = 0;
    for (let i = 0; i < 20; i++) s.push(90 + (i % 3) - 1, (t += 100));
    expect(s.disturbanceStd).toBeLessThan(25);
  });
  it('swinging raw stream crosses 25°', () => {
    const s = createHeadingSmoother();
    let t = 0;
    for (let i = 0; i < 20; i++) s.push(i % 2 ? 40 : 140, (t += 100));
    expect(s.disturbanceStd).toBeGreaterThan(25);
  });
  it('window slides: old disturbance leaves the 2 s window', () => {
    const s = createHeadingSmoother();
    let t = 0;
    for (let i = 0; i < 20; i++) s.push(i % 2 ? 40 : 140, (t += 100));
    for (let i = 0; i < 30; i++) s.push(90, (t += 100)); // 3 s of calm
    expect(s.disturbanceStd).toBeLessThan(25);
  });
  it('smoothing does not hide raw disturbance (std uses raw)', () => {
    const s = createHeadingSmoother({ alpha: 0.05 }); // heavy smoothing
    let t = 0;
    for (let i = 0; i < 20; i++) s.push(i % 2 ? 40 : 140, (t += 100));
    expect(Math.abs(angDiffDeg(90, s.value))).toBeLessThan(60); // smoothed is tame…
    expect(s.disturbanceStd).toBeGreaterThan(25); // …but raw std still alarms
  });
  it('circMeanDeg of opposite headings is symmetric, not arithmetic', () => {
    const m = circMeanDeg([350, 10]);
    expect(Math.min(Math.abs(m - 0), 360 - Math.abs(m - 0))).toBeLessThan(1e-9);
  });
  it('circStdDeg of identical headings is 0', () => {
    expect(circStdDeg([45, 45, 45])).toBe(0);
  });
});
