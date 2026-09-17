import { describe, it, expect } from 'vitest';
import { projectMarker, arMarkers } from '../src/lib/ar/project.js';

// AR-2..5: bearing→x projection, horizon pitch offset, FOV calibration,
// edge chevrons, capture radius.
const POSE = { lat: 45.5577, lon: -73.7157, heading: 0, accuracy: 2, source: 'sim', t: 0 };
const NORTH = { lat: 45.5579, lon: -73.7157 };  // due north ~22 m
const EAST = { lat: 45.5577, lon: -73.7152 };   // due east ~39 m (in range)
const NE20 = { lat: 45.5577 + Math.cos(20 * Math.PI / 180) * 20 / 111320,
               lon: -73.7157 + Math.sin(20 * Math.PI / 180) * 20 / (111320 * Math.cos(45.5577 * Math.PI / 180)) }; // ~20° east of north, ~20 m
const FAR = { lat: 45.5585, lon: -73.7157 };    // north ~89 m

const VIEW = { w: 390, h: 844, hFov: 65, pitchDeg: 0, arRange: 60, captureRadius: 4 };

describe('AR-2 marker projection', () => {
  it('a marker dead ahead lands at screen centre', () => {
    const m = projectMarker(POSE, NORTH, VIEW);
    expect(m.x).toBeCloseTo(VIEW.w / 2, 3);
    expect(m.visible).toBe(true);
  });
  it('marker to the east lands right of centre by the FOV fraction', () => {
    // 20° off heading at 65° hFOV → x = W/2 + (20/65)×W
    const m = projectMarker(POSE, NE20, VIEW);
    expect(m.chevron).toBeNull();
    expect(m.x).toBeCloseTo(VIEW.w / 2 + (20 / VIEW.hFov) * VIEW.w, 0);
  });
  it('pitch moves the horizon line (looking down drops the horizon → marker sinks)', () => {
    const level = projectMarker(POSE, NORTH, VIEW);
    const down = projectMarker(POSE, NORTH, { ...VIEW, pitchDeg: 20 });
    expect(down.y).toBeGreaterThan(level.y);
  });
  it('beyond arRange → far-mode chevron at the edge (works from anywhere)', () => {
    const m = projectMarker(POSE, FAR, VIEW);
    expect(m.visible).toBe(true);
    expect(m.far).toBe(true);
    expect(m.chevron).toBe('right'); // delta 0 (dead ahead) → right by convention
    expect(m.tappable).toBe(false);
  });
  it('far-mode chevron side follows the bearing delta sign', () => {
    // target due east, heading north → delta +90 → right edge
    const east = projectMarker(POSE, { lat: 45.56, lon: -73.70 }, VIEW); // ~1.4 km east
    expect(east.far).toBe(true);
    expect(east.chevron).toBe('right');
    expect(east.x).toBe(VIEW.w - 16);
  });
  it('calibrated hFOV changes the projection (in-FOV marker)', () => {
    const wide = projectMarker(POSE, NE20, { ...VIEW, hFov: 80 });
    const narrow = projectMarker(POSE, NE20, { ...VIEW, hFov: 50 });
    expect(narrow.x).toBeGreaterThan(wide.x); // same delta fills more of a narrow FOV
  });
});

describe('AR-3 edge chevrons', () => {
  it('off-screen right marker collapses to a right chevron', () => {
    const m = projectMarker(POSE, EAST, { ...VIEW, hFov: 40 }); // 90° off > 40/2
    expect(m.visible).toBe(true);
    expect(m.chevron).toBe('right');
  });
  it('off-screen left marker collapses to a left chevron', () => {
    const west = { lat: 45.5577, lon: -73.7162 };
    const m = projectMarker(POSE, west, { ...VIEW, hFov: 40 });
    expect(m.chevron).toBe('left');
  });
});

describe('AR-4/5 size, opacity, capture', () => {
  it('near markers are bigger and more opaque', () => {
    const near = projectMarker(POSE, { lat: 45.55775, lon: -73.7157 }, VIEW); // ~5.5 m
    const far = projectMarker(POSE, NORTH, VIEW); // ~22 m
    expect(near.size).toBeGreaterThan(far.size);
    expect(near.opacity).toBeGreaterThan(far.opacity);
  });
  it('inside captureRadius → tappable', () => {
    const inside = projectMarker(POSE, { lat: 45.55772, lon: -73.7157 }, VIEW); // ~2.2 m
    expect(inside.tappable).toBe(true);
    const outside = projectMarker(POSE, NORTH, VIEW);
    expect(outside.tappable).toBe(false);
  });
});

describe('arMarkers batch', () => {
  it('far markers included (edge chevrons), sorted far→near for paint order', () => {
    const repères = [
      { ...NORTH, id: 'n' }, { ...EAST, id: 'e' }, { ...FAR, id: 'f' },
    ];
    const ms = arMarkers(POSE, repères, VIEW);
    expect(ms.map((m) => m.id)).toEqual(['f', 'e', 'n']); // far first (painted under)
    expect(ms.find((m) => m.id === 'f').far).toBe(true);
  });
});
