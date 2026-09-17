/**
 * Geolocation shell (PERM-4): wraps watchPosition with a visibility-aware
 * pause. Stops watching after 60 s hidden, resumes on visible. Browser APIs
 * are injected so the logic is Node-testable (ARCH-1).
 */
import { observable } from '../store/observable.js';

const HIDDEN_PAUSE_MS = 60_000;

/**
 * @param {{ geo: { watchPosition: Function, clearWatch: Function },
 *   doc: { hidden: boolean, addEventListener: (ev: string, fn: () => void) => void },
 *   now?: () => number }} deps
 */
export function createGeoShell({ geo, doc, now = () => Date.now() }) {
  /** @type {ReturnType<typeof observable<import('../types.js').Fix|null>>} */
  const fixes = observable(null);
  /** @type {number | null} */ let watchId = null;
  /** @type {number | null} */ let hiddenSince = null;
  let running = false;

  function beginWatch() {
    if (watchId != null) return;
    watchId = geo.watchPosition(
      (/** @type {any} */ p) => fixes.set({
        kind: 'gps', lat: p.coords.latitude, lon: p.coords.longitude,
        accuracy: p.coords.accuracy ?? 50, t: now(),
      }),
      () => {}, // denial handled by the permission layer, not here
      { enableHighAccuracy: true, maximumAge: 1000, timeout: 10_000 },
    );
  }
  function endWatch() {
    if (watchId == null) return;
    geo.clearWatch(watchId);
    watchId = null;
  }

  doc.addEventListener('visibilitychange', () => {
    if (doc.hidden) hiddenSince = now();
    else { hiddenSince = null; if (running) beginWatch(); }
  });

  return {
    fixes,
    start() { running = true; if (!doc.hidden) beginWatch(); },
    stop() { running = false; endWatch(); },
    /** Timer tick (driven by the app's heartbeat) — enforces the 60 s rule. */
    tick() {
      if (doc.hidden && hiddenSince != null && now() - hiddenSince > HIDDEN_PAUSE_MS) endWatch();
      else if (!doc.hidden && running) beginWatch();
    },
    get watching() { return watchId != null; },
  };
}
