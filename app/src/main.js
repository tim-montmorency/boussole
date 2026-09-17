// Entry point — wires modules together (Phase 3+). Kept minimal for the skeleton.
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('./sw.js').catch(() => {});
}
