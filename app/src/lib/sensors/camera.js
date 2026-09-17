/**
 * Camera shell (PERM-3): environment-facing video, no audio; tracks released
 * on stop or tab-hide. Injected getUserMedia/doc (ARCH-1).
 */
import { observable } from '../store/observable.js';

/** @param {{ getUserMedia: (c: any) => Promise<any>,
 *   doc: { hidden: boolean, addEventListener: (ev: string, fn: () => void) => void } }} deps */
export function createCameraShell({ getUserMedia, doc }) {
  const stream = observable(/** @type {any} */ (null));
  /** @type {any[]} */ let tracks = [];

  async function start() {
    try {
      const s = await getUserMedia({
        video: { facingMode: { ideal: 'environment' } }, audio: false,
      });
      tracks = s.getVideoTracks();
      stream.set(s);
      return s;
    } catch {
      stream.set(null); // denial path: clean stopped state, never throws to UI
      return null;
    }
  }
  function stop() {
    for (const t of tracks) t.stop();
    tracks = [];
    stream.set(null);
  }
  doc.addEventListener('visibilitychange', () => { if (doc.hidden) stop(); });

  return {
    /** @returns {Promise<any>} the MediaStream or null */
    start, stop,
    get stream() { return stream.value; },
    stream$: stream,
  };
}
