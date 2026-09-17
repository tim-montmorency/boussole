/**
 * <b-ar> — AR camera layer (AR-1..8): video behind, canvas overlay at DPR,
 * markers from projectMarker(), edge chevrons, tap-to-capture (AR-5), wake
 * lock (AR-8), PERF-1/2 frame caps. Camera stream via the PERM-3 shell.
 */
import { BElement, esc } from './base.js';
import { arMarkers } from '../lib/ar/project.js';
import { pickLocalized } from '../lib/content/localize.js';

const HFov_KEY = 'boussole:hfov';

export class BAr extends BElement {
  connectedCallback() {
    if (!this.ctx) return;
    this.render();
    this._start();
  }
  disconnectedCallback() {
    cancelAnimationFrame(/** @type {number} */ (this._raf));
    this.ctx.sensors?.camera?.stop?.();
    this.ctx.sensors?.wakelock?.release?.();
    super.disconnectedCallback();
  }
  async _start() {
    await this.ctx.sensors?.wakelock?.acquire?.(); // AR-8
    const stream = await this.ctx.camera?.start(); // PERM-3
    const video = /** @type {HTMLVideoElement} */ (this.querySelector('video'));
    if (stream && video) { video.srcObject = stream; video.play().catch(() => {}); }
    this._drawLoop();
  }
  render() {
    if (!this.ctx) return;
    const { t } = this.ctx.i18n;
    this.html(`
      <section class="ar-wrap">
        <video playsinline muted aria-hidden="true"></video>
        <canvas></canvas>
        <p class="ar-hint">${t('ar.cta')}</p>
      </section>`);
  }
  _drawLoop() {
    const canvas = /** @type {HTMLCanvasElement} */ (this.querySelector('canvas'));
    const g = canvas?.getContext('2d');
    if (!canvas || !g) return;
    const dpr = globalThis.devicePixelRatio || 1;
    const rect = this.getBoundingClientRect();
    canvas.width = rect.width * dpr; canvas.height = rect.height * dpr;

    let lastKey = '';
    const draw = () => {
      this._raf = requestAnimationFrame(draw);
      const pose = this.ctx.pose.value;
      if (!pose) return;
      // PERF-1: skip frames when pose/intrinsics unchanged
      const key = `${pose.lat.toFixed(7)},${pose.lon.toFixed(7)},${pose.heading?.toFixed(1)}`;
      if (key === lastKey) return;
      lastKey = key;

      const hFov = Number(localStorage.getItem(HFov_KEY)) || 65; // AR-2 calibrated or default
      const view = { w: rect.width, h: rect.height, hFov, pitchDeg: 0,
        arRange: this.ctx.bundle?.defaults?.arRange ?? 60,
        captureRadius: this.ctx.bundle?.defaults?.captureRadius ?? 4 };
      const markers = arMarkers(pose, this.ctx.bundle?.reperes ?? [], view);

      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      g.clearRect(0, 0, rect.width, rect.height);
      for (const m of markers) {
        const name = esc(pickLocalized(
          this.ctx.bundle.reperes.find((/** @type {any} */ r) => r.id === m.id)?.name,
          this.ctx.i18n.lang.value));
        if (m.chevron) {
          g.fillStyle = `rgba(232,185,62,${m.opacity})`;
          g.font = '28px system-ui';
          g.fillText(m.chevron === 'left' ? '‹' : '›', m.x - 10, m.y);
          continue;
        }
        g.globalAlpha = m.opacity;
        g.beginPath(); g.arc(m.x, m.y, m.size / 2, 0, Math.PI * 2);
        g.fillStyle = m.tappable ? '#57d98e' : '#e8b93e';
        g.fill();
        g.fillStyle = '#e8ecf0'; g.font = '13px system-ui'; g.textAlign = 'center';
        g.fillText(`${name} · ${m.distanceM.toFixed(0)} m`, m.x, m.y + m.size / 2 + 16);
        g.globalAlpha = 1;
      }
      this._markers = markers;
    };
    draw();

    // AR-5: tap-to-capture
    canvas.addEventListener('click', (e) => {
      const m = (this._markers ?? []).find((mk) => mk.tappable
        && Math.hypot(mk.x - e.offsetX, mk.y - e.offsetY) < mk.size);
      if (m) this.ctx.checkin(m.id);
    });
  }
}
customElements.define('b-ar', BAr);
