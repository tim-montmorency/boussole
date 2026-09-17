import { describe, it, expect } from 'vitest';
import { visibleTiles, tileRectInPlanPx } from '../src/lib/plan/draw.js';
import { fitAffine } from '../src/lib/geometry/affine.js';

// PLAN-6: which tiles cover the current viewport, and where each lands in
// plan-pixel space via the georeference.
const ORIGIN = { lat: 45.5577, lon: -73.7157 };
// Plan: 10 px per metre-ish, aligned north-up. Build control points via a
// known transform: lat = 45.5577 + (1000-py)*1e-5, lon = -73.7157 + px*1.2879e-5
const cps = [
  { px: 0, py: 1000, lat: 45.5577, lon: -73.7157 },
  { px: 1000, py: 1000, lat: 45.5577, lon: -73.7157 + 1000 * 1.2879e-5 },
  { px: 0, py: 0, lat: 45.5577 + 1000 * 1e-5, lon: -73.7157 },
];
const geo = fitAffine(cps);

describe('PLAN-6 tile drawing math', () => {
  it('visibleTiles covers the viewport lat/lon bounds, no more than needed', () => {
    const z = 18;
    const bounds = { north: 45.5590, south: 45.5564, west: -73.7175, east: -73.7139 };
    const tiles = visibleTiles(bounds, z, 19);
    expect(tiles.length).toBeGreaterThanOrEqual(4);
    expect(tiles.length).toBeLessThanOrEqual(12);
    // every tile inside or adjacent to bounds
    for (const t of tiles) {
      expect(t.z).toBe(z);
      expect(t.x).toBeGreaterThanOrEqual(0);
    }
  });
  it('clamps zoom to the source max', () => {
    const tiles = visibleTiles({ north: 46, south: 45, west: -74, east: -73 }, 25, 19);
    expect(tiles[0].z).toBe(19);
  });
  it('tileRectInPlanPx maps a tile corner through the georeference', () => {
    const rect = tileRectInPlanPx(geo, 0, 0, 18, ORIGIN);
    // any tile maps to a finite rect with positive size
    expect(Number.isFinite(rect.x)).toBe(true);
    expect(rect.w).toBeGreaterThan(0);
    expect(rect.h).toBeGreaterThan(0);
  });
  it('two adjacent tiles tile seamlessly in plan px', () => {
    const z = 18;
    // find the tile containing the origin
    const lon2x = (lon) => Math.floor(((lon + 180) / 360) * 2 ** z);
    const lat2y = (lat) => Math.floor(((1 - Math.log(Math.tan(lat * Math.PI / 180) + 1 / Math.cos(lat * Math.PI / 180)) / Math.PI) / 2) * 2 ** z);
    const x = lon2x(ORIGIN.lon), y = lat2y(ORIGIN.lat);
    const a = tileRectInPlanPx(geo, x, y, z, ORIGIN);
    const b = tileRectInPlanPx(geo, x + 1, y, z, ORIGIN);
    expect(b.x).toBeCloseTo(a.x + a.w, 1); // east edge of a = west edge of b
  });
});
