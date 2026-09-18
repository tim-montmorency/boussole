import { describe, it, expect } from 'vitest';
import { createQrScanner, ancreFromPayload } from '../src/lib/ar/scan.js';
import { create as qrCreate } from 'qrcode';

// AR-6: QR ancre scanning — BarcodeDetector when available, jsQR fallback.
// Test vector: a real QR matrix rendered to RGBA by the `qrcode` package.

/** Render a QR string to RGBA pixels (white bg, black modules). */
async function qrToPixels(text, scale = 4) {
  const m = await qrCreate(text, { errorCorrectionLevel: 'M' });
  const size = m.modules.size;
  const w = size * scale;
  const px = new Uint8ClampedArray(w * w * 4);
  for (let y = 0; y < w; y++) for (let x = 0; x < w; x++) {
    const dark = m.modules.data[Math.floor(y / scale) * size + Math.floor(x / scale)];
    const i = (y * w + x) * 4;
    px[i] = px[i + 1] = px[i + 2] = dark ? 0 : 255;
    px[i + 3] = 255;
  }
  return { data: px, width: w, height: w };
}

describe('AR-6 scan pipeline', () => {
  it('decodes an ancre QR via the jsQR fallback path', async () => {
    const frame = await qrToPixels('?ancre=a-agora');
    const scanner = createQrScanner({ barcodeDetector: null }); // force jsQR
    const hit = await scanner.scanFrame(frame);
    expect(hit).toEqual({ type: 'ancre', id: 'a-agora' });
  });
  it('prefers BarcodeDetector when the platform has it', async () => {
    const calls = [];
    const fakeBD = { detect: async () => { calls.push(1); return [{ rawValue: '?ancre=a-agora' }]; } };
    const scanner = createQrScanner({ barcodeDetector: fakeBD });
    const hit = await scanner.scanFrame({ data: new Uint8ClampedArray(4), width: 1, height: 1 });
    expect(calls).toHaveLength(1);
    expect(hit.id).toBe('a-agora');
  });
  it('returns null on a blank frame (no throw)', async () => {
    const frame = { data: new Uint8ClampedArray(64 * 64 * 4).fill(255), width: 64, height: 64 };
    const scanner = createQrScanner({ barcodeDetector: null });
    await expect(scanner.scanFrame(frame)).resolves.toBeNull();
  });
  it('ignores non-ancre payloads', async () => {
    const frame = await qrToPixels('https://example.com/whatever');
    const scanner = createQrScanner({ barcodeDetector: null });
    await expect(scanner.scanFrame(frame)).resolves.toBeNull();
  });
  it('PERF-2: throttles to one scan per interval and stops after 30 s idle', async () => {
    let decodes = 0;
    const fakeBD = { detect: async () => { decodes++; return []; } };
    const scanner = createQrScanner({ barcodeDetector: fakeBD, intervalMs: 200, idleStopMs: 1000 });
    const frame = { data: new Uint8ClampedArray(4), width: 1, height: 1 };
    let t = 0;
    // 5 ticks in the first second → ≤1 decode per 200 ms
    for (let i = 0; i < 5; i++) { await scanner.tick(frame, (t += 200)); }
    expect(decodes).toBe(5);
    // then silence past idleStopMs → scanner stops itself
    await scanner.tick(frame, (t += 5000));
    const before = decodes;
    await scanner.tick(frame, (t += 200));
    expect(decodes).toBe(before); // stopped
    expect(scanner.running).toBe(false);
  });
});

describe('ancreFromPayload', () => {
  it('parses ?ancre=<id> from a URL or bare query', () => {
    expect(ancreFromPayload('?ancre=a-agora')).toEqual({ type: 'ancre', id: 'a-agora' });
    expect(ancreFromPayload('https://x.local/app/?ancre=a-agora')).toEqual({ type: 'ancre', id: 'a-agora' });
  });
  it('rejects anything else', () => {
    expect(ancreFromPayload('hello')).toBeNull();
    expect(ancreFromPayload('?foo=bar')).toBeNull();
  });
});
