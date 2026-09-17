/**
 * Basemap source registry + layer stack (PLAN-5/7/8).
 * Pure composition logic — tile fetching/drawing lives in the component.
 */

/** @typedef {{ id: string, label: string, attribution: string,
 *   tileUrl(z: number, x: number, y: number): string | null,
 *   minZoom: number, maxZoom: number }} BasemapSource */

/** @type {BasemapSource} */
export const osmSource = {
  id: 'osm',
  label: 'OpenStreetMap',
  attribution: '© OpenStreetMap contributors (ODbL)',
  minZoom: 0, maxZoom: 19,
  tileUrl: (z, x, y) => `https://tile.openstreetmap.org/${z}/${x}/${y}.png`,
};

/** @type {BasemapSource} */
const noneSource = {
  id: 'none', label: '—', attribution: '',
  minZoom: 0, maxZoom: 0, tileUrl: () => null,
};

export function createBasemapRegistry() {
  /** @type {Map<string, BasemapSource>} */
  const sources = new Map([['osm', osmSource], ['none', noneSource]]);
  return {
    /** @param {BasemapSource} s */
    add(s) { sources.set(s.id, s); },
    /** @param {string} id */
    get(id) { return sources.get(id) ?? noneSource; },
    ids: () => [...sources.keys()],
  };
}

/**
 * Compose the draw stack for a venue: bottom→top = basemap?, visible
 * overlays (declaration order), plan. Basemap renders only when the venue
 * opts in (PLAN-8: default `none`).
 * @param {any} venue bundle (defaults.basemap, defaults.planOpacity, overlays[])
 * @param {ReturnType<typeof createBasemapRegistry>} registry
 */
export function createLayerStack(venue, registry) {
  const basemapId = venue?.defaults?.basemap ?? 'none';
  const planOpacity = venue?.defaults?.planOpacity ?? 1;
  /** @type {Record<string, boolean>} */
  const overlayVis = {};
  for (const o of venue?.overlays ?? []) overlayVis[o.id] = o.visible !== false;

  function layers() {
    /** @type {any[]} */ const out = [];
    if (basemapId !== 'none') {
      out.push({ kind: 'basemap', id: basemapId, source: registry.get(basemapId), opacity: 1 });
    }
    for (const o of venue?.overlays ?? []) {
      if (overlayVis[o.id]) out.push({ kind: 'overlay', id: o.id, overlay: o, opacity: o.opacity ?? 1 });
    }
    out.push({ kind: 'plan', id: 'plan', opacity: planOpacity });
    return out;
  }

  return {
    layers,
    /** @param {string} id @param {boolean} v */
    setOverlayVisible(id, v) { overlayVis[id] = v; },
    /** @param {string} id */
    overlayVisible(id) { return overlayVis[id] ?? false; },
    get basemapId() { return basemapId; },
  };
}
