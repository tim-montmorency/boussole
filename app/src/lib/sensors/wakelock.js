/**
 * Screen wake lock shell (AR-8): held while cadran/AR is foreground,
 * re-acquired on visibility return, silent no-op where unsupported.
 */

/** @param {{ wakelock: { request: (t: string) => Promise<any> } | null,
 *   doc: { hidden: boolean, addEventListener: (ev: string, fn: () => void) => void } }} deps */
export function createWakeLockShell({ wakelock, doc }) {
  /** @type {any} */ let sentinel = null;
  let wanted = false;

  async function acquire() {
    wanted = true;
    if (!wakelock || doc.hidden || sentinel) return;
    try { sentinel = await wakelock.request('screen'); } catch { sentinel = null; }
  }
  async function release() {
    wanted = false;
    try { await sentinel?.release(); } catch { /* already gone */ }
    sentinel = null;
  }
  doc.addEventListener('visibilitychange', () => {
    // browser auto-releases the sentinel on hide; re-acquire on return
    if (doc.hidden) sentinel = null;
    else if (wanted) acquire();
  });

  return { acquire, release, get held() { return sentinel != null; } };
}
