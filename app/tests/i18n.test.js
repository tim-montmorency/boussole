import { describe, it, expect } from 'vitest';
import { pickLocalized } from '../src/lib/content/localize.js';

// i18n content resolution: fr-CA default, en fallback.
describe('localized content resolution', () => {
  const name = { fr: "L'atrium", en: 'The atrium' };
  it('fr-CA resolves through base fr', () => {
    expect(pickLocalized(name, 'fr-CA')).toBe("L'atrium");
  });
  it('exact match wins', () => {
    expect(pickLocalized({ 'fr-CA': 'ici', fr: 'là' }, 'fr-CA')).toBe('ici');
  });
  it('falls back to en when fr missing', () => {
    expect(pickLocalized({ en: 'The atrium' }, 'fr-CA')).toBe('The atrium');
  });
  it('falls back to any available string', () => {
    expect(pickLocalized({ fr: 'seulement' }, 'es')).toBe('seulement');
  });
  it('empty input → empty string, never throws', () => {
    expect(pickLocalized(undefined)).toBe('');
    expect(pickLocalized({})).toBe('');
  });
});
