import { describe, it, expect } from 'vitest';
import { createGeoShell } from '../src/lib/sensors/geo.js';

// PERM-4: watchPosition stops when hidden >60 s, resumes on visible.
// The shell takes injected APIs — no browser needed.

/** Fake geolocation: records watch/clear calls, emits on demand. */
function fakeGeo() {
  const calls = { watch: 0, clear: 0 };
  /** @type {((p: any) => void) | null} */ let onSuccess = null;
  return {
    calls,
    emit: (p) => onSuccess?.(p),
    api: {
      watchPosition(ok, _err, _opts) { calls.watch++; onSuccess = ok; return 1; },
      clearWatch() { calls.clear++; onSuccess = null; },
    },
  };
}
/** Fake document with controllable visibility. */
function fakeDoc() {
  let hidden = false;
  const listeners = [];
  return {
    get hidden() { return hidden; },
    setHidden(h) { hidden = h; listeners.forEach((f) => f()); },
    addEventListener: (_ev, f) => listeners.push(f),
  };
}

describe('PERM-4 geolocation visibility lifecycle', () => {
  it('starts watching on start() and forwards fixes', () => {
    const geo = fakeGeo(), doc = fakeDoc();
    const shell = createGeoShell({ geo: geo.api, doc, now: () => 0 });
    const fixes = [];
    shell.fixes.subscribe((f) => fixes.push(f));
    shell.start();
    expect(geo.calls.watch).toBe(1);
    geo.emit({ coords: { latitude: 45.5, longitude: -73.7, accuracy: 8 } });
    expect(fixes.at(-1)).toMatchObject({ lat: 45.5, accuracy: 8, kind: 'gps' });
  });
  it('stops the watch after 60 s hidden, not before', () => {
    let t = 0;
    const geo = fakeGeo(), doc = fakeDoc();
    const shell = createGeoShell({ geo: geo.api, doc, now: () => t });
    shell.start();
    doc.setHidden(true);
    shell.tick(); t = 30_000; shell.tick();
    expect(geo.calls.clear).toBe(0);
    t = 61_000; shell.tick();
    expect(geo.calls.clear).toBe(1);
  });
  it('resumes the watch on visibilitychange back to visible', () => {
    let t = 0;
    const geo = fakeGeo(), doc = fakeDoc();
    const shell = createGeoShell({ geo: geo.api, doc, now: () => t });
    shell.start();
    doc.setHidden(true); t = 61_000; shell.tick();
    expect(geo.calls.clear).toBe(1);
    doc.setHidden(false); shell.tick();
    expect(geo.calls.watch).toBe(2);
  });
  it('quick hide/show never stops the watch', () => {
    let t = 0;
    const geo = fakeGeo(), doc = fakeDoc();
    const shell = createGeoShell({ geo: geo.api, doc, now: () => t });
    shell.start();
    doc.setHidden(true); t = 10_000; shell.tick();
    doc.setHidden(false); t = 20_000; shell.tick();
    expect(geo.calls.clear).toBe(0);
    expect(geo.calls.watch).toBe(1);
  });
  it('stop() clears the watch', () => {
    const geo = fakeGeo(), doc = fakeDoc();
    const shell = createGeoShell({ geo: geo.api, doc, now: () => 0 });
    shell.start(); shell.stop();
    expect(geo.calls.clear).toBe(1);
  });
});
