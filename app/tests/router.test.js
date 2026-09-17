import { describe, it, expect } from 'vitest';
import { parseHash, routeUrl, createRouter } from '../src/lib/router.js';

// Hash routing (plan Phase 3.1): no dependency, ~40 lines of parsing.
describe('hash router', () => {
  it('parses the empty hash as the plan view', () => {
    expect(parseHash('')).toEqual({ name: 'plan', params: {} });
    expect(parseHash('#/')).toEqual({ name: 'plan', params: {} });
  });
  it('parses static routes', () => {
    expect(parseHash('#/list')).toEqual({ name: 'list', params: {} });
    expect(parseHash('#/carnet')).toEqual({ name: 'carnet', params: {} });
    expect(parseHash('#/settings')).toEqual({ name: 'settings', params: {} });
  });
  it('parses the repère detail route with its id', () => {
    expect(parseHash('#/repere/r-atrium')).toEqual({ name: 'repere', params: { id: 'r-atrium' } });
  });
  it('preserves query params (debug flag, venue url)', () => {
    expect(parseHash('#/plan?debug=1')).toEqual({ name: 'plan', params: {}, query: { debug: '1' } });
  });
  it('unknown routes fall back to plan', () => {
    expect(parseHash('#/nope').name).toBe('plan');
  });
  it('routeUrl round-trips through parseHash', () => {
    expect(parseHash(routeUrl('repere', { id: 'r-1' }))).toMatchObject({ name: 'repere', params: { id: 'r-1' } });
  });
  it('createRouter notifies on hash change and exposes current route', () => {
    const listeners = new Map();
    const fakeWindow = {
      location: { hash: '#/plan' },
      addEventListener: (ev, fn) => listeners.set(ev, fn),
    };
    const r = createRouter(fakeWindow);
    const seen = [];
    r.route.subscribe((rt) => seen.push(rt.name));
    fakeWindow.location.hash = '#/list';
    listeners.get('hashchange')();
    expect(seen).toEqual(['plan', 'list']);
  });
});
