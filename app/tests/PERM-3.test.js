import { describe, it, expect } from 'vitest';
import { createCameraShell } from '../src/lib/sensors/camera.js';
import { createWakeLockShell } from '../src/lib/sensors/wakelock.js';

// PERM-3: camera released when leaving AR or tab hidden; environment facing, no audio.
// AR-8: screen wake lock during cadran/AR, re-acquired on visibility return.

describe('PERM-3 camera lifecycle', () => {
  const fakeTrack = () => ({ stopped: false, stop() { this.stopped = true; } });
  const fakeGum = (track) => async (constraints) => {
    fakeGum.constraints = constraints;
    return { getVideoTracks: () => [track] };
  };

  it('requests environment camera without audio', async () => {
    const track = fakeTrack();
    const shell = createCameraShell({ getUserMedia: fakeGum(track), doc: { hidden: false, addEventListener() {} } });
    await shell.start();
    expect(fakeGum.constraints.video.facingMode).toEqual({ ideal: 'environment' });
    expect(fakeGum.constraints.audio).toBe(false);
    expect(shell.stream).not.toBeNull();
  });
  it('releases tracks on stop()', async () => {
    const track = fakeTrack();
    const shell = createCameraShell({ getUserMedia: fakeGum(track), doc: { hidden: false, addEventListener() {} } });
    await shell.start();
    shell.stop();
    expect(track.stopped).toBe(true);
    expect(shell.stream).toBeNull();
  });
  it('releases tracks when the tab hides (PERM-3)', async () => {
    const track = fakeTrack();
    let hidden = false; let onVis = () => {};
    const doc = { get hidden() { return hidden; },
      addEventListener: (_e, f) => { onVis = f; } };
    const shell = createCameraShell({ getUserMedia: fakeGum(track), doc });
    await shell.start();
    hidden = true; onVis();
    expect(track.stopped).toBe(true);
  });
  it('start() failure (denial) leaves a clean stopped state, no throw to UI', async () => {
    const shell = createCameraShell({
      getUserMedia: async () => { throw new DOMException('denied', 'NotAllowedError'); },
      doc: { hidden: false, addEventListener() {} },
    });
    await expect(shell.start()).resolves.toBeNull();
    expect(shell.stream).toBeNull();
  });
});

describe('AR-8 screen wake lock', () => {
  const fakeWakelock = () => {
    const state = { held: 0, released: 0 };
    return { state, request: async () => { state.held++; return { release: async () => { state.released++; } }; } };
  };
  it('acquires on enter, releases on exit', async () => {
    const wl = fakeWakelock();
    const shell = createWakeLockShell({ wakelock: wl, doc: { hidden: false, addEventListener() {} } });
    await shell.acquire();
    expect(wl.state.held).toBe(1);
    await shell.release();
    expect(wl.state.released).toBe(1);
  });
  it('re-acquires when the tab becomes visible again', async () => {
    const wl = fakeWakelock();
    let hidden = false; let onVis = () => {};
    const doc = { get hidden() { return hidden; }, addEventListener: (_e, f) => { onVis = f; } };
    const shell = createWakeLockShell({ wakelock: wl, doc });
    await shell.acquire();
    hidden = true; onVis();   // browser auto-releases on hide
    hidden = false; onVis();  // shell re-acquires
    expect(wl.state.held).toBe(2);
  });
  it('unsupported API → silent no-op', async () => {
    const shell = createWakeLockShell({ wakelock: null, doc: { hidden: false, addEventListener() {} } });
    await expect(shell.acquire()).resolves.toBeUndefined();
    expect(shell.held).toBe(false);
  });
});
