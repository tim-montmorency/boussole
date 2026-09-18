/**
 * QR ancre scanning (AR-6): BarcodeDetector when the platform has it, else the
 * vendored jsQR on downscaled frames. Throttled (PERF-2) with an idle stop.
 * Pure pipeline — the AR component feeds it frames from the video.
 */
import { jsQR } from '../vendor/jsQR.esm.js';

/**
 * Extract an ancre id from a QR payload (bare `?ancre=x` or full URL).
 * @param {string} text
 */
export function ancreFromPayload(text) {
  if (typeof text !== 'string') return null;
  const m = text.match(/[?&]ancre=([a-z0-9-]+)/i);
  return m ? { type: 'ancre', id: m[1] } : null;
}

/**
 * @param {{ barcodeDetector?: { detect: (frame: any) => Promise<any[]> } | null,
 *   intervalMs?: number, idleStopMs?: number }} deps
 */
export function createQrScanner({ barcodeDetector = null, intervalMs = 200, idleStopMs = 30_000 } = {}) {
  let lastScanT = -Infinity;
  let lastHitT = 0;
  let running = true;

  /** @returns {Promise<{ type: string, id: string } | null>}
   * @param {{ data: Uint8ClampedArray, width: number, height: number }} frame */
  async function decode(frame) {
    if (barcodeDetector) {
      const codes = await barcodeDetector.detect(frame);
      return codes.length ? ancreFromPayload(codes[0].rawValue) : null;
    }
    const found = jsQR(frame.data, frame.width, frame.height);
    return found?.data ? ancreFromPayload(found.data) : null;
  }

  return {
    /** Direct one-shot decode (tests, BarcodeDetector path). */
    scanFrame: decode,
    /**
     * Throttled scan: at most one decode per `intervalMs`; stops after
     * `idleStopMs` without a hit (PERF-2). Returns the hit or null.
     * @param {any} frame @param {number} t ms
     */
    async tick(frame, t) {
      if (!running) return null;
      if (t - lastHitT > idleStopMs) { running = false; return null; }
      if (t - lastScanT < intervalMs) return null;
      lastScanT = t;
      const hit = await decode(frame);
      if (hit) lastHitT = t;
      return hit;
    },
    get running() { return running; },
    restart() { running = true; lastHitT = 0; lastScanT = -Infinity; },
  };
}
