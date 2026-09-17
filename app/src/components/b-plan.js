/**
 * <b-plan> — T0/T1 map: canvas with pan/zoom (PLAN-1..3, north-up at this phase),
 * repère markers, tap-to-set manual position (T1), visitor dot + accuracy circle.
 * List alternative for the canvas lives in <b-list> (A11Y-3).
 */
import { BElement, esc } from './base.js';
import { createViewport } from '../lib/plan/viewport.js';
import { pickLocalized } from '../lib/content/localize.js';

export class BPlan extends BElement {
  connectedCallback() {
    this.track(this.ctx.pose);
    this.track(this.ctx.carnet);
    this.render();
  }
  render() {
    const { t } = this.ctx.i18n;
    this.html(`
      <section class="plan-wrap">
        <canvas aria-hidden="true"></canvas>
        <p class="hint">${t('plan.setPosition')}</p>
        <p class="pos-label">${this.posLabel()}</p>
      </section>`);
    this.setupCanvas(/** @type {HTMLCanvasElement} */ (this.querySelector('canvas')));
  }
  posLabel() {
    const { t } = this.ctx.i18n;
    const p = this.ctx.pose.value;
    if (!p) return '';
    return p.source === 'manual' ? t('pos.manual') : p.estimated ? t('pos.estimated') : '';
  }
  /** @param {HTMLCanvasElement} canvas */
  setupCanvas(canvas) {
    const { bundle, geoRef } = this.ctx;
    const rect = this.getBoundingClientRect();
    const dpr = globalThis.devicePixelRatio || 1;
    canvas.width = rect.width * dpr; canvas.height = rect.height * dpr;
    canvas.style.width = `${rect.width}px`; canvas.style.height = `${rect.height}px`;
    const vp = createViewport({ worldW: bundle.plan.width, worldH: bundle.plan.height,
      screenW: rect.width, screenH: rect.height });
    const g = canvas.getContext('2d');

    const draw = () => {
      if (!g) return;
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      g.clearRect(0, 0, rect.width, rect.height);
      // plan placeholder grid (image loads async; PLAN-1 raster lands in Phase 5)
      g.save();
      g.transform(1, 0, 0, 1, 0, 0);
      const tl = vp.toScreen(0, 0), br = vp.toScreen(bundle.plan.width, bundle.plan.height);
      g.fillStyle = '#1b232c'; g.fillRect(tl.x, tl.y, br.x - tl.x, br.y - tl.y);
      g.strokeStyle = '#2c3947';
      for (let x = 0; x <= bundle.plan.width; x += 256) {
        const a = vp.toScreen(x, 0), b = vp.toScreen(x, bundle.plan.height);
        g.beginPath(); g.moveTo(a.x, a.y); g.lineTo(b.x, b.y); g.stroke();
      }
      for (let y = 0; y <= bundle.plan.height; y += 256) {
        const a = vp.toScreen(0, y), b = vp.toScreen(bundle.plan.width, y);
        g.beginPath(); g.moveTo(a.x, a.y); g.lineTo(b.x, b.y); g.stroke();
      }
      // repère markers (discovered = filled)
      const encountered = this.ctx.carnet.value?.encountered ?? {};
      for (const r of bundle.reperes) {
        const ll = geoRef.inverse(r.lat, r.lon);
        const s = vp.toScreen(ll.px, ll.py);
        g.beginPath(); g.arc(s.x, s.y, 10, 0, Math.PI * 2);
        g.fillStyle = encountered[r.id] ? '#57d98e' : '#e8b93e';
        g.fill();
        g.fillStyle = '#e8ecf0'; g.font = '13px system-ui';
        g.fillText(pickLocalized(r.name, this.ctx.i18n.lang.value), s.x + 14, s.y + 4);
      }
      // visitor dot + accuracy circle (PLAN-3)
      const p = this.ctx.pose.value;
      if (p) {
        const ll = geoRef.inverse(p.lat, p.lon);
        const s = vp.toScreen(ll.px, ll.py);
        const accPx = p.accuracy / this.ctx.mPerPx;
        g.beginPath(); g.arc(s.x, s.y, Math.max(8, accPx * vp.scale), 0, Math.PI * 2);
        g.fillStyle = 'rgba(88,160,255,.18)'; g.fill();
        g.beginPath(); g.arc(s.x, s.y, 7, 0, Math.PI * 2);
        g.fillStyle = '#58a0ff'; g.fill();
      }
      g.restore();
    };
    draw();
    this._offs.push(this.ctx.pose.subscribe(draw));

    // pan/zoom wiring (pointer events; pinch = two-pointer distance ratio)
    /** @type {Map<number, { x: number, y: number }>} */ const pts = new Map();
    let pinchDist = 0;
    let downAt = 0, moved = false;
    canvas.addEventListener('pointerdown', (e) => {
      canvas.setPointerCapture(e.pointerId);
      pts.set(e.pointerId, { x: e.offsetX, y: e.offsetY });
      downAt = e.timeStamp; moved = false;
      if (pts.size === 2) pinchDist = dist(pts);
    });
    canvas.addEventListener('pointermove', (e) => {
      if (!pts.has(e.pointerId)) return;
      const prev = pts.get(e.pointerId);
      pts.set(e.pointerId, { x: e.offsetX, y: e.offsetY });
      if (pts.size === 1 && prev) {
        vp.panBy(e.offsetX - prev.x, e.offsetY - prev.y);
        moved = true; draw();
      } else if (pts.size === 2) {
        const d = dist(pts);
        const c = centre(pts);
        if (pinchDist > 0) vp.zoomAt(c.x, c.y, d / pinchDist);
        pinchDist = d; moved = true; draw();
      }
    });
    canvas.addEventListener('pointerup', (e) => {
      pts.delete(e.pointerId); pinchDist = 0;
      // T1: a quick tap without movement sets the manual position
      if (!moved && e.timeStamp - downAt < 400) {
        const w = vp.toWorld(e.offsetX, e.offsetY);
        const ll = geoRef.forward(w.x, w.y);
        this.ctx.setManualPose(ll);
      }
    });
  }
}
/** @param {Map<number, { x: number, y: number }>} pts */
function dist(pts) { const [a, b] = [...pts.values()]; return Math.hypot(a.x - b.x, a.y - b.y); }
/** @param {Map<number, { x: number, y: number }>} pts */
function centre(pts) { const [a, b] = [...pts.values()]; return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }; }
customElements.define('b-plan', BPlan);
