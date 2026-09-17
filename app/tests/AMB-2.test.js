import { describe, it, expect } from 'vitest';
import { createAmbianceEngine, pointInZone } from '../src/lib/ambiance/engine.js';

// Venue: origin-based; repère 30 m north of start, capture 4 m, reveal 25 m.
const mkBundle = () => ({
  defaults: { captureRadius: 4, revealRadius: 25, arRange: 60 },
  reperes: [{
    id: 'r1', lat: 45.55770 + 30 / 111320, lon: -73.7157, // ~30 m north
    name: { fr: 'R1' },
    tableaux: [
      { kind: 'texte', trigger: 'approche', text: { fr: '…' } },
      { kind: 'image', trigger: 'arrivee', src: 'm/a.webp' },
      { kind: 'boucle', trigger: 'regard', src: 'm/l.webm' },
    ],
  }],
});
const START = { lat: 45.5577, lon: -73.7157 };
/** @param {number} latOffsetM @param {number|null} [heading] @param {number} [accuracy] */
const poseAt = (latOffsetM, heading = 0, accuracy = 2) => ({
  lat: START.lat + latOffsetM / 111320, lon: START.lon, heading, accuracy, source: 'sim', t: 0,
});

// AMB-2: trigger semantics.
describe('AMB-2 triggers', () => {
  it('approche intensity ramps 0→1 as the visitor closes in', () => {
    const e = createAmbianceEngine(mkBundle());
    const far = e.update({ pose: poseAt(30 - 20), now: 0 }); // 20 m away, inside reveal 25
    const near = e.update({ pose: poseAt(30 - 5), now: 1 });  // 5 m away
    const iFar = far.active.find((a) => a.tableau.trigger === 'approche').intensity;
    const iNear = near.active.find((a) => a.tableau.trigger === 'approche').intensity;
    expect(iFar).toBeCloseTo(0.2, 1);
    expect(iNear).toBeCloseTo(0.8, 1);
    expect(iNear).toBeGreaterThan(iFar);
  });
  it('approche is silent beyond revealRadius', () => {
    const e = createAmbianceEngine(mkBundle());
    const out = e.update({ pose: poseAt(0), now: 0 }); // 30 m away > 25 m
    expect(out.active.find((a) => a.tableau.trigger === 'approche')).toBeUndefined();
  });
  it('arrivee fires once per captureRadius entry', () => {
    const e = createAmbianceEngine(mkBundle());
    let out = e.update({ pose: poseAt(30 - 2), now: 0 }); // inside capture 4
    expect(out.events.filter((x) => x.method === 'arrivee')).toHaveLength(1);
    out = e.update({ pose: poseAt(30 - 1), now: 1 }); // still inside
    expect(out.events).toHaveLength(0);
    e.update({ pose: poseAt(0), now: 2 }); // leave
    out = e.update({ pose: poseAt(30 - 2), now: 3 }); // re-enter
    expect(out.events.filter((x) => x.method === 'arrivee')).toHaveLength(1);
  });
  it('regard activates only within ±15° of the repère bearing', () => {
    const e = createAmbianceEngine(mkBundle());
    const facing = e.update({ pose: poseAt(20, 0), now: 0 });   // repère due north, heading 0
    const away = e.update({ pose: poseAt(20, 40), now: 1 });    // 40° off
    const edge = e.update({ pose: poseAt(20, 14), now: 2 });    // 14° off
    expect(facing.active.some((a) => a.tableau.trigger === 'regard')).toBe(true);
    expect(away.active.some((a) => a.tableau.trigger === 'regard')).toBe(false);
    expect(edge.active.some((a) => a.tableau.trigger === 'regard')).toBe(true);
  });
  it('regard is inactive without a heading', () => {
    const e = createAmbianceEngine(mkBundle());
    const out = e.update({ pose: poseAt(20, null), now: 0 });
    expect(out.active.some((a) => a.tableau.trigger === 'regard')).toBe(false);
  });
  it('zone: point-in-polygon incl. outside and vertex edge', () => {
    const zone = /** @type {[number, number][]} */ ([[45.5576, -73.7156], [45.5577, -73.7154], [45.5575, -73.7154]]);
    expect(pointInZone({ lat: 45.5576, lon: -73.7155 }, zone)).toBe(true);
    expect(pointInZone({ lat: 45.5579, lon: -73.7155 }, zone)).toBe(false);
    const bundle = mkBundle();
    bundle.reperes[0].tableaux.push({ kind: 'son', trigger: 'zone', src: 'm/z.opus', zone });
    const e = createAmbianceEngine(bundle);
    const out = e.update({ pose: { lat: 45.5576, lon: -73.7155, heading: 0, accuracy: 2, source: 'sim', t: 0 }, now: 0 });
    expect(out.active.some((a) => a.tableau.trigger === 'zone')).toBe(true);
  });
});

// AMB-4: one son at a time, 1.5 s crossfade.
describe('AMB-4 audio arbitration', () => {
  const twoSons = () => {
    const b = mkBundle();
    b.reperes = [
      { id: 'rA', lat: START.lat + 10 / 111320, lon: START.lon, name: { fr: 'A' },
        tableaux: [{ kind: 'son', trigger: 'approche', src: 'm/a.opus' }] },
      { id: 'rB', lat: START.lat - 10 / 111320, lon: START.lon, name: { fr: 'B' },
        tableaux: [{ kind: 'son', trigger: 'approche', src: 'm/b.opus' }] },
    ];
    return b;
  };
  it('plays the higher-intensity son only', () => {
    const e = createAmbianceEngine(twoSons());
    const out = e.update({ pose: poseAt(9.5), now: 0 }); // closer to rA
    expect(out.audio.current).toBe('rA#0');
  });
  it('crossfades: old son fades for 1.5 s when the winner changes', () => {
    const e = createAmbianceEngine(twoSons());
    e.update({ pose: poseAt(9.5), now: 0 });        // rA wins
    let out = e.update({ pose: poseAt(-9.5), now: 100 }); // rB wins
    expect(out.audio.current).toBe('rB#0');
    expect(out.audio.fadingOut).toBe('rA#0');
    out = e.update({ pose: poseAt(-9.5), now: 1600 });   // 1.5 s elapsed
    expect(out.audio.fadingOut).toBeNull();
  });
  it('silence outside all zones', () => {
    const e = createAmbianceEngine(twoSons());
    e.update({ pose: poseAt(9.5), now: 0 });
    const out = e.update({ pose: poseAt(5000), now: 10 }); // far away
    expect(out.audio.current).toBeNull();
  });
});

// AMB-5: carnet encounters.
describe('AMB-5 carnet events', () => {
  it('arrivee produces an encounter event with method and ISO timestamp', () => {
    const e = createAmbianceEngine(mkBundle());
    const out = e.update({ pose: poseAt(30 - 2), now: 0 });
    expect(out.events[0]).toMatchObject({ type: 'encounter', repereId: 'r1', method: 'arrivee' });
    expect(out.events[0].at).toMatch(/T00:00:00/);
  });
  it('manual check-in is unverified when accuracy is poor', () => {
    const e = createAmbianceEngine(mkBundle());
    expect(e.manualCheckin('r1', 40, 0).verified).toBe(false);
    expect(e.manualCheckin('r1', 5, 0).verified).toBe(true);
  });
});
