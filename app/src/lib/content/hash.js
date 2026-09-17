/**
 * Media integrity (DATA-2), verify-on-fetch: a media file's sha256 is checked
 * when the file is first fetched — never a bulk upfront download, so DATA-3's
 * lazy cache stays honest. A mismatch drops the media; the repère stays usable.
 * Results are memoized per URL.
 */

async function subtle() {
  if (globalThis.crypto?.subtle) return globalThis.crypto.subtle;
  return (await import('node:crypto')).webcrypto.subtle; // Node 18 fallback
}

/** @param {ArrayBuffer} buf @returns {Promise<string>} hex */
export async function sha256Hex(buf) {
  const digest = await (await subtle()).digest('SHA-256', buf);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * @param {(url: string) => Promise<ArrayBuffer>} fetchFn
 */
export function createMediaVerifier(fetchFn) {
  /** @type {Map<string, Promise<ArrayBuffer|null>>} */ const memo = new Map();
  /**
   * Fetch + verify one media file.
   * @param {string} url @param {string} expected e.g. "sha256:ab12…"
   * @returns {Promise<ArrayBuffer|null>} null on fetch failure or hash mismatch
   */
  function verify(url, expected) {
    if (!memo.has(url)) {
      memo.set(url, (async () => {
        try {
          const buf = await fetchFn(url);
          const want = expected.replace(/^sha256:/, '');
          if ((await sha256Hex(buf)) !== want) return null;
          return buf;
        } catch { return null; }
      })());
    }
    return /** @type {Promise<ArrayBuffer|null>} */ (memo.get(url));
  }
  return { verify, get size() { return memo.size; } };
}
