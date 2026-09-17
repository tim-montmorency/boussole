/**
 * Ambiance engine (AMB-1..5): a pure reducer over pose + heading + time.
 * No DOM, no audio — it outputs *what should be playing*, and the presentation
 * layer (Phase 4) turns that into media elements.
 *
 * update(input) → { active, audio, events }
 * - active: tableaux currently on, each with intensity (approche ramps 0→1)
 * - audio: { current, fadingOut } — one `son` at a time, 1.5 s crossfade (AMB-4)
 * - events: carnet encounters to record (AMB-5)
 */
import { haversineM, bearingDeg } from '../geometry/geo.js';
import { angDiffDeg } from '../geometry/circular.js';

const REGARD_WINDOW_DEG = 15; // AMB-2
const CROSSFADE_MS = 1500;    // AMB-4

/** Ray-casting point-in-polygon; zone vertices are [lat, lon].
 * @param {import('../types.js').LatLon} p @param {[number, number][]} zone */
export function pointInZone(p, zone) {
  let inside = false;
  for (let i = 0, j = zone.length - 1; i < zone.length; j = i++) {
    const [latI, lonI] = zone[i], [latJ, lonJ] = zone[j];
    if (((lonI > p.lon) !== (lonJ > p.lon))
      && p.lat < ((latJ - latI) * (p.lon - lonI)) / (lonJ - lonI) + latI) inside = !inside;
  }
  return inside;
}

/**
 * @param {{ defaults?: Record<string, any>, reperes?: import('../types.js').Repere[] }} bundle
 */
export function createAmbianceEngine(bundle) {
  const defaults = { captureRadius: 4, revealRadius: 25, arRange: 60, ...bundle.defaults };
  /** @type {Map<string, boolean>} repereId → was inside captureRadius */
  const inside = new Map();
  /** @type {{ key: string, since: number } | null} */ let currentSon = null;
  /** @type {{ key: string, until: number } | null} */ let fadingSon = null;

  /**
   * @param {{ pose: import('../types.js').Pose | null, now: number }} input
   * @returns {{ active: any[], audio: { current: string|null, fadingOut: string|null },
   *   events: any[] }}
   */
  function update({ pose, now }) {
    /** @type {any[]} */ const active = [];
    /** @type {any[]} */ const events = [];
    if (!pose) return { active, audio: audioState(now), events };

    for (const r of bundle.reperes ?? []) {
      const d = haversineM(pose, r);
      const captureR = r.captureRadius ?? defaults.captureRadius;
      const revealR = r.revealRadius ?? defaults.revealRadius;
      const wasInside = inside.get(r.id) === true;
      const isInside = d <= captureR;
      if (isInside && !wasInside) {
        // arrivée trigger fires once per entry; carnet records it (AMB-5)
        events.push({ type: 'encounter', repereId: r.id, method: 'arrivee', at: new Date(now).toISOString() });
      }
      inside.set(r.id, isInside);

      for (const [i, t] of (r.tableaux ?? []).entries()) {
        const key = `${r.id}#${i}`;
        let intensity = 0;
        if (t.trigger === 'approche' && d <= revealR) intensity = 1 - d / revealR;
        else if (t.trigger === 'arrivee' && isInside) intensity = 1;
        else if (t.trigger === 'regard' && pose.heading != null && d <= defaults.arRange) {
          const delta = Math.abs(angDiffDeg(pose.heading, bearingDeg(pose, r)));
          if (delta <= REGARD_WINDOW_DEG) intensity = 1 - delta / REGARD_WINDOW_DEG;
        } else if (t.trigger === 'zone' && t.zone && pointInZone(pose, t.zone)) intensity = 1;
        if (intensity > 0) active.push({ key, repereId: r.id, tableau: t, intensity, distanceM: d });
      }
    }

    // AMB-4: one `son` at a time — highest intensity wins; 1.5 s crossfade.
    const sons = active.filter((a) => a.tableau.kind === 'son')
      .sort((a, b) => b.intensity - a.intensity);
    const want = sons[0]?.key ?? null;
    if (want !== currentSon?.key) {
      if (currentSon) fadingSon = { key: currentSon.key, until: now + CROSSFADE_MS };
      currentSon = want ? { key: want, since: now } : null;
    }
    return { active, audio: audioState(now), events };
  }

  /** @param {number} now */
  function audioState(now) {
    if (fadingSon && now >= fadingSon.until) fadingSon = null;
    return { current: currentSon?.key ?? null, fadingOut: fadingSon?.key ?? null };
  }

  /**
   * Manual "Je suis là" (AMB-5): flagged unverified when accuracy is poor.
   * @param {string} repereId @param {number} accuracy @param {number} now
   * @returns carnet encounter event
   */
  function manualCheckin(repereId, accuracy, now) {
    return {
      type: 'encounter', repereId, method: 'manual',
      verified: accuracy <= 15, at: new Date(now).toISOString(),
    };
  }

  return { update, manualCheckin };
}
