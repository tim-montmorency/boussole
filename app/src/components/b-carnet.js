/**
 * <b-carnet> — the visitor's local record (AMB-5): encountered repères,
 * newest first. No score, no streak.
 */
import { BElement, esc } from './base.js';
import { pickLocalized } from '../lib/content/localize.js';

export class BCarnet extends BElement {
  connectedCallback() {
    this.track(this.ctx.carnet);
    this.render();
  }
  render() {
    const { t, lang } = this.ctx.i18n;
    const encountered = this.ctx.carnet.value?.encountered ?? {};
    const byId = new Map((this.ctx.bundle.reperes ?? []).map((/** @type {any} */ r) => [r.id, r]));
    const rows = Object.entries(encountered)
      .sort(([, a], [, b]) => b.at.localeCompare(a.at))
      .map(([id, e]) => {
        const r = byId.get(id);
        const name = r ? esc(pickLocalized(r.name, lang.value)) : esc(id);
        const unv = e.verified === false ? ` <small>(${t('repere.unverified')})</small>` : '';
        return `<li>${name} <small>${esc(e.method)}</small>${unv}</li>`;
      }).join('');
    this.html(rows
      ? `<ul class="carnet">${rows}</ul>`
      : `<p class="empty">${t('carnet.empty')}</p>`);
  }
}
customElements.define('b-carnet', BCarnet);
