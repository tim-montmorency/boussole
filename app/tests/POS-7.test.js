import { describe, it, expect } from 'vitest';
import { createRegistry } from '../src/lib/fusion/registry.js';

// POS-7: PositionSource contract + registry behaviour (ARCH-2).
const mkSource = (id, priority, supported = true) => ({
  id, label: id, priority,
  supported: async () => supported,
  start() { this.started = true; },
  stop() {},
  subscribe() { return () => {}; },
});

describe('POS-7 source registry', () => {
  it('sorts sources by priority, highest first', async () => {
    const r = createRegistry();
    r.add(mkSource('gps', 10));
    r.add(mkSource('sim', 1000));
    r.add(mkSource('manual', 50));
    expect((await r.live()).map((s) => s.id)).toEqual(['sim', 'manual', 'gps']);
  });
  it('unsupported sources are absent from live() and never started', async () => {
    const r = createRegistry();
    const no = mkSource('ble', 500, false);
    r.add(no);
    const live = await r.live();
    expect(live.find((s) => s.id === 'ble')).toBeUndefined();
    expect(no.started).toBeUndefined();
  });
  it('a throwing supported() counts as unsupported', async () => {
    const r = createRegistry();
    r.add({ ...mkSource('boom', 1), supported: async () => { throw new Error('x'); } });
    expect(await r.live()).toEqual([]);
  });
  it('supports hot add/remove', async () => {
    const r = createRegistry();
    const off = r.add(mkSource('gps', 10));
    expect((await r.live()).length).toBe(1);
    off();
    expect((await r.live()).length).toBe(0);
  });
});
