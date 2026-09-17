/**
 * <b-app> — router outlet + persistent nav (A11Y-3/4: nav is real buttons,
 * 44px targets). Renders the view for the current route, or the DATA-4
 * error card when the venue failed validation.
 */
import { BElement, esc } from './base.js';
import './b-plan.js';
import './b-list.js';
import './b-repere.js';
import './b-carnet.js';
import './b-settings.js';
import './b-ar.js';

const VIEWS = { plan: 'b-plan', list: 'b-list', repere: 'b-repere', carnet: 'b-carnet', settings: 'b-settings', ar: 'b-ar' };

export class BApp extends BElement {
  connectedCallback() {
    this.track(this.ctx.router.route);
    this.render();
  }
  render() {
    const { t } = this.ctx.i18n;
    const r = this.ctx.router.route.value;
    if (this.ctx.bundleError) {
      const errs = this.ctx.bundleError.errors.map((/** @type {any} */ e) => `${esc(e.rule)}: ${esc(e.message)}`).join('<br>');
      this.html(`
        <section class="card error" role="alert">
          <h1>${t('error.bundle')}</h1><p>${errs}</p>
          <button onclick="location.reload()">${t('error.retry')}</button>
        </section>`);
      return;
    }
    const tag = /** @type {Record<string, string>} */ (VIEWS)[r.name] ?? 'b-plan';
    this.html(`
      <${tag} id="view"></${tag}>
      <nav aria-label="main">
        ${['plan', 'list', 'carnet', 'settings'].map((n) => `
          <button class="nav" data-route="${n}" aria-current="${r.name === n}">${t(`nav.${n}`)}</button>`).join('')}
      </nav>`);
    const view = /** @type {any} */ (this.querySelector('#view'));
    view.ctx = this.ctx;
    view.render(); // connectedCallback only fires when not yet connected; render directly
    this.querySelectorAll('.nav').forEach((b) => b.addEventListener('click', () => {
      this.ctx.router.go(/** @type {HTMLElement} */ (b).dataset.route);
    }));
  }
}
customElements.define('b-app', BApp);
