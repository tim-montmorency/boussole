/**
 * <b-preprompt> — PERM-1 sheet: what is requested, what it enables, nothing
 * leaves the device; primary "Continuer", "Boussole seule" (PERM-9),
 * "Pas maintenant". Only Continuer/compass-only call browser APIs.
 */
import { BElement } from './base.js';

export class BPreprompt extends BElement {
  render() {
    if (!this.ctx) return;
    const { t } = this.ctx.i18n;
    this.html(`
      <div class="sheet-backdrop" role="dialog" aria-modal="true" aria-label="${t('guide.cta')}">
        <div class="sheet">
          <h2>${t('guide.cta')}</h2>
          <p>${t('preprompt.body')}</p>
          <ul>
            <li>${t('settings.perm.orientation')}</li>
            <li>${t('settings.perm.geo')}</li>
            <li>${t('preprompt.audio')}</li>
          </ul>
          <button class="primary" data-act="full">${t('preprompt.continue')}</button>
          <button data-act="compass">${t('guide.compassOnly')}</button>
          <button class="ghost" data-act="later">${t('guide.notNow')}</button>
        </div>
      </div>`);
    this.querySelectorAll('button').forEach((b) => b.addEventListener('click', async () => {
      const act = /** @type {HTMLElement} */ (b).dataset.act;
      if (act === 'full') await this.ctx.guide();
      else if (act === 'compass') await this.ctx.guideCompassOnly?.(); // PERM-9
      this.remove();
    }));
  }
}
customElements.define('b-preprompt', BPreprompt);
