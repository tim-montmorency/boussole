import { describe, it, expect } from 'vitest';
import { computeTier, rememberDenial, wasDenied } from '../src/lib/tiers.js';

// §2 capability tiers + CAP-2 denial memory.
// T3 = camera + any live pose (ancre/manual qualify — v0.3 change).
const P = (orientation, geo, camera) => ({ orientation, geo, camera });

describe('CAP-1 tier detection', () => {
  it('T0 with nothing granted', () => {
    expect(computeTier(P('denied', 'denied', 'denied'), false)).toBe('T0');
    expect(computeTier(P('prompt', 'prompt', 'prompt'), false)).toBe('T0');
  });
  it('T1 with orientation granted and a manual pose available', () => {
    expect(computeTier(P('granted', 'denied', 'denied'), true)).toBe('T1');
    expect(computeTier(P('granted', 'prompt', 'denied'), true)).toBe('T1');
  });
  it('T1 requires a pose — orientation alone without position stays T0 for guidance', () => {
    expect(computeTier(P('granted', 'denied', 'denied'), false)).toBe('T0');
  });
  it('T2 with geolocation granted', () => {
    expect(computeTier(P('granted', 'granted', 'denied'), true)).toBe('T2');
  });
  it('T3 with camera AND any live pose (ancre/manual qualifies)', () => {
    expect(computeTier(P('granted', 'denied', 'granted'), true)).toBe('T3');
  });
  it('T3 is NOT reachable on camera alone without a pose', () => {
    expect(computeTier(P('granted', 'denied', 'granted'), false)).toBe('T0');
  });
  it('GPS loss mid-session drops to T1 with the last pose (CAP-3)', () => {
    expect(computeTier(P('granted', 'denied', 'granted'), true)).toBe('T3'); // pose kept
    expect(computeTier(P('granted', 'prompt', 'denied'), true)).toBe('T1');
  });
});

describe('CAP-2 denial memory', () => {
  const mem = () => { const m = new Map(); return {
    getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, v),
  }; };
  it('a denial is remembered per permission', () => {
    const s = mem();
    rememberDenial(s, 'geo');
    expect(wasDenied(s, 'geo')).toBe(true);
    expect(wasDenied(s, 'camera')).toBe(false);
  });
  it('a grant clears the remembered denial', () => {
    const s = mem();
    rememberDenial(s, 'camera');
    rememberDenial(s, 'camera', false);
    expect(wasDenied(s, 'camera')).toBe(false);
  });
});
