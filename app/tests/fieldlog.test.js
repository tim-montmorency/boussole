import { describe, it, expect } from 'vitest';
import { collectFieldLog, formatFieldLog } from '../src/lib/debug/fieldlog.js';

// Field log: everything needed to debug a real-phone session from a paste.
describe('debug field log', () => {
  const fake = {
    ua: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)',
    bundle: { id: 'example', name: 'Venue exemple' },
    pose: { lat: 45.56008, lon: -73.71876, heading: 91.4, accuracy: 6, source: 'gps', t: 1000, estimated: false },
    perms: { geo: 'granted', orientation: 'granted', camera: 'denied' },
    tier: 'T2',
    audioUnlocked: true,
    carnet: { encountered: { 'r-studios': { at: '2026-09-17T12:00:00Z', method: 'arrivee' } } },
    extra: { hfov: 65, online: false },
  };
  it('collects device, bundle, pose, perms, tier, carnet into one record', () => {
    const log = collectFieldLog(fake);
    expect(log.userAgent).toBe(fake.ua);
    expect(log.venue).toBe('example');
    expect(log.pose.lat).toBeCloseTo(45.56008);
    expect(log.tier).toBe('T2');
    expect(log.carnet.encountered['r-studios'].method).toBe('arrivee');
    expect(log.extra.online).toBe(false);
  });
  it('formats as copy-pasteable text (json fenced block)', () => {
    const out = formatFieldLog(collectFieldLog(fake));
    expect(out).toContain('```json');
    expect(out).toContain('"tier": "T2"');
    expect(JSON.parse(out.match(/```json\n([\s\S]*?)```/)[1]).venue).toBe('example');
  });
  it('tolerates missing pose/carnet (T0 session)', () => {
    const log = collectFieldLog({ ...fake, pose: null, carnet: null });
    expect(log.pose).toBeNull();
    expect(() => formatFieldLog(log)).not.toThrow();
  });
});
