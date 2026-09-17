import { describe, it, expect } from 'vitest';
import { memoryStore } from '../src/lib/store/idb.js';
import { loadCarnet, saveCarnet, freshCarnet, shouldPersistPose } from '../src/lib/store/carnet.js';

// DATA-1: writes are a single put per key; one-deep prev backup; graceful fallback.
describe('DATA-1 carnet persistence', () => {
  it('returns a fresh versioned state for an unknown venue', async () => {
    const s = await loadCarnet(memoryStore(), 'v1');
    expect(s).toEqual(freshCarnet('v1'));
    expect(s.version).toBe(1);
  });
  it('round-trips state', async () => {
    const store = memoryStore();
    const s = freshCarnet('v1');
    s.encountered['r-atrium'] = { at: '2026-09-17T00:00:00Z', method: 'arrivee' };
    await saveCarnet(store, s);
    expect((await loadCarnet(store, 'v1')).encountered['r-atrium'].method).toBe('arrivee');
  });
  it('keeps the previous record one deep', async () => {
    const store = memoryStore();
    const a = freshCarnet('v1'); await saveCarnet(store, a);
    const b = { ...a, audioUnlocked: true }; await saveCarnet(store, b);
    expect((await store.get('state:v1:prev')).audioUnlocked).toBe(false);
    expect((await store.get('state:v1')).audioUnlocked).toBe(true);
  });
  it('falls back to prev when main is corrupt', async () => {
    const store = memoryStore();
    const a = freshCarnet('v1'); await saveCarnet(store, a);
    const b = { ...a, audioUnlocked: true }; await saveCarnet(store, b);
    await store.set('state:v1', '{corrupt');
    expect((await loadCarnet(store, 'v1')).audioUnlocked).toBe(false);
  });
  it('falls back to fresh state when both records are corrupt', async () => {
    const store = memoryStore();
    await store.set('state:v1', null);
    await store.set('state:v1:prev', 42);
    expect(await loadCarnet(store, 'v1')).toEqual(freshCarnet('v1'));
  });
  it('migrates a versionless (v0) record to v1', async () => {
    const store = memoryStore();
    const old = freshCarnet('v1'); delete /** @type {any} */ (old).version;
    await store.set('state:v1', old);
    expect((await loadCarnet(store, 'v1')).version).toBe(1);
  });
  it('never persists a sim-sourced pose (DEMO-3)', () => {
    const base = { lat: 45, lon: -73, heading: 0, accuracy: 1, t: 0 };
    expect(shouldPersistPose({ ...base, source: 'sim' })).toBe(false);
    expect(shouldPersistPose({ ...base, source: 'gps' })).toBe(true);
  });
});
