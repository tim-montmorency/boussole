import { describe, it, expect } from 'vitest';
import { createSimSource, parseTrace, createTracePlayer } from '../src/lib/fusion/sim.js';
import { haversineM } from '../src/lib/geometry/geo.js';

const START = { lat: 45.5577, lon: -73.7157 };

// POS-8 / DEMO-3: SimPositionSource is a first-class PositionSource.
describe('POS-8 SimPositionSource', () => {
  it('implements the PositionSource contract', async () => {
    const s = createSimSource(START);
    expect(s.id).toBe('sim');
    expect(typeof s.priority).toBe('number');
    await expect(s.supported()).resolves.toBe(true);
    expect(typeof s.subscribe).toBe('function');
    s.start(); s.stop();
  });
  it('joystick step moves ~0.5 m along heading', () => {
    const s = createSimSource({ ...START, heading: 0 });
    let last = null;
    s.subscribe((f) => { last = f; });
    s.start();
    s.step();
    expect(haversineM(START, last)).toBeCloseTo(0.5, 1);
    expect(last.lat).toBeGreaterThan(START.lat); // heading 0 = north
  });
  it('rotate turns 5° per step and wraps', () => {
    const s = createSimSource({ ...START, heading: 358 });
    let h = null;
    s.subscribeHeading((d) => { h = d; });
    s.rotate();
    expect(h).toBeCloseTo(3, 6);
  });
  it('walkTo advances at 1.2 m/s and arrives', () => {
    const target = { lat: START.lat + 0.0001, lon: START.lon }; // ~11.1 m north
    const s = createSimSource(START);
    s.walkTo(target, 1.2);
    let remaining = null;
    for (let i = 0; i < 20 && remaining !== 0; i++) remaining = s.tick(1000);
    expect(remaining).toBe(0);
    expect(haversineM(target, s.position)).toBeLessThan(0.01);
  });
  it('walkTo turns heading toward the target', () => {
    const s = createSimSource({ ...START, heading: 270 });
    s.walkTo({ lat: START.lat + 0.0001, lon: START.lon });
    s.tick(100);
    expect(s.position.heading).toBeCloseTo(0, 0);
  });
});

const TRACE = `
{ "meta": { "venue": "montmorency-A" } }
{ "t": 0, "source": "gps", "payload": { "lat": 45.5577, "lon": -73.7157, "accuracy": 8 } }
{ "t": 100, "source": "orientation", "payload": { "heading": 90 } }
{ "t": 200, "source": "ancre", "payload": { "lat": 45.5578, "lon": -73.7160, "accuracy": 1 } }
`;

describe('DEMO-3 trace playback', () => {
  it('parses header + events from .jsonl', () => {
    const { meta, events } = parseTrace(TRACE);
    expect(meta.venue).toBe('montmorency-A');
    expect(events).toHaveLength(3);
  });
  it('replays fixes and headings in order', () => {
    const fixes = [], headings = [];
    const p = createTracePlayer(TRACE, {
      onFix: (f) => fixes.push(f), onHeading: (h) => headings.push(h),
    });
    p.runAll();
    expect(fixes.map((f) => f.kind)).toEqual(['gps', 'ancre']);
    expect(headings).toEqual([90]);
  });
  it('1× and 4× replay emit the identical sequence', () => {
    const seq = (speed) => {
      const out = [];
      const p = createTracePlayer(TRACE, {
        onFix: (f) => out.push(['f', f.kind]), onHeading: (h) => out.push(['h', h]),
      });
      p.runAll(speed);
      return JSON.stringify(out);
    };
    expect(seq(1)).toBe(seq(4));
  });
  it('respects event timing at 1× (nothing before its t)', () => {
    const fixes = [];
    const p = createTracePlayer(TRACE, { onFix: (f) => fixes.push(f) });
    p.advance(150); // t=100 heading passes, t=200 ancre not yet
    expect(fixes.map((f) => f.kind)).toEqual(['gps']);
    p.advance(100);
    expect(fixes.map((f) => f.kind)).toEqual(['gps', 'ancre']);
  });
});
