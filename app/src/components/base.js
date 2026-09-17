/**
 * Shared app context — built once in main.js, passed to every view component.
 * Components read it via `this.ctx` after registration (set by the outlet).
 * @typedef {object} AppCtx
 * @property {import('../lib/i18n/index.js').createI18n extends (...a: any) => infer R ? R : never} [i18n]
 */
export {};

/**
 * Base element: tiny render helper. Components implement `render()` and call
 * `this.html(template)` — innerHTML with sanitized-content-only strings
 * (SEC-2: content fields are text-only, escaped with esc()).
 * @param {string} s
 */
export function esc(s) {
  return String(s).replace(/[&<>"']/g, (c) => (
    /** @type {Record<string, string>} */ ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]
  ));
}

export class BElement extends HTMLElement {
  constructor() {
    super();
    /** @type {any} */ this.ctx = null;
    /** @type {(() => void)[]} */ this._offs = [];
  }
  connectedCallback() { this.render(); }
  /** Called by the parent after ctx is assigned — subscriptions go here. */
  bind() {}
  disconnectedCallback() { this._offs.forEach((f) => f()); this._offs = []; }
  /** Subscribe for the element's lifetime. @param {any} store */
  track(store) {
    const off = store.subscribe(() => this.render());
    this._offs.push(off);
  }
  /** @param {string} html */
  html(html) { this.innerHTML = html; }
  render() {}
}
