/**
 * Audio shell (PERM-7/8): the AudioContext is created lazily inside the
 * "Me guider" gesture; unlock = resume() + a one-sample silent buffer (the
 * autoplay grant). Any later tap re-unlocks if the browser forgot (reload).
 */
import { observable } from '../store/observable.js';

/** @param {{ makeContext: () => any }} deps */
export function createAudioShell({ makeContext }) {
  /** @type {any} */ let ctx = null;
  const unlocked$ = observable(false);

  /** Called from a user gesture. @returns {Promise<boolean>} unlocked */
  async function unlock() {
    if (!ctx) ctx = makeContext();
    if (ctx.state === 'running') { unlocked$.set(true); return true; }
    try {
      await ctx.resume();
      // silent one-sample buffer — the classic autoplay unlock
      const src = ctx.createBufferSource();
      src.buffer = ctx.createBuffer(1, 1, 22050);
      src.connect(ctx.destination);
      src.start(0);
      unlocked$.set(ctx.state === 'running');
      return unlocked$.value;
    } catch {
      return false;
    }
  }

  return {
    unlock,
    get unlocked() { return unlocked$.value; },
    unlocked$,
    get context() { return ctx?.state === 'running' ? ctx : null; },
  };
}
