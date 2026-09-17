# Test strategy — boussole

How [sdd.md](sdd.md) requirements become executable tests, given the no-build pure-JS constraint. Companion to [plan.md](plan.md).

- Status: v0.1 — 2026-09-17

---

## Pyramid

| Layer | Tool | Runs in | Covers | Speed target |
| --- | --- | --- | --- | --- |
| Unit | vitest (node env) | Node 18+ | everything in `src/lib/` except `sensors/` browser shells | < 5 s whole suite |
| Trace replay | vitest (node env) | Node | fusion + ambiance driven by `fixtures/traces/*.jsonl` | < 5 s |
| Component/e2e | Playwright | Chromium mobile emulation | tiers, permission flows, plan/cadran/AR wiring, offline | < 3 min |
| Device | manual checklist | real iPhone + Android | iOS-only APIs (PERM-2/9, `webkitCompassHeading`, audio unlock, haptics, thermal) | per milestone |

ARCH-1 is the enabling rule: browser APIs are touched only in `sensors/` shells, so ~90 % of behaviour is unit-testable in Node without mocks of the DOM.

## Conventions

- **Traceability by name.** Every test file is named after the requirement it proves: `POS-1.test.js`, `AR-2.test.js`. A requirement with no test file is not done. `grep -rL` over the ID list in sdd.md gives the coverage gap.
- One requirement may have several test files (`POS-2.ema.test.js`, `POS-2.fallback.test.js`); one file tests one requirement.
- **TDD loop:** write the test file → watch it fail (red) → minimal implementation (green) → refactor. No implementation commit without its red commit predecessor in the same PR.
- Pure modules get **property-style tables** where cheap (bearing/haversine against known city pairs, affine against hand-computed transforms) rather than snapshot soup.
- Snapshots allowed only for ambiance timeline replay (Phase 2), where the expected output is a long event sequence.

## Per-module test design

### `geometry/` (Phase 1)
- `POS-6.test.js` — ENU round-trip: latlon → ENU → latlon within 1 mm at venue scale; ENU axes orthonormal at origin.
- `PLAN-1.test.js` — affine: exact solve with 3 non-collinear points; LSQ residuals shrink with a 4th redundant point; collinear points rejected with a typed error; px→latlon→px identity within 0.5 px.
- `POS-2.ema.test.js` — circular EMA: no wrap glitch at 359°→1°; α=0.2 convergence; cold start takes first value; 180° jump doesn't oscillate (documented chosen behaviour: jump snaps, no lerp through 90°).
- `POS-5.test.js` — circular variance on the **raw** stream; 2 s window; threshold crossing both directions.
- Known-answer vectors: haversine Montréal→Québec ≈ 233 km; bearing due-east point ≈ 90°.

### `store/` (Phase 1)
- `DATA-1.test.js` — in-memory IDB fake: write is one `put`; `prev` backup exists after second write; corrupt main state → falls back to `prev`; corrupt both → fresh default. Migration: `version` absent → migrated to 1.
- `observable.test.js` — subscribe/unsubscribe, no emit after unsubscribe, synchronous dispatch order.

### `content/` (Phase 1)
- `DATA-4.test.js` — invalid bundles produce the error-card shape `{ file, rule, message }`, never throw.
- `DATA-2.test.js` — verify-on-fetch: correct hash passes; wrong hash → media dropped, repère still usable; result memoized per file (fetch called once).
- i18n content fallback: missing `en` falls back through fr-CA.

### `fusion/` (Phase 1)
- `POS-7.test.js` — registry: priority sort, unsupported source never started, hot-add/remove.
- `POS-1.test.js` — ancre reset sets accuracy 1 m and zeroes DR drift; GPS fix with accuracy > 30 m doesn't move the dot but bounds drift; weighted blend sanity.
- `POS-9.test.js` — no GPS fix for 15 s → "position estimée" badge state + nearest-ancre suggestion; DR continues from manual pose.
- `POS-8.test.js` / `DEMO-3.test.js` — SimPositionSource: joystick step = 0.5 m, rotate = 5°, walk-to-target at 1.2 m/s arrives within tolerance; trace playback at 1× and 4× emits identical pose sequences modulo timing; debug pose never touches `lastPose` persistence.

### `ambiance/` (Phase 2)
- `AMB-2.test.js` — each trigger: `approche` intensity ramps with distance inside `revealRadius`; `arrivée` fires once on `captureRadius` entry; `regard` within ±15° of bearing; `zone` point-in-polygon incl. edge behaviour.
- `AMB-4.test.js` — two `son` tableaux → one plays, crossfade 1.5 s scheduled; video pauses when off-screen (state flag; DOM wiring tested in Playwright).
- `AMB-5.test.js` — carnet records `method`, manual check-in flagged unverified.
- Replay: `fixtures/traces/visit-01.jsonl` → snapshot of tableau activation timeline + final carnet.

### e2e (Playwright, Chromium — Phase 3+)
- `PERM-1.e2e.js` — pre-prompt sheet content and that only "Continuer" calls the API (grant/deny via CDP `Browser.setPermission`).
- `CAP-*.e2e.js` — every denial path: no dead buttons, padlock + one-sentence explainer, denied remembered across reload (CAP-2), GPS loss → T1 badge (CAP-3).
- `PERM-4.e2e.js` — tab hidden 60 s → `watchPosition` stopped (assert via exposed debug counter), resumed on visible.
- `PLAN-2.e2e.js` — north-up default; heading-up after orientation grant; fallback to north-up on stale heading.
- `DEMO-4.e2e.js` — desk half: SimPositionSource walk-to-target ends ≤ 3 m distance-readout error; cadran bearing within ±10° throughout; `regard` triggers the boucle.
- `OFF-1.e2e.js` — first load, then `context.setOffline(true)`: full navigation works (M1 acceptance head start).

### Device checklist (`docs/device-checklist.md`, Phase 4)
iOS-only, not automatable: dual `requestPermission` chain order and denial stickiness (R1); `webkitCompassHeading` sanity vs. physical compass (R2); FOV calibration accuracy (R3); audio unlock durability across reload (R11); haptics; thermal (PERF-3, M3).

## What we deliberately don't test

- Visual pixel-perfection of canvas/SVG (brittle, low value) — e2e asserts state (attributes, ARIA live text), not screenshots.
- Third-party code (jsQR) beyond a smoke test.
- `tsc --checkJs` is a lint gate, not a test.

## Fixtures

- `fixtures/traces/visit-01.jsonl` — recorded/simulated walk entrance→atrium (format pinned in plan Phase 1).
- `fixtures/venues/` — minimal valid bundle, and one invalid per DATA-4 rule.
- City-pair geodesy vectors checked into `geometry/` tests.
