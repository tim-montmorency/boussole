import { describe, it, expect } from 'vitest';
import { haversineM, bearingDeg, enuFrame, bearingENU } from '../src/lib/geometry/geo.js';

// POS-6: WGS84 at the edges, ENU inside; known-answer geodesy vectors.
describe('POS-6 geodesy + ENU frame', () => {
  const mtl = { lat: 45.5019, lon: -73.5674 };
  const qc = { lat: 46.8139, lon: -71.2080 };

  it('haversine matches known city-pair distance (±1%)', () => {
    expect(haversineM(mtl, qc)).toBeGreaterThan(230_500);
    expect(haversineM(mtl, qc)).toBeLessThan(236_000);
  });
  it('haversine is zero for identical points and symmetric', () => {
    expect(haversineM(mtl, mtl)).toBe(0);
    expect(haversineM(mtl, qc)).toBeCloseTo(haversineM(qc, mtl), 10);
  });
  it('bearing of a due-east offset ≈ 90°', () => {
    expect(bearingDeg(mtl, { lat: mtl.lat, lon: mtl.lon + 0.01 })).toBeCloseTo(90, 0);
  });
  it('bearing of a due-north offset ≈ 0°', () => {
    expect(bearingDeg(mtl, { lat: mtl.lat + 0.01, lon: mtl.lon })).toBeCloseTo(0, 1);
  });
  it('ENU round-trips within 1 mm at venue scale', () => {
    const f = enuFrame(mtl);
    const p = { lat: mtl.lat + 0.0004, lon: mtl.lon - 0.0006 };
    const back = f.fromENU(f.toENU(p));
    expect(haversineM(p, back)).toBeLessThan(0.001);
  });
  it('ENU axes: +lat is +n, +lon is +e', () => {
    const f = enuFrame(mtl);
    const v = f.toENU({ lat: mtl.lat + 0.001, lon: mtl.lon + 0.002 });
    expect(v.n).toBeGreaterThan(0);
    expect(v.e).toBeGreaterThan(0);
  });
  it('bearingENU matches compass intuition (east = 90)', () => {
    expect(bearingENU({ e: 0, n: 0 }, { e: 10, n: 0 })).toBeCloseTo(90, 6);
    expect(bearingENU({ e: 0, n: 0 }, { e: 0, n: 10 })).toBeCloseTo(0, 6);
  });
});
