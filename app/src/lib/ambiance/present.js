/**
 * Ambiance presentation state (AMB-3/4): maps engine output to a pure
 * description of what the DOM should render/play. Media elements and the
 * AudioContext live in the component layer; this module is the testable brain.
 */

const FADE_MS = 1500; // AMB-4

export function createPresentation() {
  /** @type {Set<string>} */ let playingVideos = new Set();

  return {
    /**
     * Plan view: non-audio tableaux become bottom cards (nearest/most intense
     * first). `son` never appears as a card (it plays, invisibly).
     * @param {any[]} actives engine `active` list
     */
    planView(actives) {
      return {
        cards: actives
          .filter((a) => a.tableau.kind !== 'son')
          .sort((a, b) => b.intensity - a.intensity)
          .map((a) => ({ key: a.key, repereId: a.repereId, tableau: a.tableau, intensity: a.intensity })),
      };
    },

    /**
     * AR view: image/boucle billboarded at the repère bearing, size and
     * opacity scaling with distance (AR-4). texte/son never billboard.
     * @param {any[]} actives @param {{ heading: number }} _pose
     */
    arView(actives, _pose) {
      return {
        billboards: actives
          .filter((a) => a.tableau.kind === 'image' || a.tableau.kind === 'boucle')
          .map((a) => ({
            key: a.key, repereId: a.repereId, tableau: a.tableau,
            scale: 1 / (1 + a.distanceM / 10),
            opacity: Math.max(0.25, 1 - a.distanceM / 100),
          })),
      };
    },

    /**
     * Audio: current `son` plays through the unlocked AudioContext; the loser
     * fades over 1.5 s (AMB-4).
     * @param {{ current: string|null, fadingOut: string|null }} audio @param {number} now
     */
    audioPlan(audio, now) {
      return {
        play: audio.current ? { key: audio.current } : null,
        fadeOut: audio.fadingOut ? { key: audio.fadingOut, untilMs: now + FADE_MS } : null,
      };
    },

    /**
     * Video loops: play only while active and the tab is visible; anything
     * playing that left the active set (or tab hidden) pauses (AMB-4/PERM-3).
     * @param {any[]} actives @param {{ hidden: boolean }} env
     */
    videoPlan(actives, env) {
      const want = new Set(
        actives.filter((a) => a.tableau.kind === 'boucle').map((a) => a.key));
      const play = env.hidden ? [] : [...want];
      const pause = [...playingVideos].filter((k) => env.hidden || !want.has(k));
      for (const k of pause) playingVideos.delete(k);
      if (!env.hidden) playingVideos = new Set([...playingVideos, ...want]);
      return { play, pause };
    },
  };
}
