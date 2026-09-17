# Research register — boussole

Open questions whose answers could change design decisions in [sdd.md](sdd.md). Each entry has an owner question, the SDD sections it affects, candidate sources, and the expected output (usually: a short decision note appended to §13, plus spec edits).

Priorities: **P0** blocks M0 demo, **P1** blocks M1–M3, **P2** blocks M4–M6.

- Status: created 2026-09-17 · all entries open unless marked otherwise

---

## R1 — iOS orientation & motion permission behaviour (P0)

**Question.** Confirm exact behaviour of `DeviceOrientationEvent.requestPermission()` and `DeviceMotionEvent.requestPermission()` on iOS 17+: can both be called in one gesture? What happens on denial — sticky or re-promptable? Does the grant survive reload?

**Affects.** PERM-2, PERM-7, PERM-9, POS-3 (dead reckoning depends on the motion grant).

**Sources.**

- MDN — <https://developer.mozilla.org/en-US/docs/Web/API/DeviceOrientationEvent/requestPermission>
- MDN — <https://developer.mozilla.org/en-US/docs/Web/API/DeviceMotionEvent/requestPermission>
- WebKit blog, motion & orientation access changes — <https://webkit.org/blog/8479/release-notes-for-safari-technology-preview-62/>

**Expected output.** Verified flow for the "Me guider" gesture; test on a physical iPhone, not the simulator.

## R2 — Reliability of `deviceorientationabsolute` on Android (P0)

**Question.** On which share of Android Chrome devices does the event fire with `absolute: true`? What does relative `alpha` drift look like in practice? Is the fallback in POS-2 (re-base on ancre) sufficient?

**Affects.** POS-2, POS-5, PLAN-2 (heading-up), CAD-1.

**Sources.**

- W3C DeviceOrientation spec — <https://w3c.github.io/deviceorientation/>
- MDN — <https://developer.mozilla.org/en-US/docs/Web/API/DeviceOrientationEvent/absolute>
- Chromium issue tracker (search: deviceorientation absolute) — <https://issues.chromium.org/issues?q=deviceorientationabsolute>

**Expected output.** Device test matrix (≥3 Android phones); decide whether "low-confidence heading" UI is common enough to design properly.

## R3 — Camera horizontal FOV determination (P0)

**Question.** Is there any web API path to real camera FOV (`MediaTrackSettings`, `MediaTrackCapabilities`)? If not, validate the AR-2 calibration protocol: accuracy achievable by one ancre-pointing gesture.

**Affects.** AR-2, DEMO-4 (±10° acceptance).

**Sources.**

- W3C Media Capture and Streams — <https://w3c.github.io/mediacapture-main/>
- MDN MediaTrackSettings — <https://developer.mozilla.org/en-US/docs/Web/API/MediaTrackSettings>
- Can I Use: camera/microphone constraints — <https://caniuse.com/stream>

**Expected output.** Decision: ship calibration in M0 or defer; documented assumed-FOV error budget.

## R4 — Indoor heading quality of phone magnetometers (P1)

**Question.** How bad is compass heading inside steel-frame buildings (the Montmorency case)? What variance threshold and calibration UX actually work? Is the POS-5 threshold (25° over 2 s) realistic?

**Affects.** POS-2, POS-5, CAD-1, AR-2.

**Sources.**

- Harle, R., "A Survey of Indoor Inertial Positioning Systems for Pedestrians", *IEEE Communications Surveys & Tutorials*, 2013 — <https://doi.org/10.1109/SURV.2012.121912.00075>
- IndoorAtlas, magnetic positioning technology overview — <https://www.indooratlas.com/technology/>
- Apple Support, compass calibration — <https://support.apple.com/en-ca/HT203422>

**Expected output.** Tuned variance threshold; on-site measurement trace added to `fixtures/traces/`.

## R5 — Indoor `watchPosition` behaviour (P1)

**Question.** Empirically: indoors on iOS Safari and Android Chrome, how often does `watchPosition` deliver no fix at all (POS-9 case) vs. fixes with huge `accuracy`? Any browser-specific quirks (timeout, cached fixes)?

**Affects.** POS-1, POS-9, CAP-3.

**Sources.**

- MDN Geolocation API — <https://developer.mozilla.org/en-US/docs/Web/API/Geolocation_API>
- GPS.gov, GPS accuracy — <https://www.gps.gov/systems/gps/performance/accuracy/>
- Apple Core Location accuracy — <https://developer.apple.com/documentation/corelocation/cllocationaccuracy>

**Expected output.** Field notes from Montmorency pavillon A; confirm or adjust the 15 s silence threshold and the 30 m accuracy cut-off.

## R6 — Step detection / pedestrian dead reckoning in the browser (P1)

**Question.** Is DeviceMotion accel sampling on iOS/Android consistent enough (rate, units, screen-off behaviour) for the POS-3 band-pass approach? Expected DR drift vs. the M2 target (≤8 m over 50 m)?

**Affects.** POS-3, M2 acceptance.

**Sources.**

- MDN DeviceMotionEvent — <https://developer.mozilla.org/en-US/docs/Web/API/DeviceMotionEvent>
- Kang, W. & Han, Y., "SmartPDR: Smartphone-Based Pedestrian Dead Reckoning for Indoor Localization", *IEEE Sensors Journal*, 2015 — <https://doi.org/10.1109/JSEN.2014.2382568>

**Expected output.** Validated filter parameters and stride-length defaults; honest statement of achievable DR drift.

## R7 — Video loop codec policy (P1)

**Question.** Resolve the open question in §13: does iOS Safari 17+ play VP9/WebM in a plain `<video>` element (not just MSE/WebCodecs)? If not, is H.264 MP4 the single-codec answer, and what does that cost in quality/size at the AMB-1 budget (≤10 MB, ≤15 s)?

**Affects.** AMB-1, DATA-3, venue authoring docs.

**Sources.**

- Can I Use: WebM — <https://caniuse.com/webm>
- WebKit feature status — <https://webkit.org/status/>
- WebKit blog, Safari 14.1 (VP9 via MSE on macOS) — <https://webkit.org/blog/11365/new-webkit-features-in-safari-14-1/>

**Expected output.** One-line codec policy in AMB-1; authoring guidance in the forge README.

## R8 — QR scanning without `BarcodeDetector` (P1)

**Question.** Measure jsQR CPU cost at 320 px / 5 fps on a mid-range iPhone; confirm detection rate for printed ancres at typical arm's length. Is 5 fps enough for a good "scan" feel?

**Affects.** AR-6, PERF-2.

**Sources.**

- jsQR — <https://github.com/cozmo/jsQR>
- WICG Shape Detection API — <https://wicg.github.io/shape-detection-api/>
- Can I Use: BarcodeDetector — <https://caniuse.com/mdn-api_barcodedetector>

**Expected output.** Confirm or adjust AR-6 parameters; battery measurement note for PERF-2.

## R9 — Screen Wake Lock support (P2)

**Question.** Confirm Screen Wake Lock API availability and lifecycle quirks on iOS Safari 17+ and Android Chrome (re-acquire after tab switch, refusal when battery saver on).

**Affects.** AR-8.

**Sources.**

- MDN Screen Wake Lock API — <https://developer.mozilla.org/en-US/docs/Web/API/Screen_Wake_Lock_API>
- Can I Use: WakeLock — <https://caniuse.com/mdn-api_wakelock>

**Expected output.** Confirm AR-8 as written or downgrade to "nice-to-have".

## R10 — iOS storage eviction risk for offline PWA (P1)

**Question.** Under what conditions does iOS evict IndexedDB/service-worker caches of an installed-but-unused PWA (ITP 7-day rule and successors)? Does G4 ("fully offline after first load") need a caveat for venues with infrequent visitors?

**Affects.** G4, OFF-1, PRIV-4.

**Sources.**

- WebKit blog, full third-party cookie blocking and storage policies — <https://webkit.org/blog/10218/full-third-party-cookie-blocking-and-more/>
- MDN, storage quotas and eviction — <https://developer.mozilla.org/en-US/docs/Web/API/Storage_API/Storage_quotas_and_eviction_criteria>
- WebKit blog, web apps on iOS 16.4+ — <https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/>

**Expected output.** Note in §10 on cache longevity; possibly a "re-warm the cache" hint for venue staff.

## R11 — Autoplay/AudioContext unlock specifics (P0)

**Question.** Verify that one silent-buffer `resume()` inside the "Me guider" gesture durably unlocks `AudioContext` on iOS 17 and Chrome Android, including after navigation between views (PERM-7/8). Edge cases: page reload, PWA cold start.

**Affects.** PERM-7, PERM-8, AMB-1/AMB-4, DEMO-4.

**Sources.**

- Chrome autoplay policy — <https://developer.chrome.com/blog/autoplay/>
- WebKit autoplay policy — <https://webkit.org/blog/7734/auto-play-policy-changes-for-macos/>
- MDN, autoplay guide — <https://developer.mozilla.org/en-US/docs/Web/Media/Guides/Autoplay>

**Expected output.** Device-tested unlock recipe; note any case requiring the PERM-8 re-unlock path.

## R12 — Affine georeference accuracy from 3 control points (P2)

**Question.** Error propagation of a least-squares affine fit from 3–5 hand-measured control points over a ~100 m building: what positional error should authors expect mid-plan? How many control points should the forge recommend?

**Affects.** PLAN-1, geometry module, forge CLI.

**Sources.**

- QGIS georeferencer documentation (transformation types) — <https://docs.qgis.org/latest/en/docs/user_manual/working_with_raster/georeferencer.html>
- Movable Type, latitude/longitude calculations — <https://www.movable-type.co.uk/scripts/latlong.html>

**Expected output.** Authoring guideline (min. control points, placement advice) and a max-expected-error number for the venue README template.

## R13 — M6 first non-standard position source (P2)

**Question.** Resolve the open question in §13: Web Bluetooth beacons (Android-only, no iOS) vs. a venue-side positioning feed over WebSocket/mDNS (works everywhere on the LAN, but conflicts with "no network after install" unless scoped). Compare implementation cost, accuracy, and maintenance.

**Affects.** POS-7, M6, PRIV-1/OFF-1 (WebSocket option needs a CSP exception).

**Sources.**

- Web Bluetooth — <https://developer.mozilla.org/en-US/docs/Web/API/Web_Bluetooth_API> · <https://caniuse.com/web-bluetooth>
- Wi-Fi RTT (Android, for context) — <https://developer.android.com/develop/connectivity/wifi/wifi-rtt>

**Expected output.** M6 scope decision recorded in §13.
