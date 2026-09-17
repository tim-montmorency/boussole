/**
 * <b-cadran> — the compass HUD (CAD-1..4): SVG rose rotating with heading,
 * target arrow at bearing delta, centre distance, hot/cold ring. Renders the
 * pure cadranState() output; haptics fire on state transitions.
 */
import { BElement } from './base.js';
import { cadranState } from '../lib/cadran/state.js';

const RING_COLOUR = { hot: '#57d98e', warm: '#e8b93e', cold: '#58a0ff', none: '#2c3947' };

export class BCadran extends BElement {
  connectedCallback() {
    this.track(this.ctx.pose);
    if (this.ctx.targetId) this.track(this.ctx.targetId);
    this.render();
  }
  render() {
    if (!this.ctx) return;
    const { t } = this.ctx.i18n;
    // target = selected repère, else the first non-hidden one (M0 default)
    const repères = this.ctx.bundle?.reperes ?? [];
    const target = repères.find((/** @type {any} */ r) => r.id === this.ctx.targetId?.value)
      ?? repères.find((/** @type {any} */ r) => !r.hidden) ?? null;
    const s = cadranState(this.ctx.pose.value, target);
    if (s.haptic && 'vibrate' in navigator) {
      navigator.vibrate(s.haptic.type === 'arrive' ? [80, 40, 80] : 30); // CAD-3
    }
    const colour = /** @type {Record<string, string>} */ (RING_COLOUR)[s.ring.band];
    const ringExtra = s.ring.shape === 'double'
      ? `<circle r="46" fill="none" stroke="${colour}" stroke-width="2"/>`
      : s.ring.shape === 'dash'
        ? 'stroke-dasharray="6 4"' : '';
    this.html(`
      <section class="cadran" aria-hidden="false">
        <svg viewBox="-60 -60 120 120" width="180" height="180" role="img"
             aria-label="${s.distanceText}">
          <g transform="rotate(${s.roseDeg})">
            <text y="-48" text-anchor="middle" fill="#9fb0c0" font-size="11">N</text>
            <text y="54" text-anchor="middle" fill="#2c3947" font-size="10">S</text>
            <text x="48" y="4" text-anchor="middle" fill="#2c3947" font-size="10">E</text>
            <text x="-48" y="4" text-anchor="middle" fill="#2c3947" font-size="10">W</text>
            <circle r="52" fill="none" stroke="#2c3947"/>
          </g>
          <circle class="ring" r="40" fill="none" stroke="${colour}" stroke-width="3"
                  ${ringExtra}>
            <animate attributeName="stroke-opacity" values="1;.35;1"
                     dur="${s.ring.pulseMs}ms" repeatCount="indefinite"/>
          </circle>
          ${s.bearingDelta != null ? `
          <g transform="rotate(${s.bearingDelta})" class="arrow"
             opacity="${s.arrowDimmed ? 0.35 : 1}">
            <path d="M0,-30 L7,-6 L0,-11 L-7,-6 Z" fill="${colour}"/>
          </g>` : ''}
          <text y="6" text-anchor="middle" fill="#e8ecf0" font-size="15"
                font-weight="600">${s.distanceText}</text>
        </svg>
        ${s.label ? `<p class="cadran-label">${t(s.label)}</p>` : ''}
      </section>`);
  }
}
customElements.define('b-cadran', BCadran);
