/**
 * Field log (debug): snapshot of everything needed to debug a real-phone
 * session from a paste — device, venue, pose, permissions, tier, carnet.
 * The <b-debug> panel copies it to the clipboard (and runs a walk self-test).
 */

/**
 * @param {{ ua: string, bundle: any, pose: any, perms: any, tier: string,
 *   audioUnlocked: boolean, carnet: any, extra?: Record<string, any> }} s
 */
export function collectFieldLog(s) {
  return {
    at: new Date().toISOString(),
    userAgent: s.ua,
    venue: s.bundle?.id ?? null,
    pose: s.pose ?? null,
    perms: s.perms ?? {},
    tier: s.tier ?? 'T0',
    audioUnlocked: s.audioUnlocked ?? false,
    carnet: s.carnet ?? { encountered: {} },
    extra: s.extra ?? {},
  };
}

/** @param {ReturnType<typeof collectFieldLog>} log */
export function formatFieldLog(log) {
  return `boussole field log\n\`\`\`json\n${JSON.stringify(log, null, 2)}\n\`\`\``;
}
