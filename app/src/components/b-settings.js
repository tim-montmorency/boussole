/**
 * <b-settings> — current tier + per-permission status (PERM-5), erase-all (PRIV-4).
 */
import { BElement, esc } from './base.js';

export class BSettings extends BElement {
  connectedCallback() {
    this.track(this.ctx.tier);
    this.render();
  }
  render() {
    const { t } = this.ctx.i18n;
    const perms = this.ctx.perms.value;
    /** @param {string} k */
    const row = (k) => `<li>${t(`settings.perm.${k}`)}: <strong>${esc(perms[k])}</strong></li>`;
    this.html(`
      <section class="settings">
        <h1>${t('nav.settings')}</h1>
        <p>${t('settings.tier')}: <strong id="tier">${esc(this.ctx.tier.value)}</strong></p>
        <ul>${row('geo')}${row('orientation')}${row('camera')}</ul>
        <button class="erase danger">${t('settings.erase')}</button>
      </section>`);
    this.querySelector('.erase')?.addEventListener('click', async () => {
      await this.ctx.eraseAll();
      globalThis.location?.reload();
    });
  }
}
customElements.define('b-settings', BSettings);
