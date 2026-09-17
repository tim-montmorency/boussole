/**
 * Tile-draw math (PLAN-6): which tiles cover a lat/lon viewport, and where a
 * tile lands in plan-pixel space via the venue georeference. The canvas
 * component consumes this; fetching/caching lives in the SW/fetch layer.
 */
import { lonToTileX, latToTileY, tileBounds } from './tiles.js';

/**
 * Tiles intersecting a lat/lon bounds at zoom z (clamped to maxZoom).
 * @param {{ north: number, south: number, west: number, east: number }} bounds
 * @param {number} z @param {number} maxZoom
 * @returns {{ z: number, x: number, y: number }[]}
 */
export function visibleTiles(bounds, z, maxZoom) {
  const zz = Math.min(z, maxZoom);
  const x0 = Math.floor(lonToTileX(bounds.west, zz));
  const x1 = Math.floor(lonToTileX(bounds.east, zz));
  const y0 = Math.floor(latToTileY(bounds.north, zz));
  const y1 = Math.floor(latToTileY(bounds.south, zz));
  const out = [];
  for (let x = x0; x <= x1; x++)
    for (let y = y0; y <= y1; y++) out.push({ z: zz, x, y });
  return out;
}

/**
 * A tile's rectangle in plan-pixel space: NW/SE corners → lat/lon → plan px
 * via the affine georeference. Returns a bounding rect (affine ≈ no rotation
 * skew at tile scale, and any residual rotation is absorbed by the viewport).
 * @param {{ inverse(lat: number, lon: number): { px: number, py: number } }} geoRef
 * @param {number} x @param {number} y @param {number} z
 */
export function tileRectInPlanPx(geoRef, x, y, z) {
  const b = tileBounds(x, y, z);
  const nw = geoRef.inverse(b.north, b.west);
  const se = geoRef.inverse(b.south, b.east);
  return { x: nw.px, y: nw.py, w: se.px - nw.px, h: se.py - nw.py };
}
