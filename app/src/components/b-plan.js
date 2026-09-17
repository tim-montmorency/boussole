/**
 * <b-plan> — T0/T1 map: canvas with pan/zoom (PLAN-1..3, north-up at this phase),
 * repère markers, tap-to-set manual position (T1), visitor dot + accuracy circle.
 * List alternative for the canvas lives in <b-list> (A11Y-3).
 */
import { BElement, esc } from './base.js';
import { createViewport } from '../lib/plan/viewport.js';
import { createBasemapRegistry, createLayerStack } from '../lib/plan/layers.js';
import { visibleTiles, tileRectInPlanPx } from '../lib/plan/draw.js';
import { zoomForSpan } from '../lib/plan/tiles.js';
import { pickLocalized } from '../lib/content/localize.js';
import { haversineM, bearingDeg } from '../lib/geometry/geo.js';
import { planMode } from '../lib/plan/rotation.js';
import './b-debug.js';
import './b-cadran.js';

export class BPlan extends BElement {
  connectedCallback() {
    this.track(this.ctx.pose);
    this.track(this.ctx.carnet);
    this.render();
  }
  render() {
    if (!this.ctx) return; // parsed before ctx assignment
    const { t } = this.ctx.i18n;
    this.html(`
      <section class="plan-wrap">
        <canvas aria-hidden="true"></canvas>
        <p class="hint">${t('plan.setPosition')}</p>
        <p class="pos-label">${this.posLabel()}</p>
        <p class="cadran-live sr-only" role="status">${this.cadranText()}</p>
        <div class="cadran-dock"><b-cadran></b-cadran></div>
        <button class="fab guide">${t('guide.cta')}</button>
        <button class="fab ar">${t('ar.cta')}</button>
        ${this.ctx.debugEnabled ? '<b-debug></b-debug>' : ''}
      </section>`);
    this.querySelector('.fab.guide')?.addEventListener('click', () => this.ctx.showGuide?.());
    this.querySelector('.fab.ar')?.addEventListener('click', () => this.ctx.showAr?.());
    const dbg = this.querySelector('b-debug');
    if (dbg && !/** @type {any} */ (dbg).ctx) {
      /** @type {any} */ (dbg).ctx = this.ctx;
      /** @type {any} */ (dbg)._start();
    }
    const cad = this.querySelector('b-cadran');
    if (cad && !/** @type {any} */ (cad).ctx) /** @type {any} */ (cad).ctx = this.ctx;
    this.setupCanvas(/** @type {HTMLCanvasElement} */ (this.querySelector('canvas')));
    // keep the live cadran text and position label fresh
    this._offs.push(this.ctx.pose.subscribe(() => {
      const live = this.querySelector('.cadran-live');
      if (live) live.textContent = this.cadranText();
      const lbl = this.querySelector('.pos-label');
      if (lbl) lbl.textContent = this.posLabel();
    }));
  }
  /** A11Y-3: the cadran's state as text, throttled by the live region. */
  cadranText() {
    const p = this.ctx.pose.value;
    const target = this.ctx.bundle?.reperes?.[0];
    if (!p || !target) return '';
    const { t } = this.ctx.i18n;
    return `${t('repere.distance', { d: Math.round(haversineM(p, target)) })} · ${t('repere.bearing', { b: Math.round(bearingDeg(p, target)) })}`;
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
    // PLAN-5..8: layer stack (basemap + venue overlays beneath the plan)
    const stack = createLayerStack(bundle, createBasemapRegistry());
    /** @type {Map<string, HTMLImageElement>} */ const imgCache = new Map();
    /** @param {string} src @param {() => void} onload */
    const img = (src, onload) => {
      if (!imgCache.has(src)) {
        const im = new Image();
        im.crossOrigin = 'anonymous';
        im.onload = onload;
        im.src = src;
        imgCache.set(src, im);
      }
      const im = imgCache.get(src);
      return im && im.complete && im.naturalWidth > 0 ? im : null;
    };

    const draw = () => {
      if (!g) return;
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      g.clearRect(0, 0, rect.width, rect.height);
      g.save();
      const tl = vp.toScreen(0, 0), br = vp.toScreen(bundle.plan.width, bundle.plan.height);

      for (const layer of stack.layers()) {
        g.globalAlpha = layer.opacity;
        if (layer.kind === 'basemap') {
          // visible lat/lon bounds of the current viewport → covering tiles
          const nw = geoRef.forward(vp.toWorld(0, 0).x, vp.toWorld(0, 0).y);
          const se = geoRef.forward(vp.toWorld(rect.width, rect.height).x, vp.toWorld(rect.width, rect.height).y);
          const z = zoomForSpan(this.ctx.mPerPx * bundle.plan.width / 2, bundle.origin.lat);
          for (const t of visibleTiles({ north: nw.lat, south: se.lat, west: nw.lon, east: se.lon }, z, layer.source.maxZoom)) {
            const url = layer.source.tileUrl(t.z, t.x, t.y);
            if (!url) continue;
            const r = tileRectInPlanPx(geoRef, t.x, t.y, t.z);
            const s0 = vp.toScreen(r.x, r.y);
            const w = r.w * vp.scale, h = r.h * vp.scale;
            const tile = img(url, draw);
            if (tile) g.drawImage(tile, s0.x, s0.y, w, h);
            else { g.fillStyle = '#141a21'; g.fillRect(s0.x, s0.y, w, h); }
          }
        } else if (layer.kind === 'overlay') {
          // venue-declared georeferenced image (PLAN-7), affine like the plan
          const o = layer.overlay;
          const cp0 = o.controlPoints[0];
          const p0 = geoRef.inverse(cp0.lat, cp0.lon);
          const s = vp.toScreen(p0.px - cp0.px, p0.py - cp0.py);
          const im = img(o.src, draw);
          if (im) g.drawImage(im, s.x, s.y, im.naturalWidth * vp.scale, im.naturalHeight * vp.scale);
        } else {
          // venue plan (placeholder grid until the raster ships in Phase 5)
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
        }
      }
      // PLAN-2: heading-up rotates the world around the visitor dot
      const p0 = this.ctx.pose.value;
      const rot = planMode({
        userPrefersHeadingUp: this.ctx.carnet.value?.planMode !== 'north-up' && this.ctx.perms.value.orientation === 'granted',
        heading: p0?.heading ?? null,
        headingAgeMs: 0, // pose.t freshness handled upstream by fusion
        disturbed: this.ctx.fusion?.headingDisturbed ?? false,
        confidence: 'absolute',
      });
      if (rot.mode === 'heading-up' && p0) {
        const ll0 = geoRef.inverse(p0.lat, p0.lon);
        const s0c = vp.toScreen(ll0.px, ll0.py);
        g.translate(s0c.x, s0c.y);
        g.rotate(rot.rotationDeg * Math.PI / 180);
        g.translate(-s0c.x, -s0c.y);
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
