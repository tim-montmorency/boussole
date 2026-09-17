import { describe, it, expect } from 'vitest';
import { fitAffine, GeoreferenceError } from '../src/lib/geometry/affine.js';
import { enuFrame } from '../src/lib/geometry/geo.js';

// PLAN-1: affine georeference from control points.
// Hand-built transform: lat = 45.5 + py*1e-5, lon = -73.7 + px*2e-5
const mk = (px, py) => ({ px, py, lat: 45.5 + py * 1e-5, lon: -73.7 + px * 2e-5 });

describe('PLAN-1 affine fit', () => {
  it('exactly 3 non-collinear points → exact solve, ~zero residuals', () => {
    const g = fitAffine([mk(0, 0), mk(1000, 0), mk(0, 2000)]);
    expect(Math.max(...g.residuals)).toBeLessThan(1e-9);
    const ll = g.forward(500, 700);
    expect(ll.lat).toBeCloseTo(45.5 + 700 * 1e-5, 9);
    expect(ll.lon).toBeCloseTo(-73.7 + 500 * 2e-5, 9);
  });
  it('4+ points → least squares; redundant consistent point keeps residuals tiny', () => {
    const g = fitAffine([mk(0, 0), mk(1000, 0), mk(0, 2000), mk(1000, 2000)]);
    expect(Math.max(...g.residuals)).toBeLessThan(1e-9);
  });
  it('least squares spreads a single noisy point instead of following it exactly', () => {
    const noisy = mk(1000, 2000); noisy.lat += 5e-5;
    const g = fitAffine([mk(0, 0), mk(1000, 0), mk(0, 2000), noisy]);
    const exact = g.forward(0, 0);
    expect(exact.lat).not.toBeCloseTo(45.5, 9); // error is distributed
    expect(g.residuals[3]).toBeGreaterThan(0);
    expect(g.residuals[3]).toBeLessThan(5e-5); // but not fully absorbed
  });
  it('rejects collinear control points', () => {
    expect(() => fitAffine([mk(0, 0), mk(500, 0), mk(1000, 0)])).toThrow(GeoreferenceError);
  });
  it('rejects fewer than 3 points', () => {
    expect(() => fitAffine([mk(0, 0), mk(1, 1)])).toThrow(GeoreferenceError);
  });
  it('forward∘inverse ≈ identity within 0.5 px', () => {
    const g = fitAffine([mk(0, 0), mk(1000, 0), mk(0, 2000)]);
    const ll = g.forward(333, 777);
    const px = g.inverse(ll.lat, ll.lon);
    expect(px.px).toBeCloseTo(333, 1);
    expect(px.py).toBeCloseTo(777, 1);
  });
  it('stays metre-accurate when fitted on real control points around the venue', () => {
    // Simulate a plan whose pixel grid aligns with ENU at 10 px/m around origin.
    const origin = { lat: 45.5577, lon: -73.7157 };
    const f = enuFrame(origin);
    const toCp = (e, n) => { const p = f.fromENU({ e, n }); return { px: e * 10, py: -n * 10, ...p }; };
    const g = fitAffine([toCp(0, 0), toCp(80, 0), toCp(0, 50)]);
    const target = f.fromENU({ e: 33, n: 21 });
    const px = g.inverse(target.lat, target.lon);
    const back = g.forward(px.px, px.py);
    const v1 = f.toENU(target), v2 = f.toENU(back);
    expect(Math.hypot(v1.e - v2.e, v1.n - v2.n)).toBeLessThan(0.01);
  });
});
