import { describe, it, expect } from 'vitest';
import { createPresentation } from '../src/lib/ambiance/present.js';

// AMB-3/4 presentation state: pure mapping from engine output to "what the
// DOM should show/play" — media elements are wired by the component layer.
const T = (kind, trigger, extra = {}) => ({ kind, trigger, src: `m/${kind}`, ...extra });
const active = (key, repereId, tableau, intensity, distanceM = 10) =>
  ({ key, repereId, tableau, intensity, distanceM });

describe('AMB-3 presentation state', () => {
  it('in plan view: image/boucle become bottom cards, texte too, son is invisible', () => {
    const p = createPresentation();
    const out = p.planView([
      active('r1#0', 'r1', T('boucle', 'regard'), 0.8),
      active('r1#1', 'r1', T('texte', 'approche'), 0.5),
      active('r2#0', 'r2', T('son', 'zone'), 1),
    ]);
    expect(out.cards.map((c) => c.key)).toEqual(['r1#0', 'r1#1']);
    expect(out.cards[0].intensity).toBeCloseTo(0.8);
  });
  it('in AR view: image/boucle become billboards with distance-scaled size/opacity', () => {
    const p = createPresentation();
    const out = p.arView([
      active('r1#0', 'r1', T('boucle', 'regard'), 1, 5),
      active('r2#0', 'r2', T('image', 'regard'), 1, 50),
    ], { heading: 90 });
    const near = out.billboards.find((b) => b.key === 'r1#0');
    const far = out.billboards.find((b) => b.key === 'r2#0');
    expect(near.scale).toBeGreaterThan(far.scale);
    expect(near.opacity).toBeGreaterThan(far.opacity);
  });
  it('texte/son never billboard in AR', () => {
    const p = createPresentation();
    const out = p.arView([active('r1#0', 'r1', T('texte', 'regard'), 1, 5)], { heading: 0 });
    expect(out.billboards).toHaveLength(0);
  });
});

describe('AMB-4 media scheduling', () => {
  it('audio: current plays through AudioContext path, fadingOut is scheduled for 1.5 s', () => {
    const p = createPresentation();
    const out = p.audioPlan({ current: 'r1#0', fadingOut: 'r2#0' }, 1000);
    expect(out.play).toEqual({ key: 'r1#0' });
    expect(out.fadeOut).toEqual({ key: 'r2#0', untilMs: 1000 + 1500 });
  });
  it('video loops: pause when not in active list or tab hidden (PERM-3/AMB-4)', () => {
    const playing = createPresentation(); // visible lifecycle
    playing.videoPlan([active('r1#0', 'r1', T('boucle', 'regard'), 1)], { hidden: false });
    const hidden = playing.videoPlan([active('r1#0', 'r1', T('boucle', 'regard'), 1)], { hidden: true });
    expect(hidden.play).toEqual([]);
    expect(hidden.pause).toEqual(['r1#0']);
    const gone = playing.videoPlan([], { hidden: false });
    expect(gone.pause).toEqual([]); // already paused by the hidden pass
    const fresh = createPresentation(); // separate presenter: leaving active pauses
    fresh.videoPlan([active('r1#0', 'r1', T('boucle', 'regard'), 1)], { hidden: false });
    expect(fresh.videoPlan([], { hidden: false }).pause).toEqual(['r1#0']);
  });
});
