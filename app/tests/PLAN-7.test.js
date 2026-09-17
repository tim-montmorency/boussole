import { describe, it, expect } from 'vitest';
import { createBasemapRegistry, osmSource, createLayerStack }
  from '../src/lib/plan/layers.js';

// PLAN-5/7/8: basemap source registry + layer compositing + overlay decls.
describe('PLAN-5 basemap sources', () => {
  it('ships osm + none; osm carries ODbL attribution', () => {
    const r = createBasemapRegistry();
    expect(r.ids()).toContain('osm');
    expect(r.ids()).toContain('none');
    expect(r.get('osm').attribution).toContain('OpenStreetMap');
  });
  it('osm builds standard tile URLs', () => {
    expect(osmSource.tileUrl(17, 38577, 45905))
      .toBe('https://tile.openstreetmap.org/17/38577/45905.png');
  });
  it('none produces no URLs', () => {
    expect(createBasemapRegistry().get('none').tileUrl(1, 1, 1)).toBeNull();
  });
  it('a custom provider registers as one object', () => {
    const r = createBasemapRegistry();
    r.add({ id: 'venue', label: 'Venue', attribution: 'x', minZoom: 15, maxZoom: 19,
      tileUrl: (z, x, y) => `tiles/${z}/${x}/${y}.webp` });
    expect(r.get('venue').tileUrl(16, 1, 2)).toBe('tiles/16/1/2.webp');
  });
});

describe('PLAN-7/8 layer stack', () => {
  const venue = {
    defaults: { basemap: 'none', planOpacity: 0.85 },
    overlays: [
      { id: 'ov-hist', src: 'media/hist.webp', opacity: 0.7, visible: true,
        controlPoints: [{ px: 0, py: 0, lat: 45.56, lon: -73.72 }] },
      { id: 'ov-hidden', src: 'media/x.webp', visible: false,
        controlPoints: [{ px: 0, py: 0, lat: 45.56, lon: -73.72 }] },
    ],
  };
  it('composites bottom→top: basemap, visible overlays, plan', () => {
    const reg = createBasemapRegistry();
    const stack = createLayerStack(venue, reg);
    expect(stack.layers().map((l) => l.kind)).toEqual(['overlay', 'plan']); // basemap none → absent
    const withMap = createLayerStack({ ...venue, defaults: { ...venue.defaults, basemap: 'osm' } }, reg);
    expect(withMap.layers().map((l) => l.kind)).toEqual(['basemap', 'overlay', 'plan']);
    expect(withMap.layers()[1].id).toBe('ov-hist'); // hidden overlay excluded
  });
  it('plan opacity comes from venue defaults (0.85)', () => {
    const stack = createLayerStack(venue, createBasemapRegistry());
    expect(stack.layers().find((l) => l.kind === 'plan').opacity).toBeCloseTo(0.85);
  });
  it('overlay visibility toggles at runtime', () => {
    const stack = createLayerStack(venue, createBasemapRegistry());
    stack.setOverlayVisible('ov-hist', false);
    expect(stack.layers().filter((l) => l.kind === 'overlay')).toHaveLength(0);
    stack.setOverlayVisible('ov-hist', true);
    expect(stack.layers().filter((l) => l.kind === 'overlay')).toHaveLength(1);
  });
  it('PLAN-8: basemap defaults to none and never renders without opt-in', () => {
    const stack = createLayerStack({ defaults: {}, overlays: [] }, createBasemapRegistry());
    expect(stack.layers().some((l) => l.kind === 'basemap')).toBe(false);
  });
});
