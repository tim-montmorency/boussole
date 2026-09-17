/**
 * SimPositionSource (POS-8, DEMO-3): a first-class PositionSource for debug.
 * Deterministic and clock-injected — tests drive time explicitly.
 *
 * - joystick step: 0.5 m along current heading (configurable)
 * - rotate: 5° per step
 * - walkTo(target): advances at 1.2 m/s per tick(dtMs)
 * - trace playback: .jsonl lines { t, source, payload } replayed at 1×/4×
 */
import { enuFrame } from '../geometry/geo.js';

/**
 * @param {{ lat: number, lon: number, heading?: number, accuracy?: number,
 *   strideM?: number, now?: () => number }} opts
 */
export function createSimSource({
  lat, lon, heading = 0, accuracy = 1, strideM = 0.5, now = () => Date.now(),
}) {
  /** @type {Set<(fix: any) => void>} */ const subs = new Set();
  /** @type {Set<(deg: number) => void>} */ const hsubs = new Set();
  /** @type {{ target: import('../types.js').LatLon, speedMps: number } | null} */
  let walking = null;
  const emitFix = () => {
    const fix = { kind: 'sim', lat, lon, accuracy, t: now() };
    for (const fn of [...subs]) fn(fix);
  };
  const emitHeading = () => { for (const fn of [...hsubs]) fn(heading); };

  const source = {
    id: 'sim', label: 'Simulation', priority: 1000, // outranks live sensors when on
    supported: async () => true,
    start() { emitFix(); emitHeading(); },
    stop() {},
    /** @param {(fix: any) => void} fn */
    subscribe(fn) { subs.add(fn); return () => subs.delete(fn); },
    /** @param {(deg: number) => void} fn */
    subscribeHeading(fn) { hsubs.add(fn); return () => hsubs.delete(fn); },

    /** Joystick: one step along heading (default 0.5 m). */
    step(m = strideM) {
      const f = enuFrame({ lat, lon });
      const v = f.toENU({ lat, lon });
      const rad = heading * Math.PI / 180;
      const p = f.fromENU({ e: v.e + Math.sin(rad) * m, n: v.n + Math.cos(rad) * m });
      lat = p.lat; lon = p.lon;
      emitFix();
    },
    /** Rotate heading (default 5° per step). */
    rotate(deg = 5) { heading = ((heading + deg) % 360 + 360) % 360; emitHeading(); },
    /** Teleport (debug panel "apply").
     * @param {{ lat: number, lon: number, heading?: number, accuracy?: number }} p */
    setPose(p) { ({ lat, lon } = p); if (p.heading != null) heading = p.heading;
      if (p.accuracy != null) accuracy = p.accuracy; emitFix(); emitHeading(); },
    /** Start interpolating toward a target at `speedMps` (default 1.2).
     * @param {import('../types.js').LatLon} target @param {number} [speedMps] */
    walkTo(target, speedMps = 1.2) { walking = { target, speedMps }; },
    stopWalking() { walking = null; },
    /** Advance simulation time; moves toward the walk target. Returns remaining metres.
     * @param {number} dtMs */
    tick(dtMs) {
      if (!walking) return null;
      const { target, speedMps } = walking;
      const f = enuFrame({ lat, lon });
      const v = f.toENU({ lat, lon });
      const tv = f.toENU(target);
      const dx = tv.e - v.e, dy = tv.n - v.n;
      const dist = Math.hypot(dx, dy);
      const step = speedMps * dtMs / 1000;
      if (dist <= step) {
        lat = target.lat; lon = target.lon; walking = null;
        emitFix(); return 0;
      }
      heading = (Math.atan2(dx, dy) * 180 / Math.PI + 360) % 360;
      const p = f.fromENU({ e: v.e + dx / dist * step, n: v.n + dy / dist * step });
      lat = p.lat; lon = p.lon;
      emitFix(); emitHeading();
      return dist - step;
    },
    get position() { return { lat, lon, heading, accuracy }; },
  };
  return source;
}

/**
 * Parse a .jsonl trace. First line may be { meta }. Events: { t, source, payload }.
 * @param {string} text
 */
export function parseTrace(text) {
  const events = [];
  let meta = null;
  for (const line of text.split('\n')) {
    const s = line.trim();
    if (!s) continue;
    const obj = JSON.parse(s);
    if (obj.meta) meta = obj.meta;
    else events.push(obj);
  }
  return { meta, events };
}

/**
 * Replay a trace into handlers — synchronous over an injected clock.
 * Timing is scaled but event ORDER and payload sequence are identical at any speed (DEMO-3).
 * @param {string | { meta: any, events: any[] }} trace
 * @param {{ onFix?: (fix: any) => void, onHeading?: (deg: number) => void }} handlers
 */
export function createTracePlayer(trace, { onFix, onHeading }) {
  const { events } = typeof trace === 'string' ? parseTrace(trace) : trace;
  let i = 0, clock = 0;
  return {
    get done() { return i >= events.length; },
    get clock() { return clock; },
    /** Advance the replay clock by dtMs *speed-adjusted* and flush due events.
     * @param {number} dtMs @param {number} [speed] */
    advance(dtMs, speed = 1) {
      clock += dtMs * speed;
      while (i < events.length && events[i].t <= clock) {
        const e = events[i++];
        if (e.source === 'orientation') onHeading?.(e.payload.heading);
        else onFix?.({ kind: e.source === 'gps' ? 'gps' : e.source,
          lat: e.payload.lat, lon: e.payload.lon,
          accuracy: e.payload.accuracy ?? 5, t: e.t });
      }
    },
    runAll(speed = 1) {
      while (!this.done) this.advance(100, speed);
    },
  };
}
