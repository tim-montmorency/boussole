/**
 * Hash router (no dependency). Routes: #/plan (default), #/list,
 * #/repere/:id, #/carnet, #/settings. Query params preserved (?debug=1).
 */
import { observable } from './store/observable.js';

/** @param {string} hash e.g. "#/repere/r-1?debug=1" */
export function parseHash(hash) {
  const raw = hash.replace(/^#/, '') || '/';
  const [path, qs] = raw.split('?');
  /** @type {Record<string, string>} */
  const query = {};
  if (qs) for (const [k, v] of new URLSearchParams(qs)) query[k] = v;
  const seg = path.split('/').filter(Boolean);
  /** @param {string} name @param {Record<string, string>} [params] */
  const out = (name, params = {}) => Object.keys(query).length
    ? { name, params, query } : { name, params };
  if (seg.length === 0) return out('plan');
  if (seg[0] === 'repere' && seg[1]) return out('repere', { id: decodeURIComponent(seg[1]) });
  if (['list', 'carnet', 'settings', 'plan', 'ar'].includes(seg[0]) && seg.length === 1)
    return out(/** @type {'plan'|'list'|'carnet'|'settings'|'ar'} */ (seg[0]));
  return out('plan');
}

/** @param {string} name @param {Record<string, string>} [params] */
export function routeUrl(name, params = {}) {
  if (name === 'repere') return `#/repere/${encodeURIComponent(params.id)}`;
  return `#/${name === 'plan' ? '' : name}`;
}

/** @param {{ location: { hash: string }, addEventListener: (ev: string, fn: () => void) => void }} win */
export function createRouter(win) {
  const route = observable(parseHash(win.location.hash));
  win.addEventListener('hashchange', () => route.set(parseHash(win.location.hash)));
  return {
    route,
    /** @param {string} name @param {Record<string, string>} [params] */
    go(name, params) { win.location.hash = routeUrl(name, params); },
  };
}
