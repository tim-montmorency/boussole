import { describe, it, expect } from 'vitest';
import { createI18n } from '../src/lib/i18n/index.js';

// UI i18n: fr-CA default, en fallback; no hardcoded strings in components.
describe('UI i18n lookup', () => {
  const dicts = {
    'fr-CA': { 'nav.plan': 'Plan', 'nav.list': 'Repères', 'guide.cta': 'Me guider' },
    en: { 'nav.plan': 'Map', 'nav.list': 'Landmarks' },
  };
  it('resolves in the current language', () => {
    const i18n = createI18n(dicts, 'fr-CA');
    expect(i18n.t('nav.plan')).toBe('Plan');
  });
  it('falls back fr-CA → fr', () => {
    const i18n = createI18n({ fr: { 'a.b': 'base fr' }, en: {} }, 'fr-CA');
    expect(i18n.t('a.b')).toBe('base fr');
  });
  it('falls back to en when the key is missing in fr', () => {
    const i18n = createI18n(dicts, 'fr-CA');
    expect(i18n.t('nav.list')).toBe('Repères'); // exists in fr-CA
    const i18n2 = createI18n({ fr: {}, en: { only: 'english' } }, 'fr-CA');
    expect(i18n2.t('only')).toBe('english');
  });
  it('returns the key itself when untranslated everywhere (never blank UI)', () => {
    const i18n = createI18n(dicts, 'fr-CA');
    expect(i18n.t('does.not.exist')).toBe('does.not.exist');
  });
  it('interpolates {params}', () => {
    const i18n = createI18n({ 'fr-CA': { dist: '{d} m' }, en: {} }, 'fr-CA');
    expect(i18n.t('dist', { d: 12 })).toBe('12 m');
  });
  it('language can switch at runtime and notifies subscribers', () => {
    const i18n = createI18n(dicts, 'fr-CA');
    const seen = [];
    i18n.lang.subscribe((l) => seen.push(l));
    i18n.setLang('en');
    expect(i18n.t('nav.plan')).toBe('Map');
    expect(seen).toEqual(['fr-CA', 'en']);
  });
});
