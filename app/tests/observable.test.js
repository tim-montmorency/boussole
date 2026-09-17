import { describe, it, expect } from 'vitest';
import { observable } from '../src/lib/store/observable.js';

describe('observable store', () => {
  it('emits current value on subscribe', () => {
    const o = observable(1);
    const seen = [];
    o.subscribe((v) => seen.push(v));
    expect(seen).toEqual([1]);
  });
  it('dispatches synchronously in subscription order', () => {
    const o = observable(0);
    const order = [];
    o.subscribe(() => order.push('a'));
    o.subscribe(() => order.push('b'));
    o.set(5);
    expect(order).toEqual(['a', 'b', 'a', 'b']);
  });
  it('stops emitting after unsubscribe', () => {
    const o = observable(0);
    const seen = [];
    const off = o.subscribe((v) => seen.push(v));
    o.set(1); off(); o.set(2);
    expect(seen).toEqual([0, 1]);
  });
  it('exposes current value via .value', () => {
    const o = observable('x');
    o.set('y');
    expect(o.value).toBe('y');
  });
});
