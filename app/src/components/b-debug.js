/**
 * <b-debug> — DEMO-3 panel: start pose inputs, joystick/keys, walk-to-target,
 * trace playback, live readout. Enabled by ?debug=1 (5-tap gesture is a
 * Phase 4 nicety; the query flag is the tested path).
 */
import { BElement, esc } from './base.js';
import { pickLocalized } from '../lib/content/localize.js';

export class BDebug extends BElement {
  connectedCallback() { this._start(); }

  /** Setup — also called by the parent after `ctx` is assigned. */
  _start() {
    if (!this.ctx) return;
    clearInterval(this._timer);
    if (this._keys) window.removeEventListener('keydown', this._keys);
    this._timer = setInterval(() => this.tick(), 100);
    this._keys = (/** @type {KeyboardEvent} */ e) => this.onKey(e);
    window.addEventListener('keydown', this._keys);
    this.render();
  }

  disconnectedCallback() {
    clearInterval(this._timer);
    if (this._keys) window.removeEventListener('keydown', this._keys);
    super.disconnectedCallback();
  }

  tick() {
    if (!this.ctx?.debug) return;
    this.ctx.debug.tick(100);
    const r = this.querySelector('#dbg-readout');
    if (r) {
      r.textContent = JSON.stringify(this.ctx.debug.readout({
        planMode: this.ctx.carnet.value?.planMode ?? 'north-up',
        perms: this.ctx.perms.value,
        audioUnlocked: this.ctx.carnet.value?.audioUnlocked ?? false,
      }), null, 1);
    }
  }

  /** @param {KeyboardEvent} e */
  onKey(e) {
    if (!this.ctx?.debug) return;
    if (e.key === 'ArrowUp') this.ctx.debug.step();
    else if (e.key === 'ArrowLeft') this.ctx.debug.rotate(-5);
    else if (e.key === 'ArrowRight') this.ctx.debug.rotate(5);
    else return;
    e.preventDefault();
    this.tick(); // reflect the move immediately, don't wait for the interval
  }

  render() {
    if (!this.ctx) return; // parsed before ctx assignment — _start() re-renders
    const repereOpts = (this.ctx.bundle?.reperes ?? [])
      .map((/** @type {any} */ r) => `<option value="${esc(r.id)}">${esc(pickLocalized(r.name))}</option>`)
      .join('');
    this.html(`
      <section class="debug card" data-testid="debug-panel">
        <h2>debug</h2>
        <form id="dbg-pose">
          <label>lat <input name="lat" type="number" step="any" value="45.55789"></label>
          <label>lon <input name="lon" type="number" step="any" value="-73.71610"></label>
          <label>heading° <input name="heading" type="number" value="90"></label>
          <label>accuracy m <input name="accuracy" type="number" value="1"></label>
          <button type="submit">apply</button>
        </form>
        <div class="dbg-controls">
          <button id="dbg-step">step 0.5 m</button>
          <button id="dbg-left">⟲ 5°</button>
          <button id="dbg-right">⟳ 5°</button>
          <select id="dbg-target">${repereOpts}</select>
          <button id="dbg-walk">walk to target</button>
        </div>
        <div class="dbg-trace">
          <select id="dbg-trace"><option value="">— trace —</option>
            <option value="visit-01">visit-01</option></select>
          <button id="dbg-play1">1×</button>
          <button id="dbg-play4">4×</button>
        </div>
        <pre id="dbg-readout"></pre>
      </section>`);
    this.querySelector('#dbg-pose')?.addEventListener('submit', (e) => {
      e.preventDefault();
      const f = new FormData(/** @type {HTMLFormElement} */ (e.target));
      this.ctx.debug.applyPose({
        lat: Number(f.get('lat')), lon: Number(f.get('lon')),
        heading: Number(f.get('heading')), accuracy: Number(f.get('accuracy')),
      });
    });
    this.querySelector('#dbg-step')?.addEventListener('click', () => this.ctx.debug.step());
    this.querySelector('#dbg-left')?.addEventListener('click', () => this.ctx.debug.rotate(-5));
    this.querySelector('#dbg-right')?.addEventListener('click', () => this.ctx.debug.rotate(5));
    this.querySelector('#dbg-walk')?.addEventListener('click', () => {
      const id = /** @type {HTMLSelectElement} */ (this.querySelector('#dbg-target')).value;
      const r = this.ctx.bundle.reperes.find((/** @type {any} */ x) => x.id === id);
      if (r) this.ctx.debug.walkTo(r);
    });
    const play = async (/** @type {number} */ speed) => {
      const name = /** @type {HTMLSelectElement} */ (this.querySelector('#dbg-trace')).value;
      if (!name) return;
      const text = await fetch(`./fixtures/traces/${name}.jsonl`).then((r) => r.text());
      this.ctx.debug.playTrace(text, speed);
    };
    this.querySelector('#dbg-play1')?.addEventListener('click', () => play(1));
    this.querySelector('#dbg-play4')?.addEventListener('click', () => play(4));
  }
}
customElements.define('b-debug', BDebug);
