import { describe, it, expect } from 'vitest';
import { createFusion } from '../src/lib/fusion/fuse.js';

// POS-1: weighted blend; ancre/manual hard reset; inaccurate GPS only bounds drift.
const A = { lat: 45.5577, lon: -73.7157 };
const near = (p, dLat = 0.0001, dLon = 0.0001) => ({ lat: p.lat + dLat, lon: p.lon + dLon });

describe('POS-1 fusion rules', () => {
  it('ancre reset sets position with accuracy 1 m', () => {
    const f = createFusion({ now: () => 0 });
    f.handleFix({ kind: 'ancre', ...A, accuracy: 99, t: 0 });
    expect(f.pose.value).toMatchObject({ lat: A.lat, lon: A.lon, accuracy: 1, source: 'ancre' });
  });
  it('manual reset keeps its own (poorer) accuracy and clears estimated', () => {
    const f = createFusion({ now: () => 0 });
    f.handleFix({ kind: 'manual', ...A, accuracy: 4, t: 0 });
    expect(f.pose.value).toMatchObject({ accuracy: 4, source: 'manual', estimated: false });
  });
  it('GPS fix with accuracy > 30 m does not move the dot', () => {
    const f = createFusion({ now: () => 0 });
    f.handleFix({ kind: 'ancre', ...A, accuracy: 1, t: 0 });
    f.handleFix({ kind: 'gps', ...near(A, 0.001), accuracy: 45, t: 1 });
    expect(f.pose.value.lat).toBe(A.lat);
    expect(f.pose.value.source).toBe('ancre');
  });
  it('a better GPS fix after ancre moves the dot and improves accuracy', () => {
    const f = createFusion({ now: () => 0 });
    f.handleFix({ kind: 'manual', ...A, accuracy: 8, t: 0 });
    const g = near(A, 0.0002);
    f.handleFix({ kind: 'gps', ...g, accuracy: 3, t: 1 });
    expect(f.pose.value.lat).toBeCloseTo(g.lat, 6);
    expect(f.pose.value.accuracy).toBe(3);
    expect(f.pose.value.source).toBe('gps');
  });
  it('a worse-but-plausible GPS fix blends rather than snaps', () => {
    const f = createFusion({ now: () => 0 });
    f.handleFix({ kind: 'gps', ...A, accuracy: 5, t: 0 });
    const g = near(A, 0.0004);
    f.handleFix({ kind: 'gps', ...g, accuracy: 20, t: 1 });
    const p = f.pose.value;
    expect(p.lat).not.toBeCloseTo(g.lat, 6); // not a snap
    expect(p.lat).toBeGreaterThan(A.lat);     // but pulled toward it
  });
  it('emits poses through the observable', () => {
    const f = createFusion({ now: () => 0 });
    const seen = [];
    f.pose.subscribe((p) => seen.push(p));
    f.handleFix({ kind: 'ancre', ...A, accuracy: 1, t: 0 });
    expect(seen[0]).toBeNull();
    expect(seen.at(-1).source).toBe('ancre');
  });
});
