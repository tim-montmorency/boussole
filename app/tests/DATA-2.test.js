import { describe, it, expect } from 'vitest';
import { sha256Hex, createMediaVerifier } from '../src/lib/content/hash.js';

// DATA-2: verify-on-fetch — mismatch drops media, repère stays usable; memoized.
describe('DATA-2 media integrity', () => {
  const body = new TextEncoder().encode('loop-bytes').buffer;

  it('sha256Hex hashes correctly', async () => {
    expect(await sha256Hex(body)).toMatch(/^[0-9a-f]{64}$/);
    expect(await sha256Hex(body)).toBe(await sha256Hex(body));
  });
  it('passes a correct hash and returns the bytes', async () => {
    const hash = await sha256Hex(body);
    const v = createMediaVerifier(async () => body);
    const got = await v.verify('media/a.webm', `sha256:${hash}`);
    expect(new Uint8Array(got)).toEqual(new Uint8Array(body));
  });
  it('drops media on hash mismatch (returns null, does not throw)', async () => {
    const v = createMediaVerifier(async () => body);
    await expect(v.verify('media/a.webm', `sha256:${'0'.repeat(64)}`)).resolves.toBeNull();
  });
  it('drops media on fetch failure (returns null, does not throw)', async () => {
    const v = createMediaVerifier(async () => { throw new Error('offline'); });
    await expect(v.verify('media/a.webm', `sha256:${'0'.repeat(64)}`)).resolves.toBeNull();
  });
  it('memoizes per URL — fetch runs once', async () => {
    let calls = 0;
    const hash = await sha256Hex(body);
    const v = createMediaVerifier(async () => { calls++; return body; });
    await v.verify('media/a.webm', `sha256:${hash}`);
    await v.verify('media/a.webm', `sha256:${hash}`);
    expect(calls).toBe(1);
    expect(v.size).toBe(1);
  });
});
