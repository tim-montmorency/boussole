/**
 * Orientation/motion shell (PERM-2, POS-2): iOS dual requestPermission chain
 * (one gesture), heading extraction with absolute > webkitCompassHeading >
 * relative-alpha fallback (low-confidence flag). Injected APIs (ARCH-1).
 */
import { observable } from '../store/observable.js';

/**
 * @param {{ win: { addEventListener: Function, removeEventListener?: Function },
 *   requestOrientation?: (() => Promise<string>) | null,
 *   requestMotion?: (() => Promise<string>) | null }} deps
 */
export function createOrientationShell({ win, requestOrientation = null, requestMotion = null }) {
  /** Headings: { deg, confidence: 'absolute'|'relative' } */
  const headings = observable(/** @type {{ deg: number, confidence: string } | null} */ (null));
  let motionOk = true;
  let listening = false;

  /** iOS: both prompts inside the same user gesture (PERM-2). */
  async function requestPermissions() {
    const orientation = requestOrientation ? await requestOrientation() : 'granted';
    const motion = requestMotion ? await requestMotion() : 'granted';
    motionOk = motion === 'granted'; // denied → DR source registers unsupported
    return { orientation, motion };
  }

  /** @param {any} e */
  function onAbsolute(e) {
    if (e.absolute !== true || e.alpha == null) return;
    headings.set({ deg: (360 - e.alpha) % 360, confidence: 'absolute' });
  }
  /** @param {any} e */
  function onOrientation(e) {
    if (typeof e.webkitCompassHeading === 'number') {
      headings.set({ deg: ((e.webkitCompassHeading % 360) + 360) % 360, confidence: 'absolute' });
    } else if (typeof e.alpha === 'number' && e.absolute !== true) {
      headings.set({ deg: (360 - e.alpha) % 360, confidence: 'relative' }); // POS-2 fallback
    }
  }

  return {
    headings,
    requestPermissions,
    get motionOk() { return motionOk; },
    start() {
      if (listening) return;
      listening = true;
      win.addEventListener('deviceorientationabsolute', onAbsolute);
      win.addEventListener('deviceorientation', onOrientation);
    },
    stop() {
      listening = false;
      win.removeEventListener?.('deviceorientationabsolute', onAbsolute);
      win.removeEventListener?.('deviceorientation', onOrientation);
    },
  };
}
