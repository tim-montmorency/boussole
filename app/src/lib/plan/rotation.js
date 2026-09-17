/**
 * PLAN-2 plan rotation: north-up by default; heading-up only with a live,
 * high-confidence heading; stale (>3 s) or magnetically disturbed headings
 * fall back to north-up (the UI animates the transition).
 */

const STALE_MS = 3_000;

/**
 * @param {{ userPrefersHeadingUp: boolean, heading: number | null,
 *   headingAgeMs?: number, disturbed?: boolean, confidence?: string }} s
 * @returns {{ mode: 'north-up' | 'heading-up', rotationDeg: number,
 *   reason: string }}
 */
export function planMode(s) {
  const up = s.userPrefersHeadingUp;
  /** @param {string} reason */
  const fail = (reason) => /** @type {const} */ ({ mode: 'north-up', rotationDeg: 0, reason });
  if (!up) return fail('user');
  if (s.heading == null) return fail('no-heading');
  if ((s.headingAgeMs ?? Infinity) > STALE_MS) return fail('stale');
  if (s.disturbed) return fail('disturbed');
  if (s.confidence === 'relative') return fail('low-confidence');
  return { mode: 'heading-up', rotationDeg: -s.heading, reason: 'live' };
}
