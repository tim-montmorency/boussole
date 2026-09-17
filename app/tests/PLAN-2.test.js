import { describe, it, expect } from 'vitest';
import { planMode } from '../src/lib/plan/rotation.js';

// PLAN-2: north-up default; heading-up only with a live, high-confidence
// heading; stale (>3 s) or disturbed (std > 25°) falls back to north-up.
describe('PLAN-2 plan rotation mode', () => {
  const live = { heading: 90, headingAgeMs: 100, disturbed: false, confidence: 'absolute' };
  it('north-up by default (no heading)', () => {
    expect(planMode({ userPrefersHeadingUp: true, heading: null })).toEqual(
      { mode: 'north-up', rotationDeg: 0, reason: 'no-heading' });
  });
  it('heading-up once orientation granted and live', () => {
    expect(planMode({ userPrefersHeadingUp: true, ...live })).toEqual(
      { mode: 'heading-up', rotationDeg: -90, reason: 'live' });
  });
  it('never heading-up with a stale heading (>3 s)', () => {
    expect(planMode({ userPrefersHeadingUp: true, ...live, headingAgeMs: 4000 }).reason)
      .toBe('stale');
  });
  it('never heading-up while magnetically disturbed (POS-5)', () => {
    expect(planMode({ userPrefersHeadingUp: true, ...live, disturbed: true }).reason)
      .toBe('disturbed');
  });
  it('never heading-up with relative (low-confidence) heading (POS-2)', () => {
    expect(planMode({ userPrefersHeadingUp: true, ...live, confidence: 'relative' }).reason)
      .toBe('low-confidence');
  });
  it('user toggle back to north-up is respected', () => {
    expect(planMode({ userPrefersHeadingUp: false, ...live }).mode).toBe('north-up');
  });
  it('rotation is -heading so the target stays up-screen', () => {
    expect(planMode({ userPrefersHeadingUp: true, ...live, heading: 270 }).rotationDeg).toBe(-270);
  });
});
