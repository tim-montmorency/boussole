import { describe, it, expect } from 'vitest';
import { createViewport, fitBounds } from '../src/lib/plan/viewport.js';

// PLAN-2 support: canvas pan/zoom transform math (pointer wiring is the shell).
describe('plan viewport', () => {
  it('starts fitted to the plan bounds', () => {
    const v = createViewport({ worldW: 4096, worldH: 2731, screenW: 400, screenH: 800 });
    expect(v.scale).toBeCloseTo(Math.min(400 / 4096, 800 / 2731), 5);
  });
  it('screen→world→screen round-trips', () => {
    const v = createViewport({ worldW: 4096, worldH: 2731, screenW: 400, screenH: 800 });
    const w = v.toWorld(123, 456);
    const s = v.toScreen(w.x, w.y);
    expect(s.x).toBeCloseTo(123, 6);
    expect(s.y).toBeCloseTo(456, 6);
  });
  it('pan moves the world under the finger 1:1', () => {
    const v = createViewport({ worldW: 4096, worldH: 2731, screenW: 400, screenH: 800 });
    const before = v.toWorld(200, 400);
    v.panBy(30, -10);
    const after = v.toWorld(230, 390);
    expect(after.x).toBeCloseTo(before.x, 6);
    expect(after.y).toBeCloseTo(before.y, 6);
  });
  it('zoom is anchored at the focal point (pinch centre stays put)', () => {
    const v = createViewport({ worldW: 4096, worldH: 2731, screenW: 400, screenH: 800 });
    const anchor = v.toWorld(200, 400);
    v.zoomAt(200, 400, 2);
    const after = v.toWorld(200, 400);
    expect(v.scale).toBeCloseTo(v.minScale * 2, 5);
    expect(after.x).toBeCloseTo(anchor.x, 6);
    expect(after.y).toBeCloseTo(anchor.y, 6);
  });
  it('zoom is clamped to [minScale, maxScale]', () => {
    const v = createViewport({ worldW: 4096, worldH: 2731, screenW: 400, screenH: 800 });
    v.zoomAt(200, 400, 1000);
    expect(v.scale).toBe(v.maxScale);
    v.zoomAt(200, 400, 1e-9);
    expect(v.scale).toBe(v.minScale);
  });
  it('fitBounds centres and scales a world rect into the screen', () => {
    const f = fitBounds({ x: 0, y: 0, w: 1000, h: 500 }, 500, 500);
    expect(f.scale).toBeCloseTo(0.5, 6);
    // centre of rect (500, 250) lands on screen centre (250, 250)
    expect(f.tx + 500 * 0.5).toBeCloseTo(250, 6);
    expect(f.ty + 250 * 0.5).toBeCloseTo(250, 6);
  });
});
