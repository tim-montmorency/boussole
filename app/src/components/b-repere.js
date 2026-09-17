/**
 * <b-repere> — repère detail: description, distance/bearing, tableaux as
 * cards (A11Y-2: nothing is AR-only), manual check-in (AMB-5).
 */
import { BElement, esc } from './base.js';
import { pickLocalized } from '../lib/content/localize.js';
import { haversineM, bearingDeg } from '../lib/geometry/geo.js';

export class BRepere extends BElement {
  connectedCallback() {
    this.track(this.ctx.pose);
    this.track(this.ctx.carnet);
    this.render();
  }
  render() {
    const { t, lang } = this.ctx.i18n;
    const id = this.ctx.router.route.value.params.id;
    const r = (this.ctx.bundle.reperes ?? []).find((/** @type {any} */ x) => x.id === id);
    if (!r) { this.html(`<p>${esc(id)} — ?</p>`); return; }
    const pose = this.ctx.pose.value;
    const name = esc(pickLocalized(r.name, lang.value));
    const hint = esc(pickLocalized(r.hint, lang.value));
    const stats = pose
      ? `<p class="stats">${t('repere.distance', { d: Math.round(haversineM(pose, r)) })} · ${t('repere.bearing', { b: Math.round(bearingDeg(pose, r)) })}</p>`
      : '';
    const cards = (r.tableaux ?? [])
      .filter((/** @type {any} */ tb) => tb.kind === 'texte') // media cards arrive with Phase 4 presentation
      .map((/** @type {any} */ tb) => `<blockquote class="tableau">${esc(pickLocalized(tb.text, lang.value))}</blockquote>`).join('');
    const enc = this.ctx.carnet.value?.encountered?.[r.id];
    const seen = enc
      ? `<p class="seen">✓ ${esc(enc.method)}${enc.verified === false ? ` (${t('repere.unverified')})` : ''}</p>` : '';
    this.html(`
      <article class="repere-detail">
        <h1>${name}</h1>
        <p class="hint">${hint}</p>
        ${stats}
        ${cards}
        <button class="checkin">${t('repere.checkin')}</button>
        ${seen}
      </article>`);
    this.querySelector('.checkin')?.addEventListener('click', () => this.ctx.checkin(r.id));
  }
}
customElements.define('b-repere', BRepere);
