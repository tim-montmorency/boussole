import { describe, it, expect } from 'vitest';
import { cadranState } from '../src/lib/cadran/state.js';

// CAD-1..4 display-state logic: given pose + target, what the HUD shows.
const pose = (lat, lon, heading, extra = {}) => ({
  lat, lon, heading, accuracy: 2, source: 'sim', t: 0, ...extra,
});
const TARGET = { lat: 45.55760, lon: -73.71550 }; // ~19 m SE of start
const START = { lat: 45.5577, lon: -73.7157 };

describe('CAD-1 rose + arrow + distance', () => {
  it('bearing delta is target bearing minus heading, normalized to (-180,180]', () => {
    const s = cadranState(pose(START.lat, START.lon, 0), TARGET);
    // target is roughly SE of start: bearing ≈ 135°
    expect(s.bearingDelta).toBeGreaterThan(90);
    expect(s.bearingDelta).toBeLessThan(180);
    // facing the target → delta ≈ 0
    const facing = cadranState(pose(START.lat, START.lon, s.bearingDeg), TARGET);
    expect(Math.abs(facing.bearingDelta)).toBeLessThan(1);
  });
  it('distance in metres, 1 decimal under 10 m', () => {
    const near = cadranState(pose(TARGET.lat + 5e-6, TARGET.lon, 0), TARGET); // ~0.56 m
    expect(near.distanceText).toMatch(/^0\.\d m$/);
    const far = cadranState(pose(START.lat, START.lon, 0), TARGET);
    expect(far.distanceText).toMatch(/^\d+ m$/); // ≥10 m: integer
  });
  it('far mode: km with 1 decimal beyond 1 km (works from anywhere)', () => {
    const mtl = cadranState(pose(45.5019, -73.5674, 0), TARGET); // ~13 km away
    expect(mtl.distanceText).toMatch(/^\d+\.\d km$/);
  });
  it('rose rotation is -heading (north-up text at top when heading 0)', () => {
    expect(cadranState(pose(START.lat, START.lon, 90), TARGET).roseDeg).toBe(-90);
  });
  it('no pose → empty state, no crash', () => {
    const s = cadranState(null, TARGET);
    expect(s.bearingDelta).toBeNull();
    expect(s.distanceText).toBe('');
  });
  it('no heading → arrow hidden but distance shown', () => {
    const s = cadranState(pose(START.lat, START.lon, null), TARGET);
    expect(s.bearingDelta).toBeNull();
    expect(s.distanceText).not.toBe('');
  });
});

describe('CAD-2 hot/cold ring (colour + pulse + shape, A11Y-1)', () => {
  it('green + fast pulse + filled icon under 5 m', () => {
    const s = cadranState(pose(TARGET.lat + 2e-5, TARGET.lon, 0), TARGET); // ~2.2 m
    expect(s.ring).toMatchObject({ band: 'hot', pulseMs: 600 });
  });
  it('cold band far away, slow pulse', () => {
    const s = cadranState(pose(START.lat + 40 / 111320, START.lon, 0), TARGET); // ~59 m
    expect(s.ring.band).toBe('cold');
    expect(s.ring.pulseMs).toBeGreaterThan(1500);
  });
  it('bands are distinguished by shape too (A11Y-1: not colour-only)', () => {
    const hot = cadranState(pose(TARGET.lat, TARGET.lon, 0), TARGET);
    const cold = cadranState(pose(START.lat, START.lon, 0), TARGET);
    expect(hot.ring.shape).not.toBe(cold.ring.shape);
  });
});

describe('CAD-4 confidence labels', () => {
  it('manual pose → "position manuelle" label', () => {
    const s = cadranState(pose(START.lat, START.lon, 0, { source: 'manual' }), TARGET);
    expect(s.label).toBe('pos.manual');
  });
  it('estimated pose → "position estimée" badge (CAP-3)', () => {
    const s = cadranState(pose(START.lat, START.lon, 0, { estimated: true }), TARGET);
    expect(s.label).toBe('pos.estimated');
  });
  it('low confidence (accuracy > 15 m) dims the arrow (POS-4)', () => {
    const s = cadranState(pose(START.lat, START.lon, 0, { accuracy: 20 }), TARGET);
    expect(s.arrowDimmed).toBe(true);
    expect(cadranState(pose(START.lat, START.lon, 0), TARGET).arrowDimmed).toBe(false);
  });
});

describe('CAD-3 haptic schedule', () => {
  it('tick every 10 m closer and on arrival (returns vibration events)', () => {
    const mk = (d) => pose(TARGET.lat + d / 111320, TARGET.lon, 0);
    expect(cadranState(mk(25), TARGET).haptic).toBeNull();
    expect(cadranState(mk(19), TARGET).haptic).toEqual({ type: 'tick' }); // crossed 20 m
    expect(cadranState(mk(3), TARGET).haptic).toEqual({ type: 'arrive' }); // inside capture
  });
});
