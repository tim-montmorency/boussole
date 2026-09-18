/**
 * Shim for the vendored UMD module: provides a no-op createRequire so the
 * UMD wrapper picks its `module.exports` branch (no real require needed).
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */
export function createRequire() {
  return () => { throw new Error('require is not available in ESM vendored modules'); };
}
