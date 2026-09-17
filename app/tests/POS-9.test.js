import { describe, it, expect } from 'vitest';
import { createFusion, nearestAncre } from '../src/lib/fusion/fuse.js';

const A = { lat: 45.5577, lon: -73.7157 };

// POS-9: GPS silence → estimated badge + ancre suggestion; DR allowed from manual pose.
describe('POS-9 GPS silence', () => {
  it('active GPS with no fix for 15 s → estimated pose', () => {
    let t = 0;
    const f = createFusion({ now: () => t });
    f.setGpsActive(true);
    f.handleFix({ kind: 'gps', ...A, accuracy: 8, t });
    expect(f.pose.value.estimated).toBe(false);
    t = 14_999;
    expect(f.pose.value.estimated).toBe(false);
    t = 15_001;
    expect(f.pose.value.estimated).toBe(true);
    expect(f.gpsSilentNow).toBe(true);
  });
  it('active GPS that NEVER delivered also flags after 15 s', () => {
    let t = 1000;
    const f = createFusion({ now: () => t });
    f.handleFix({ kind: 'manual', ...A, accuracy: 5, t });
    f.setGpsActive(true);
    t = 16_500;
    expect(f.gpsSilentNow).toBe(true);
  });
  it('inactive GPS never flags silence', () => {
    let t = 0;
    const f = createFusion({ now: () => t });
    f.handleFix({ kind: 'manual', ...A, accuracy: 5, t });
    t = 999_999;
    expect(f.gpsSilentNow).toBe(false);
  });
  it('a fresh GPS fix clears the flag', () => {
    let t = 0;
    const f = createFusion({ now: () => t });
    f.setGpsActive(true);
    f.handleFix({ kind: 'gps', ...A, accuracy: 8, t });
    t = 20_000;
    expect(f.gpsSilentNow).toBe(true);
    f.handleFix({ kind: 'gps', ...A, accuracy: 8, t });
    expect(f.gpsSilentNow).toBe(false);
    expect(f.pose.value.estimated).toBe(false);
  });
  it('nearestAncre picks the closest for the suggestion', () => {
    const ancres = [
      { id: 'far', lat: A.lat + 0.002, lon: A.lon },
      { id: 'near', lat: A.lat + 0.0002, lon: A.lon },
    ];
    expect(nearestAncre(ancres, A).ancre.id).toBe('near');
    expect(nearestAncre([], A)).toBeNull();
  });
});

// POS-4: accuracy gates the cadran arrow.
describe('POS-4 low-confidence gate', () => {
  it('accuracy > 15 m → lowConfidence (arrow dimmed)', () => {
    const f = createFusion({ now: () => 0 });
    f.handleFix({ kind: 'manual', ...A, accuracy: 16, t: 0 });
    expect(f.lowConfidence).toBe(true);
    f.handleFix({ kind: 'ancre', ...A, accuracy: 1, t: 1 });
    expect(f.lowConfidence).toBe(false);
  });
  it('no position at all → lowConfidence', () => {
    expect(createFusion({ now: () => 0 }).lowConfidence).toBe(true);
  });
});
