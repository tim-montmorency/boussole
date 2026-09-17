/**
 * PositionSource registry (POS-7, ARCH-2). Sources are plain objects:
 * { id, label, priority, supported(): Promise<boolean>, start(), stop(),
 *   subscribe(fn): () => void } — emitting Fix events.
 * The registry sorts by priority and fuses whatever is live; unsupported
 * sources are simply absent (never started).
 */
export function createRegistry() {
  /** @type {any[]} */ const all = [];
  return {
    /** @param {any} source */
    add(source) {
      all.push(source);
      all.sort((a, b) => b.priority - a.priority);
      return () => { const i = all.indexOf(source); if (i >= 0) all.splice(i, 1); };
    },
    get sources() { return [...all]; },
    /** @returns {Promise<any[]>} sources whose supported() resolved true, priority order */
    async live() {
      const flags = await Promise.all(all.map(async (s) => {
        try { return await s.supported(); } catch { return false; }
      }));
      return all.filter((_, i) => flags[i]);
    },
  };
}
