import { describe, it, expect } from 'vitest';
import { createDebugSession } from '../src/lib/debug/session.js';
import { createFusion } from '../src/lib/fusion/fuse.js';
import { readFileSync } from 'node:fs';

const TRACE = readFileSync(new URL('../fixtures/traces/visit-01.jsonl', import.meta.url), 'utf8');
const VENUE = {
  defaults: { captureRadius: 4, revealRadius: 25, arRange: 60 },
  reperes: [{ id: 'r1', lat: 45.55762, lon: -73.71555, name: { fr: 'R1' }, tableaux: [] }],
};

// DEMO-3: debug session — SimPositionSource drives fusion; readout reports
// pose, per-source last fix, plan mode, permission/audio states.
describe('DEMO-3 debug session', () => {
  it('injects a start pose that outranks live sources', () => {
    const fusion = createFusion();
    const dbg = createDebugSession(fusion, { now: () => 0 });
    dbg.applyPose({ lat: 45.5577, lon: -73.7157, heading: 90, accuracy: 2 });
    expect(fusion.pose.value).toMatchObject({ lat: 45.5577, heading: 90, source: 'sim' });
  });
  it('joystick step and rotate drive the fused pose', () => {
    let t = 0;
    const fusion = createFusion({ now: () => t });
    const dbg = createDebugSession(fusion, { now: () => t });
    dbg.applyPose({ lat: 45.5577, lon: -73.7157, heading: 0, accuracy: 1 });
    dbg.step(); dbg.rotate(90); dbg.step();
    const p = fusion.pose.value;
    expect(p.lat).toBeGreaterThan(45.5577);   // first step north
    expect(p.lon).toBeGreaterThan(-73.7157);  // second step east after rotate
  });
  it('walk-to-target drives fusion until arrival and reports remaining distance', () => {
    let t = 0;
    const fusion = createFusion({ now: () => t });
    const dbg = createDebugSession(fusion, { now: () => t });
    dbg.applyPose({ lat: 45.5577, lon: -73.7157, heading: 0, accuracy: 1 });
    dbg.walkTo(VENUE.reperes[0]); // ~19 m away
    let remaining = null;
    for (let i = 0; i < 40 && remaining !== 0; i++) { t += 1000; remaining = dbg.tick(1000); }
    expect(remaining).toBe(0);
    expect(fusion.pose.value.lat).toBeCloseTo(VENUE.reperes[0].lat, 6);
  });
  it('replays a trace through fusion at 1× and 4× with identical pose sequences', () => {
    const run = (speed) => {
      let t = 0;
      const fusion = createFusion({ now: () => t });
      const dbg = createDebugSession(fusion, { now: () => t });
      const poses = [];
      fusion.pose.subscribe((p) => { if (p) poses.push(JSON.stringify([p.lat, p.lon, p.source])); });
      dbg.playTrace(TRACE, speed);
      while (!dbg.traceDone()) { t += 100; dbg.tick(100); }
      return poses.join('|');
    };
    expect(run(1)).toBe(run(4));
    expect(run(1)).toContain('ancre'); // trace contains an ancre reset
  });
  it('readout reports pose, plan mode, per-source state and flags', () => {
    const fusion = createFusion({ now: () => 0 });
    const dbg = createDebugSession(fusion, { now: () => 0 });
    dbg.applyPose({ lat: 45.5577, lon: -73.7157, heading: 45, accuracy: 1 });
    const r = dbg.readout({ planMode: 'north-up', perms: { geo: 'denied' }, audioUnlocked: false });
    expect(r).toMatchObject({
      pose: { lat: 45.5577, heading: 45, source: 'sim' },
      planMode: 'north-up',
      audioUnlocked: false,
    });
    expect(r.sources.sim).toBeDefined();
  });
  it('debug poses are marked sim so they are never persisted (DEMO-3/DATA)', () => {
    const fusion = createFusion({ now: () => 0 });
    const dbg = createDebugSession(fusion, { now: () => 0 });
    dbg.applyPose({ lat: 45.5577, lon: -73.7157, heading: 0, accuracy: 1 });
    expect(fusion.pose.value.source).toBe('sim');
  });
});
