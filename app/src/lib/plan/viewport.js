/**
 * Plan viewport transform (PLAN-2 shell math): world px → screen px.
 * Pure; pointer/pinch wiring lives in the <b-plan> component.
 * screen = world * scale + (tx, ty)
 * @param {{ worldW: number, worldH: number, screenW: number, screenH: number }} o
 */
export function createViewport({ worldW, worldH, screenW, screenH }) {
  const fit = fitBounds({ x: 0, y: 0, w: worldW, h: worldH }, screenW, screenH);
  let { scale, tx, ty } = fit;
  const minScale = fit.scale;
  const maxScale = fit.scale * 8;

  return {
    get scale() { return scale; },
    get tx() { return tx; },
    get ty() { return ty; },
    get minScale() { return minScale; },
    get maxScale() { return maxScale; },
    /** @param {number} sx @param {number} sy */
    toWorld(sx, sy) { return { x: (sx - tx) / scale, y: (sy - ty) / scale }; },
    /** @param {number} wx @param {number} wy */
    toScreen(wx, wy) { return { x: wx * scale + tx, y: wy * scale + ty }; },
    /** Pan by screen-space delta. @param {number} dx @param {number} dy */
    panBy(dx, dy) { tx += dx; ty += dy; },
    /** Zoom by factor, keeping screen point (fx, fy) fixed.
     * @param {number} fx @param {number} fy @param {number} factor */
    zoomAt(fx, fy, factor) {
      const next = Math.min(maxScale, Math.max(minScale, scale * factor));
      const k = next / scale;
      tx = fx - (fx - tx) * k;
      ty = fy - (fy - ty) * k;
      scale = next;
    },
  };
}

/**
 * Fit a world rect into a screen box, centred.
 * @param {{ x: number, y: number, w: number, h: number }} rect
 * @param {number} screenW @param {number} screenH
 */
export function fitBounds(rect, screenW, screenH) {
  const scale = Math.min(screenW / rect.w, screenH / rect.h);
  return {
    scale,
    tx: (screenW - rect.w * scale) / 2 - rect.x * scale,
    ty: (screenH - rect.h * scale) / 2 - rect.y * scale,
  };
}
