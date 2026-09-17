/**
 * UI string lookup (plan Phase 3.5): fr-CA default, en fallback.
 * Components never hardcode strings — they call t(key, params?).
 */
import { observable } from '../store/observable.js';

/**
 * @param {Record<string, Record<string, string>>} dicts lang → key → string
 * @param {string} [defaultLang]
 */
export function createI18n(dicts, defaultLang = 'fr-CA') {
  const lang = observable(defaultLang);

  /** @param {string} key @param {Record<string, any>} [params] */
  function t(key, params) {
    const l = lang.value;
    const base = l.split('-')[0];
    let s = dicts[l]?.[key] ?? dicts[base]?.[key] ?? dicts.en?.[key] ?? key;
    if (params) for (const [k, v] of Object.entries(params)) s = s.replaceAll(`{${k}}`, String(v));
    return s;
  }

  return {
    t,
    lang,
    /** @param {string} l */
    setLang(l) { lang.set(l); },
  };
}
