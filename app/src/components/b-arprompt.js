/**
 * <b-arprompt> — camera pre-prompt (PERM-1 second sheet): the camera stays
 * on-device; only "Activer la caméra" calls getUserMedia.
 */
import { BElement } from './base.js';

export class BArprompt extends BElement {
  render() {
    if (!this.ctx) return;
    const { t } = this.ctx.i18n;
    this.html(`
      <div class="sheet-backdrop" role="dialog" aria-modal="true" aria-label="${t('ar.cta')}">
        <div class="sheet">
          <h2>${t('ar.cta')}</h2>
          <p>${t('arprompt.body')}</p>
          <button class="primary" data-act="on">${t('arprompt.enable')}</button>
          <button class="ghost" data-act="later">${t('guide.notNow')}</button>
        </div>
      </div>`);
    this.querySelectorAll('button').forEach((b) => b.addEventListener('click', async () => {
      const act = /** @type {HTMLElement} */ (b).dataset.act;
      if (act === 'on') {
        const stream = await this.ctx.camera?.start();
        if (stream) this.ctx.router.go('ar');
      }
      this.remove();
    }));
  }
}
customElements.define('b-arprompt', BArprompt);
