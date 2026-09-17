/**
 * Localized content resolution (i18n): fr-CA is the default, en the fallback.
 * @param {Record<string, string> | undefined} map
 * @param {string} [lang] e.g. "fr-CA"
 * @returns {string}
 */
export function pickLocalized(map, lang = 'fr-CA') {
  if (!map || typeof map !== 'object') return '';
  const base = lang.split('-')[0];
  return map[lang] ?? map[base] ?? map.en ?? map.fr ?? Object.values(map)[0] ?? '';
}
