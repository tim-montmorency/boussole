/**
 * Debug session (DEMO-3): a SimPositionSource wired into fusion, plus the
 * readout panel data. Pure orchestration — the DOM panel is a component.
 */
import { createSimSource, createTracePlayer } from '../fusion/sim.js';

/**
 * @param {ReturnType<import('../fusion/fuse.js').createFusion>} fusion
 * @param {{ now?: () => number }} [opts]
 */
export function createDebugSession(fusion, { now = () => Date.now() } = {}) {
  /** @type {ReturnType<typeof createSimSource> | null} */ let sim = null;
  /** @type {ReturnType<typeof createTracePlayer> | null} */ let player = null;
  /** @type {number} */ let traceSpeed = 1;
  /** @type {Record<string, any>} */ const lastFixBySource = {};

  /** @param {{ lat: number, lon: number, heading?: number, accuracy?: number }} p */
  function applyPose(p) {
    if (!sim) {
      sim = createSimSource({ ...p, now });
      sim.subscribe((fix) => { lastFixBySource.sim = fix; fusion.handleFix(fix); });
      sim.subscribeHeading((deg) => fusion.handleHeading(deg, now()));
    }
    sim.setPose(p);
    sim.start();
  }

  /** @param {string} text @param {number} [speed] */
  function playTrace(text, speed = 1) {
    traceSpeed = speed;
    player = createTracePlayer(text, {
      onFix: (fix) => { lastFixBySource[fix.kind] = fix; fusion.handleFix(fix); },
      onHeading: (deg) => fusion.handleHeading(deg, now()),
    });
  }

  return {
    applyPose,
    /** @param {number} [m] */
    step(m) { sim?.step(m); },
    /** @param {number} [deg] */
    rotate(deg) { sim?.rotate(deg); },
    /** @param {{ lat: number, lon: number }} target */
    walkTo(target) { sim?.walkTo(target); },
    /** Fast-forward to the target with NO per-step fusion emissions (UI-safe
     * self-test): jumps the sim, then emits one final fix + heading.
     * @param {{ lat: number, lon: number }} target */
    walkToEnd(target) {
      if (!sim) return null;
      sim.walkTo(target);
      return sim.walkToEnd();
    },
    /** Advance sim walking + trace playback by dtMs of wall time.
     * @param {number} dtMs */
    tick(dtMs) {
      player?.advance(dtMs, traceSpeed);
      return sim?.tick(dtMs) ?? null;
    },
    playTrace,
    traceDone: () => player?.done ?? true,
    /** Readout panel data (DEMO-3).
     * @param {{ planMode?: string, perms?: Record<string,string>, audioUnlocked?: boolean }} [s] */
    readout({ planMode, perms, audioUnlocked } = {}) {
      return {
        pose: fusion.pose.value,
        sources: { ...lastFixBySource },
        planMode: planMode ?? 'north-up',
        perms: perms ?? {},
        audioUnlocked: audioUnlocked ?? false,
        lowConfidence: fusion.lowConfidence,
        headingDisturbed: fusion.headingDisturbed,
      };
    },
  };
}
