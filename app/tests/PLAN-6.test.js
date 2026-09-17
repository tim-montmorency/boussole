import { describe, it, expect } from 'vitest';
import { lonToTileX, latToTileY, tileToLonLat, tileBounds, zoomForSpan }
  from '../src/lib/plan/tiles.js';

// PLAN-6: Web-Mercator slippy-tile math, known-answer vectors.
describe('PLAN-6 slippy tile math', () => {
  it('origin: lon 0, lat 0 → centre of world at z1', () => {
    expect(lonToTileX(0, 1)).toBeCloseTo(1, 6);
    expect(latToTileY(0, 1)).toBeCloseTo(1, 6);
  });
  it('known vector: Montréal at z12 (verified against python reference impl)', () => {
    expect(Math.floor(lonToTileX(-73.7157, 12))).toBe(1209);
    expect(Math.floor(latToTileY(45.5577, 12))).toBe(1464);
  });
  it('tileToLonLat inverts floor(tile) at the NW corner', () => {
    const z = 14, x = Math.floor(lonToTileX(-73.7157, z)), y = Math.floor(latToTileY(45.5577, z));
    const { lat, lon } = tileToLonLat(x, y, z);
    expect(lon).toBeLessThanOrEqual(-73.7157); // NW corner is west
    expect(lat).toBeGreaterThanOrEqual(45.5577); // … and north
  });
  it('tileBounds spans exactly one tile', () => {
    const b = tileBounds(1205, 1436, 12);
    const next = tileBounds(1206, 1437, 12);
    expect(b.east).toBeCloseTo(next.west, 10);
    expect(b.south).toBeCloseTo(next.north, 10);
  });
  it('clamps latitude to the Mercator limit (±85.0511°)', () => {
    expect(latToTileY(89, 5)).toBeCloseTo(0, 6);
    expect(latToTileY(-89, 5)).toBeCloseTo(32, 6);
  });
  it('zoomForSpan picks a zoom where the span fits ~1–2 tiles', () => {
    // 200 m venue at lat 45.5: tile ≈ 306 m at z17, ≈153 m at z18 → 2-tile target = z18
    const z = zoomForSpan(200, 45.5577);
    expect(z).toBe(18);
  });
});
