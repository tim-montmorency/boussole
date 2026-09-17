/**
 * <b-list> — repère list with live distance/bearing (A11Y-3: the text
 * alternative to the canvas plan). T0-complete: works with no permissions.
 */
import { BElement, esc } from './base.js';
import { pickLocalized } from '../lib/content/localize.js';
import { haversineM, bearingDeg } from '../lib/geometry/geo.js';

export class BList extends BElement {
  connectedCallback() {
    this.track(this.ctx.pose);
    this.track(this.ctx.carnet);
    this.render();
  }
  render() {
    const { t, lang } = this.ctx.i18n;
    const pose = this.ctx.pose.value;
    const encountered = this.ctx.carnet.value?.encountered ?? {};
    const rows = (this.ctx.bundle.reperes ?? []).map((/** @type {any} */ r) => {
      const name = esc(pickLocalized(r.name, lang.value));
      const seen = encountered[r.id] ? ' ✓' : '';
      const dist = pose
        ? ` — ${t('repere.distance', { d: Math.round(haversineM(pose, r)) })} · ${t('repere.bearing', { b: Math.round(bearingDeg(pose, r)) })}`
        : '';
      return `<li><button class="repere" data-id="${esc(r.id)}">${name}${seen}<small>${dist}</small></button></li>`;
    }).join('');
    this.html(`<ul class="repere-list">${rows}</ul>`);
    this.querySelectorAll('.repere').forEach((b) => b.addEventListener('click', () => {
      this.ctx.router.go('repere', { id: /** @type {HTMLElement} */ (b).dataset.id });
    }));
  }
}
customElements.define('b-list', BList);
