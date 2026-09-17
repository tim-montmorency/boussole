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

**Test count: 119 unit + 6 e2e · tsc clean**

### Decisions made en route (Phase 3)
- 2026-09-17 — `ctx` (shared app context) typed as `any`: it is the DOM-glue boundary; strict typing stays in `src/lib/`.
- 2026-09-17 — e2e runs against a repo-root static server (`tools/serve.mjs`) so `/app/` and `/venues/` are both reachable without copying bundles.
- 2026-09-17 — Playwright config uses `testMatch: **/*.e2e.js` to keep vitest and Playwright suites disjoint.

## Phase 4 — Sensors, T1–T3
- [ ] 🚫 R1: iOS dual `requestPermission` chain verified on device
- [ ] 🚫 R2: `deviceorientationabsolute` device matrix
- [ ] 🚫 R3: FOV calibration feasibility
- [ ] 🚫 R11: audio unlock recipe verified on device
- [ ] Sensor shells: geolocation (PERM-4), orientation/motion (PERM-2), camera (PERM-3) + wake lock (AR-8), audio unlock (PERM-7/8), haptics (CAD-3)
- [ ] Cadran SVG HUD (CAD-1..4)
- [ ] AR overlay (AR-1..8) incl. jsQR ESM wrapper
- [ ] Ambiance presentation (AMB-1/3/4 rendering) — owns DEMO-4 media playback
- [ ] Debug panel (DEMO-3 UI)
- [ ] Playwright denial matrix (Chromium) + `docs/device-checklist.md` for iOS

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
