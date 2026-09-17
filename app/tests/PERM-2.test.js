import { describe, it, expect } from 'vitest';
import { createOrientationShell } from '../src/lib/sensors/orientation.js';

// PERM-2: iOS dual requestPermission chain (orientation + motion) in one gesture;
// POS-2: deviceorientationabsolute w/ absolute:true preferred, webkitCompassHeading
// on iOS, relative-alpha fallback flagged low-confidence.

/** Fake event-target window. */
function fakeWin() {
  const listeners = new Map();
  return {
    addEventListener: (ev, fn) => listeners.set(ev, [...(listeners.get(ev) ?? []), fn]),
    removeEventListener: (ev, fn) => listeners.set(ev, (listeners.get(ev) ?? []).filter((f) => f !== fn)),
    emit: (ev, data) => (listeners.get(ev) ?? []).forEach((f) => f(data)),
  };
}

describe('PERM-2 iOS permission chain', () => {
  it('requests orientation AND motion in one call, both granted', async () => {
    const calls = [];
    const shell = createOrientationShell({
      win: fakeWin(),
      requestOrientation: async () => { calls.push('orientation'); return 'granted'; },
      requestMotion: async () => { calls.push('motion'); return 'granted'; },
    });
    const res = await shell.requestPermissions();
    expect(res).toEqual({ orientation: 'granted', motion: 'granted' });
    expect(calls).toEqual(['orientation', 'motion']);
  });
  it('motion denied → DR silently unsupported, orientation still works (PERM-2)', async () => {
    const shell = createOrientationShell({
      win: fakeWin(),
      requestOrientation: async () => 'granted',
      requestMotion: async () => 'denied',
    });
    const res = await shell.requestPermissions();
    expect(res.motion).toBe('denied');
    expect(shell.motionOk).toBe(false);
  });
  it('platforms without requestPermission skip straight to granted', async () => {
    const shell = createOrientationShell({
      win: fakeWin(),
      requestOrientation: null, // Android path
      requestMotion: null,
    });
    const res = await shell.requestPermissions();
    expect(res).toEqual({ orientation: 'granted', motion: 'granted' });
  });
});

describe('POS-2 heading extraction', () => {
  it('prefers absolute alpha on Android (deviceorientationabsolute, absolute:true)', () => {
    const win = fakeWin();
    const shell = createOrientationShell({ win });
    const headings = [];
    shell.headings.subscribe((h) => headings.push(h));
    shell.start();
    win.emit('deviceorientationabsolute', { alpha: 100, absolute: true });
    expect(headings.at(-1).deg).toBeCloseTo(260, 3); // alpha is CCW → 360-100
    expect(headings.at(-1).confidence).toBe('absolute');
  });
  it('uses webkitCompassHeading on iOS (deviceorientation with the property)', () => {
    const win = fakeWin();
    const shell = createOrientationShell({ win });
    const headings = [];
    shell.headings.subscribe((h) => headings.push(h));
    shell.start();
    win.emit('deviceorientation', { webkitCompassHeading: 270 });
    expect(headings.at(-1).deg).toBe(270);
    expect(headings.at(-1).confidence).toBe('absolute');
  });
  it('falls back to relative alpha, flagged low-confidence (POS-2)', () => {
    const win = fakeWin();
    const shell = createOrientationShell({ win });
    const headings = [];
    shell.headings.subscribe((h) => headings.push(h));
    shell.start();
    win.emit('deviceorientation', { alpha: 45, absolute: false });
    expect(headings.at(-1).confidence).toBe('relative');
  });
  it('ignores absolute:false on the absolute event channel', () => {
    const win = fakeWin();
    const shell = createOrientationShell({ win });
    const headings = [];
    shell.headings.subscribe((h) => headings.push(h));
    shell.start();
    win.emit('deviceorientationabsolute', { alpha: 10, absolute: false });
    expect(headings.filter((h) => h).length).toBe(0);
  });
});
