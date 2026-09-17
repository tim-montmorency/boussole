// Entry point — loads the venue bundle (DATA-4 error card on failure),
// builds the shared context, and mounts <b-app>. No build step: plain ESM.
import { createRouter } from './lib/router.js';
import { createI18n } from './lib/i18n/index.js';
import { dicts } from './lib/i18n/strings.js';
import { validate } from './lib/content/validate.js';
import { fitAffine } from './lib/geometry/affine.js';
import { createFusion } from './lib/fusion/fuse.js';
import { createAmbianceEngine } from './lib/ambiance/engine.js';
import { observable } from './lib/store/observable.js';
import { idbStore } from './lib/store/idb.js';
import { loadCarnet, saveCarnet } from './lib/store/carnet.js';
import { computeTier } from './lib/tiers.js';
import { enuFrame } from './lib/geometry/geo.js';
import './components/b-app.js';

const params = new URLSearchParams(location.search);
const venueUrl = params.get('venue') ?? '../venues/example/venue.json';

async function boot() {
  const i18n = createI18n(dicts, 'fr-CA');
  const router = createRouter(window);

  let bundle = null;
  let bundleError = null;
  try {
    const [schema, data] = await Promise.all([
      fetch('./schemas/venue.schema.json').then((r) => r.json()),
      fetch(venueUrl).then((r) => r.json()),
    ]);
    const res = validate(data, schema);
    if (res.ok) bundle = data; else bundleError = res;
  } catch (err) {
    bundleError = { errors: [{ file: venueUrl, rule: 'fetch', message: String(err) }] };
  }

  // Shared context (T0-safe: everything below tolerates bundle === null).
  // Typed as `any`: this is the DOM-glue boundary; the typed core lives in lib/.
  const perms = observable({ geo: 'unknown', orientation: 'unknown', camera: 'unknown' });
  const carnet = observable(/** @type {import('./lib/types.js').CarnetState | null} */ (null));
  /** @type {any} */
  const ctx = {
    i18n, router, bundle, bundleError, perms, carnet,
    pose: observable(null),
    tier: observable('T0'),
    geoRef: null, fusion: null, ambiance: null, mPerPx: 0.1,
    setManualPose() {}, checkin() {}, async eraseAll() {},
  };

  if (bundle) {
    const geoRef = fitAffine(bundle.plan.controlPoints);
    const frame = enuFrame(bundle.origin);
    const a = frame.toENU(bundle.origin);
    const b = geoRef.forward(bundle.plan.width, 0);
    const bb = frame.toENU(b);
    ctx.geoRef = geoRef;
    ctx.mPerPx = Math.abs(bb.e - a.e) / bundle.plan.width || 0.1;

    const fusion = createFusion();
    ctx.fusion = fusion;
    ctx.pose = fusion.pose;
    ctx.ambiance = createAmbianceEngine(bundle);

    const store = idbStore(`boussole:${bundle.id}`);
    const state = await loadCarnet(store, bundle.id);
    carnet.set(state);
    if (state.permissions) perms.set({ ...perms.value, .../** @type {any} */ (state.permissions) });

    const persist = async () => saveCarnet(store, /** @type {import('./lib/types.js').CarnetState} */ (carnet.value));
    const refreshTier = () => ctx.tier.set(
      computeTier(/** @type {any} */ (perms.value), fusion.pose.value != null));
    fusion.pose.subscribe(refreshTier);
    perms.subscribe(refreshTier);
    refreshTier();

    ctx.setManualPose = (/** @type {{ lat: number, lon: number }} */ p) => {
      fusion.handleFix({ kind: 'manual', lat: p.lat, lon: p.lon, accuracy: 4, t: Date.now() });
    };
    ctx.checkin = (/** @type {string} */ repereId) => {
      const accuracy = fusion.pose.value?.accuracy ?? 99;
      const ev = ctx.ambiance.manualCheckin(repereId, accuracy, Date.now());
      const s = /** @type {import('./lib/types.js').CarnetState} */ (carnet.value);
      s.encountered[repereId] = { at: ev.at, method: ev.method, verified: ev.verified };
      carnet.set({ ...s });
      return persist();
    };
    ctx.eraseAll = async () => {
      await store.del(`state:${bundle.id}`);
      await store.del(`state:${bundle.id}:prev`);
      indexedDB.deleteDatabase(`boussole:${bundle.id}`);
      localStorage.clear();
    };

    // Entrance QR may carry ?ancre=<id> (PERM-6): a T0 visitor gets a start pose.
    const ancreId = params.get('ancre');
    const ancre = (bundle.ancres ?? []).find((/** @type {any} */ x) => x.id === ancreId);
    if (ancre && !fusion.pose.value) {
      fusion.handleFix({ kind: 'ancre', lat: ancre.lat, lon: ancre.lon, accuracy: 1, t: Date.now() });
    }
  }

  const app = /** @type {any} */ (document.createElement('b-app'));
  app.ctx = ctx;
  document.querySelector('main')?.replaceChildren(app);
}

boot();

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('./sw.js').catch(() => {});
}
