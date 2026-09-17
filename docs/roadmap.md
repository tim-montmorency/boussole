# Roadmap — boussole

Live progress tracker. Phases from [plan.md](plan.md); requirements from [sdd.md](sdd.md); open research in [research.md](research.md).

- Updated: 2026-09-17 (Phase 3 T0 shell complete)

## Status legend
`[x]` done · `[~]` in progress · `[ ]` not started · 🚫 blocked (by research/device)

## Phase 0 — Scaffold
- [x] App skeleton: pure ESM, no build step (`index.html`, `manifest.webmanifest`, `sw.js` stub, `src/main.js`)
- [x] Dev tooling: vitest (Node), `tsc --noEmit --checkJs` (scoped to `src/`), npm scripts
- [x] `schemas/venue.schema.json` (media hashes, ASCII enums, plan control points ≥ 3)
- [x] Primitives: `observable.js`, `idb.js` (memory fake + IndexedDB wrapper)
- [ ] HTTPS dev recipe (`docs/dev-https.md`, mkcert) — needed before Phase 4 device work
- [ ] CI skeleton `.woodpecker.yml`
- [ ] REUSE headers / licence lint

## Phase 1 — Pure core (TDD)
- [x] `geometry/`: haversine, bearing, ENU frame (POS-6) · affine fit exact/LSQ + collinear rejection (PLAN-1) · circular EMA + raw-window std (POS-2/POS-5)
- [x] `store/`: CarnetState load/save with one-deep `prev` backup + migrations (DATA-1), `shouldPersistPose` (DEMO-3)
- [x] `content/`: schema-subset validator with DATA-4 error shape · verify-on-fetch sha256 memoized (DATA-2) · localized resolution fr-CA→en
- [x] Trace format pinned: `{t, source, payload}` jsonl + header `{meta}` (see plan Phase 1, fixture `fixtures/traces/visit-01.jsonl`)
- [x] `fusion/`: registry (POS-7) · fuse rules POS-1/POS-4/POS-9 · `SimPositionSource` + trace player (POS-8/DEMO-3)
- [x] Example venue bundle `venues/example/venue.json` (validates clean)
- [ ] Step-detection filter (POS-3 band-pass 1–3 Hz, adaptive threshold) — deferred to Phase 4 with DeviceMotion shell

**Test count: 91 passing · tsc clean**

## Phase 2 — Ambiance engine (TDD)
- [x] Trigger reducer: approche ramp / arrivee-once / regard ±15° / zone polygon (AMB-2)
- [x] Audio arbitration: one `son`, 1.5 s crossfade (AMB-4)
- [x] Carnet encounter events + unverified manual check-in (AMB-5)
- [ ] Full trace-replay snapshot test through fusion + ambiance (needs a richer trace)

## Phase 3 — UI shell, T0
- [x] i18n lookup module + fr-CA/en dicts (`i18n/index.js`, `strings.js`)
- [x] Hash router (`#/plan`, `#/list`, `#/repere/:id`, `#/carnet`, `#/settings`, query preserved)
- [x] Tier detection (CAP-1..3: T3 = camera + any live pose; CAP-2 denial memory)
- [x] Plan viewport math (pan/zoom, pinch anchor, fit, clamps)
- [x] Web Components: `<b-app>` outlet + nav (aria-current), `<b-plan>` canvas w/ tap-to-set-position + accuracy circle, `<b-list>` (text alternative, live distance/bearing), `<b-repere>` detail + check-in, `<b-carnet>`, `<b-settings>` (tier + PERM-5 statuses + PRIV-4 erase)
- [x] main.js wiring: bundle load + DATA-4 error card, PERM-6 ancre start pose, carnet persistence
- [x] Playwright T0 happy path — 6 e2e green (plan load, list→detail, manual position → distance/bearing, check-in → carnet persists, PERM-6 ancre, PERM-5 settings, DATA-4 error card)
- [ ] Pre-prompt sheets (PERM-1/9) — deferred to Phase 4 with the sensor shells they gate
- [ ] Repère search (M1)

**Test count: 190 unit + 16 e2e · tsc clean**

### Decisions made en route (Phase 3)
- 2026-09-17 — `ctx` (shared app context) typed as `any`: it is the DOM-glue boundary; strict typing stays in `src/lib/`.
- 2026-09-17 — e2e runs against a repo-root static server (`tools/serve.mjs`) so `/app/` and `/venues/` are both reachable without copying bundles.
- 2026-09-17 — Playwright config uses `testMatch: **/*.e2e.js` to keep vitest and Playwright suites disjoint.

## Phase 4 — Sensors, T1–T3
- [ ] 🚫 R1: iOS dual `requestPermission` chain verified on device
- [ ] 🚫 R2: `deviceorientationabsolute` device matrix
- [ ] 🚫 R3: FOV calibration feasibility
- [ ] 🚫 R11: audio unlock recipe verified on device
- [x] Step detection DSP (POS-3): Butterworth 1–3 Hz band-pass (RBJ biquads), local-max peak picking, median-of-confirmed adaptive threshold, 300 ms refractory, interval + cadence-consistency gates
- [x] **Map provider layer (PLAN-5..8)**: `BasemapSource` registry (osm + none; custom = one object), Web-Mercator tile math, visible-tile + tile→plan-px projection, layer stack (basemap → venue overlays → plan), canvas rendering in `<b-plan>`, schema support for `overlays` + `basemap` default, e2e (no third-party traffic by default)
- [x] **Cadran HUD (CAD-1..4)**: pure display-state module (bearing delta, distance text, hot/warm/cold ring with shape+pulse+colour per A11Y-1, manual/estimée labels, arrow dimming POS-4, haptic schedule CAD-3) + SVG component docked on the plan view; live via sim pose
- [x] **Permission denial e2e matrix (CAP-1/2, G2)**: zero-permission navigation completeness, settings PERM-5 states, no dead buttons, grant-without-pose keeps T0
- [x] **Sensor shells (TDD'd with injected APIs, ARCH-1)**: geolocation with PERM-4 60 s hidden pause/resume · orientation with PERM-2 iOS dual-permission chain + POS-2 absolute/webkitCompassHeading/relative-alpha fallback · camera PERM-3 (environment, no audio, release on hide/stop, denial → clean null) · wake lock AR-8 (re-acquire on visible) · audio PERM-7/8 (lazy AudioContext, silent-buffer unlock, re-unlock on later gesture)
- [x] `ctx.guide()` — the "Me guider" gesture chain wired in main.js (orientation prompts + geo watch + audio unlock in one tap), heartbeat for PERM-4; e2e covers T2 rise with mocked geolocation
- [ ] Pre-prompt sheets UI (PERM-1 visual pass; chain itself tested)
- [ ] Cadran heading from live sensors (works via guide() today; SVG present)
- [ ] AR overlay (AR-1..8) incl. jsQR ESM wrapper
- [x] Ambiance presentation state (AMB-3/4): plan cards / AR billboards / audio crossfade plan / video play-pause plan — pure, DOM wiring pending Phase 4 views
- [x] Debug panel (DEMO-3 UI): pose form, joystick+keys, walk-to-target, trace 1×/4×, live readout; `window.__boussoleDebug` exposed in debug mode for harnesses
- [x] E2e desk half of DEMO-4: walk-to-target converges ≤3 m (stable over 4 consecutive runs)
- [ ] Playwright denial matrix (Chromium) + `docs/device-checklist.md` for iOS

### Decisions made en route (Phase 4 so far)
- 2026-09-17 — POS-3 threshold is seeded only by gait-confirmed peaks: the filter warmup transient is indistinguishable from a first step and must never raise the adaptive threshold (hard-won: warmup spike 5.6 vs gait 2.7 m/s²).
- 2026-09-17 — Cadence gate: after 3 established intervals, a step must fall within ±50% of the median interval (kills 5 Hz alias rhythms).
- 2026-09-17 — Headless Chromium throttles background timers: e2e drives the sim via `window.__boussoleDebug.tick()`; UI tests assert on model state, not interval-driven DOM text.
- 2026-09-17 — Custom-element re-render pattern: parent sets `.ctx` then calls `_start()`/`render()` only if the element didn't self-initialize on connection (double-listener bug fixed).
- 2026-09-17 — Basemap layer spec'd as PLAN-5..8: opt-in per venue (`none` default keeps PRIV-1 true), OSM only shipped provider, venue-declared georeferenced overlay images between basemap and plan, tile URLs snapped to viewport bounds (never pose).

## Phase 5 — PWA + venue (M0 gate)
- [ ] Forge minimal: `validate` + `hash` subcommands (pulled ahead)
- [ ] `tools/gen-precache.mjs` + full sw.js (OFF-1, DATA-3)
- [ ] Montmorency pavillon A bundle + entrance QR (DEMO-1/2, PERM-6)
- [ ] Offline e2e (OFF-1)
- [ ] **M0 acceptance: DEMO-4 desk + on-site**

## Phase 6 — Forge full (post-M0)
- [ ] `init`, `slice` (PLAN-4), `qr-sheet` PDF

## Decisions made en route
- 2026-09-17 — Stack: no build step, pure JS ESM + Web Components, zero runtime deps (see sdd.md §13).
- 2026-09-17 — `tsc --checkJs` scoped to `src/` only; test files are exercised by vitest, not typechecked (JSDoc noise in tests outweighed the value).
- 2026-09-17 — Pose `estimated` flag recomputed on every read (time-dependent, POS-9), not snapshotted at emit time.
- 2026-09-17 — Circular-EMA jump ≥170° snaps instead of lerping (POS-2 edge case, specified in plan Phase 1).

## Risks (from plan)
| Risk | State |
| --- | --- |
| iOS permission chain differs from spec | open — R1 before Phase 4 sensor code |
| `deviceorientationabsolute` unreliable | open — R2, fallback already in POS-2 |
| FOV calibration UX | open — R3, 65° default ships regardless |
| Scope creep past M0 | roadmap gates enforced here |
