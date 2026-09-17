import { describe, it, expect } from 'vitest';
import { createAudioShell } from '../src/lib/sensors/audio.js';

// PERM-7/8: audio unlock in the "Me guider" gesture; silent-buffer resume
// counts as the autoplay grant; any later tap re-unlocks after a reload.

function fakeAudioContext() {
  const state = { resumed: 0, buffersPlayed: 0 };
  return {
    state,
    ctx: {
      state: 'suspended',
      resume: async function () { state.resumed++; this.state = 'running'; },
      createBuffer: () => ({}),
      createBufferSource: () => ({
        buffer: null,
        connect() {},
        start() { state.buffersPlayed++; },
      }),
      destination: {},
    },
  };
}

describe('PERM-7 audio unlock', () => {
  it('unlock() resumes the context and plays a one-sample silent buffer', async () => {
    const { state, ctx } = fakeAudioContext();
    const shell = createAudioShell({ makeContext: () => ctx });
    await shell.unlock();
    expect(state.resumed).toBe(1);
    expect(state.buffersPlayed).toBe(1);
    expect(shell.unlocked).toBe(true);
  });
  it('unlock is idempotent within a session', async () => {
    const { state, ctx } = fakeAudioContext();
    const shell = createAudioShell({ makeContext: () => ctx });
    await shell.unlock(); await shell.unlock();
    expect(state.resumed).toBe(1);
  });
  it('context creation is lazy (no AudioContext before the gesture)', () => {
    let made = 0;
    const { ctx } = fakeAudioContext();
    const shell = createAudioShell({ makeContext: () => { made++; return ctx; } });
    expect(made).toBe(0);
    expect(shell.context).toBeNull();
  });
  it('PERM-8: a context found suspended on a later gesture re-unlocks (page reload case)', async () => {
    const { state, ctx } = fakeAudioContext();
    const shell = createAudioShell({ makeContext: () => ctx });
    await shell.unlock();
    ctx.state = 'suspended'; // browser forgot
    await shell.unlock();    // any tap re-unlocks
    expect(state.resumed).toBe(2);
    expect(shell.unlocked).toBe(true);
  });
  it('unlock failure (no gesture) leaves unlocked=false, no throw', async () => {
    const shell = createAudioShell({
      makeContext: () => ({ state: 'suspended', resume: async () => { throw new Error('no gesture'); } }),
    });
    await expect(shell.unlock()).resolves.toBe(false);
    expect(shell.unlocked).toBe(false);
  });
});
