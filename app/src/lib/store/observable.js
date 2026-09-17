/**
 * Tiny observable store (Svelte-readable-shaped contract).
 * subscribe(fn) calls fn immediately with the current value and returns an unsubscribe fn.
 * @template T
 * @param {T} initial
 */
export function observable(initial) {
  /** @type {T} */ let value = initial;
  /** @type {Set<(v: T) => void>} */ const subs = new Set();
  return {
    get value() { return value; },
    /** @param {T} v */
    set(v) { value = v; for (const fn of [...subs]) fn(v); },
    /** @param {(v: T) => void} fn @returns {() => void} unsubscribe */
    subscribe(fn) { subs.add(fn); fn(value); return () => { subs.delete(fn); }; },
  };
}
