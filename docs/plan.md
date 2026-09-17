# Implementation plan — boussole

Derived from [sdd.md](sdd.md) v0.3. Ordered so that every step leaves the repo green (tests pass) and demoable. TDD throughout: test file first, watch it fail, implement, refactor.

- Status: v0.3 — 2026-09-17 (**no build step, pure JS**: native ES modules + Web Components; dev-only tooling is vitest + tsc --checkJs + Playwright). Reviewed and revised after subagent critique.
- **Scope: this plan ends at M0 (DEMO-4) + Forge CLI.** M1–M4/M6 get their own plans after M0; only their spec-deferred stubs are listed at the end.

---

## Guiding constraints (from SDD)

- ARCH-1: browser APIs only in `sensors/`; everything else testable in Node.
- ARCH-2: fusion consumes a `PositionSource` registry, never concrete sources.
- No runtime dependencies: app code is pure ESM served as-is; validation, IndexedDB access and observables are hand-rolled (~100 lines each max).
- M0 is the gate: one venue, one destination, T0–T3, debug pose, north-up/heading-up.
- Shared JSDoc typedefs live in `src/lib/types.js` (`Pose`, `CarnetState`, `Tableau`, `VenueBundle`) — decided in Phase 0 to keep `tsc --checkJs` noise down. All imports use explicit `.js` extensions. `tsc` is scoped to `src/`; test files are exercised by vitest, not typechecked.
- Research items R1, R2, R3, R11 are P0 ([research.md](research.md)) and run in parallel with code; none block starting, all block M0 acceptance.

## Phase 0 — Scaffold (½ day)

1. `app/`: static site skeleton — `index.html`, `manifest.webmanifest`, hand-written `sw.js` stub, `src/lib/` module dirs, `src/components/` (Web Components, `customElements.define`). All imports are relative ESM paths; no bundler, no transpiler.
2. Dev tooling (dev-only, never shipped): `vitest` (Node env for `src/lib` pure modules), `tsc --noEmit --checkJs` over JSDoc, ESLint, Playwright. `npm test`, `npm run check`.
3. CI skeleton `.woodpecker.yml`: lint, typecheck, unit, e2e (deferred to Phase 3), deploy = rsync of sources.
4. `schemas/venue.schema.json` — first artifact written, from SDD §9 (with `media` hash map, ASCII enums, `version` in carnet).
5. `src/lib/store/observable.js` and `src/lib/store/idb.js` — the two tiny hand-rolled primitives everything else builds on (TDD'd first).
6. HTTPS for dev: `mkcert`-generated local cert + a static server that supports it (`npx serve` or 20 lines of Node) — geolocation, camera, orientation and SW all require a secure context; plain `http.server` only works on localhost.

**Exit:** `npm run check && npm test` green on skeleton; `https://localhost` serves a working blank app. (Schema validation of the example bundle moves to Phase 1 exit — the validator doesn't exist yet.)

## Phase 1 — Pure core (TDD, no DOM) (2–3 days)

In dependency order, each module = pure TS + vitest:

1. **`geometry/`** — haversine, initial bearing, ENU frame around origin (POS-6), affine transform from control points: exact solve at 3 points, least-squares above, collinear-set rejection and residual report (PLAN-1, feeds forge), `px ↔ latlon`, circular mean/EMA for angles with specified edge cases — cold start, 180° jump after calibration, re-base of relative alpha on ancre reset, and raw-stream window feeding POS-5 variance before smoothing.
2. **`store/`** — typed state atom (observable behind an interface), `CarnetState` schema + migrations from `version`, IndexedDB adapter behind an interface with an in-memory fake for Node tests; single-`put` + `prev` backup (DATA-1).
3. **`content/`** — hand-rolled schema-subset validation of the venue bundle (DATA-4 failure shape), media hash verification **verify-on-fetch**: hashes are checked when a media file is first fetched (SW/fetch wrapper), result cached per file — never a bulk upfront download, keeping DATA-3's lazy cache honest (DATA-2, WebCrypto `SHA-256` — available in Node 18+ and browsers), localized-name resolution (fr-CA → en fallback).
3b. **Trace format pinned here** (needed by fusion and Phase 2 snapshot tests): `.jsonl`, one JSON object per line, `{ "t": <ms since start>, "source": "gps|orientation|motion|ancre|manual", "payload": {…} }`; first line may be a header `{ "meta": { venue, device } }`.
4. **`fusion/`** — `PositionSource` interface (POS-7), registry with priority sort, fusion rules POS-1 (accuracy gates, ancre reset), POS-4 (accuracy > 15 m → dim + suggest nearest ancre), POS-9 (15 s GPS silence → "position estimée" + ancre suggestion), pose at ≥10 Hz from source events; `SimPositionSource` (POS-8, DEMO-3 inputs: lat/lon/heading/accuracy/stride, joystick steps, walk-to-target at 1.2 m/s, `.jsonl` trace playback at 1×/4× per the pinned format).
5. **`sensors/` adapters — Node-testable half:** math and state machines only (heading EMA application, screen-orientation offset, step band-pass filter 1–3 Hz + adaptive threshold, POS-3). Raw browser event wiring is a thin shell tested later on devices.

**Exit:** ~all pure logic of the app covered by unit tests run in Node; `SimPositionSource` can drive a full simulated visit in a test; example venue bundle validates against the schema.

## Phase 2 — Ambiance engine (TDD, no DOM) (1–2 days)

1. `ambiance/` — pure reducer over `{ pose, heading, now, bundle, carnet }` → list of active tableau states: `approche` intensity ramp, `arrivée` on `captureRadius` enter, `regard` bearing window ±15°, `zone` point-in-polygon (AMB-2); one-`son`-at-a-time arbitration + 1.5 s crossfade scheduling (AMB-4); carnet encounter recording with `method` and unverified flag (AMB-5).
2. Trace-driven tests: replay `fixtures/traces/*.jsonl` through fusion + ambiance and snapshot the tableau/carnet timeline (ARCH-1).

**Exit:** M3's logic fully testable headlessly.

## Phase 3 — UI shell, T0 (2 days)

1. Routes: hash-based routing (`#/plan`, `#/list`, `#/repere/:id`, `#/carnet`, `#/settings`) — no router dependency, ~40 lines; views are Web Components (`<b-plan>`, `<b-list>`, …) including the DATA-4 validation error card.
2. `plan/` canvas renderer: pan/zoom, markers, accuracy circle, north-up (PLAN-1..3); heading-up wiring present but dormant until sensors.
3. Tier detection service (CAP-1..3), pre-prompt sheets incl. the "Boussole seule" action (PERM-1, PERM-9), permission state store incl. denied-flag memory (CAP-2) and the PERM-5 settings status screen.
4. Accessibility scaffolding from day one: list alternative to canvas, ARIA live region, 44 pt targets (A11Y-1..4).
5. `i18n/` — tiny lookup module (`t(key, lang)`, fr-CA default, en fallback) with a no-hardcoded-strings lint convention; retrofitting later is not allowed.
6. Playwright: T0 happy path — load venue, browse list, tap repère, manual position set, bearing/distance text correct.

**Exit:** M1 substance minus offline hardening; e2e green in mobile emulation.

## Phase 4 — Sensors, tiers T1–T3 (2–3 days, needs devices)

1. `sensors/` thin shells: geolocation (PERM-4 visibility pause), orientation incl. iOS dual `requestPermission` chain + motion fallback (PERM-2, POS-2), motion → step events, camera with lifecycle (PERM-3) + wake lock (AR-8), audio unlock in the "Me guider" gesture (PERM-7/8), haptics (CAD-3).
2. `cadran/` SVG HUD: rose, target arrow, distance, hot/cold ring with non-colour encoding (CAD-1/2, A11Y-1), "position manuelle/estimée" labels (CAD-4, CAP-3), calibrer hint (POS-5), PERM-8 tap-to-re-unlock of audio.
3. `ar/`: video + overlay canvas, bearing→x projection with FOV calibration flow (AR-2..5), edge chevrons (AR-3), BarcodeDetector/jsQR worker scanner (AR-6 — budget a small ESM wrapper: jsQR ships UMD), perf caps (PERF-1/2).
4. **Ambiance presentation** (owns AMB-1/3/4 rendering — required by DEMO-4): media elements driven by the Phase 2 reducer — AR billboards for `image`/`boucle`, plan-view bottom card, video loop playback on `regard`, `son` through the unlocked `AudioContext` with 1.5 s crossfades.
5. Debug panel (DEMO-3) behind `?debug=1` / 5-tap: pose inputs, joystick/keys, walk-to-target, trace loader, readout.
6. Playwright: permission-denial matrix **on Chromium** (every denial path, no dead UI), tier transitions, plan north-up↔heading-up. iOS-only paths (`requestPermission`, `webkitCompassHeading`) can't be driven by Playwright → explicit on-device manual checklist, kept in `docs/device-checklist.md`.

**Exit (desk-complete):** M0 functionally complete on laptop emulation, e2e matrix green on Chromium. **Exit (device-verified):** DEMO-4 pass on iPhone + Android on site — gated on research R1, R2, R3, R11. Phase 4 is realistically 3–4 days, not 2–3.

## Phase 5 — PWA hardening + venue (1–2 days)

0. **Forge `validate` + `hash` land first** (pulled out of Phase 6): the Montmorency bundle needs hashing and georeference residuals before it can exist. Minimal Rust CLI with just these two subcommands; the rest of forge stays in Phase 6.
1. Service worker: precache shell, bundle `stale-while-revalidate`, lazy media cache (DATA-3), installable manifest (OFF-1), "Tout effacer" (PRIV-4), strict CSP meta (SEC-1). With no build step, the precache file list is generated by a **dev-only script** (`tools/gen-precache.mjs` — walks `src/`, emits the list into `sw.js`) run on change; the alternative (install-time import-graph crawl) is rejected as too fragile.
2. `venues/montmorency-A/`: georeferenced plan, one ancre, one destination repère with `boucle` + `texte` tableaux, entrance QR (PERM-6).
3. TLS recipe for on-phone LAN testing documented (`docs/dev-https.md`): mkcert for the dev machine; for the Pi (OFF-2), a self-signed CA install note — iOS refuses everything over plain HTTP on the LAN.
4. Offline e2e: first load → airplane mode → full navigation (M1 acceptance).

**Exit:** **M0 acceptance (DEMO-4)** on laptop emulation + on-site phone.

## Phase 6 — Forge CLI (Rust) (2 days, parallel-safe)

1. `boussole-forge`: `validate` (schema + hashes + georeference residual report), `init`, `hash`, `slice` (>4096 px pyramid, PLAN-4), `qr-sheet` (ancre/repère PDFs).
2. Golden-file tests against `venues/example/`.

**Exit:** M5 early — an author can build the demo bundle without touching the app.

## Cross-cutting

- Every phase ends with: tests green, roadmap updated, commit pushed.
- Device research sessions (R1, R2, R3, R11) scheduled at start of Phase 4; findings may adjust POS-2/5 and PERM-2 — spec edits land before sensor code.
- Definition of done per requirement: unit test or e2e test named after the requirement ID (e.g. `PERM-4.test.ts`), so SDD ↔ suite traceability is by filename search.

## Post-M0 stubs (own plans later)

- **M1 — Plan complet:** repère search (T0), offline hardening remainder, basemap settings UI (provider picker, overlay toggles, PLAN-8 attribution display).
- **M2 — Position:** DR tuning against device traces, multiple ancres, accuracy UI polish.
- **M3 — Ambiance:** zones, parcours progression, full tableau catalogue; PERF-3 thermal acceptance.
- **M4 — Parcours & carnet:** export/import UI (AMB-8), completion rules (open question in §13).
- **M6 — Sources:** first non-standard `PositionSource` (decision per R13).

## Risks (tracked in roadmap)

| Risk | Mitigation |
| --- | --- |
| iOS permission chain behaves differently than specced (R1, R11) | Research first in Phase 4; keep sensor shells thin so flow changes are cheap |
| `deviceorientationabsolute` unreliable (R2) | POS-2 fallback already specced; test matrix early |
| FOV calibration UX flops (R3) | Ship with 65° default + edge-error cap; calibration optional |
| Scope creep into M1+ features | Roadmap gates: M0 PR merges only DEMO-* acceptance items |
