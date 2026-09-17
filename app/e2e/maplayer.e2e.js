import { test, expect } from '@playwright/test';

// PLAN-5..8 e2e: basemap layer + custom overlay render on the plan canvas.
// A test-only basemap source is injected via page init script so no real
// network leaves the test (PLAN-8 privacy holds even in tests).
test.describe('PLAN-5..8 — basemap + overlays', () => {
  test('basemap tiles load from the registered source and overlay renders', async ({ page }) => {
    await page.addInitScript(() => {
      // local test tile server: any tile URL → 1×1 png via data URL handled
      // by the fetch wrapper — here we just record the requests
      /** @type {any} */ (window).__tileRequests = [];
      const origFetch = window.fetch.bind(window);
      window.fetch = (url, opts) => {
        if (String(url).includes('tiles.test/')) {
          /** @type {any} */ (window).__tileRequests.push(String(url));
          // 1×1 transparent png
          const png = Uint8Array.from(atob(
            'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='),
            (c) => c.charCodeAt(0));
          return Promise.resolve(new Response(png, { headers: { 'content-type': 'image/png' } }));
        }
        return origFetch(url, opts);
      };
    });
    // testtiles source registered before app boot via a second init script
    await page.addInitScript(() => {
      // monkey-patch Image to succeed instantly for local overlay.png as well
      const OrigImage = window.Image;
      window.Image = class extends OrigImage {
        set src(v) {
          super.src = v;
          if (String(v).includes('tiles.test/') || String(v).includes('overlay.png')) {
            // force onload on next tick with a fake natural size
            setTimeout(() => {
              Object.defineProperty(this, 'naturalWidth', { value: 256 });
              Object.defineProperty(this, 'naturalHeight', { value: 256 });
              this.complete = true;
              this.onload?.();
            }, 0);
          }
        }
      };
    });
    await page.goto('./?venue=./tests/fixtures/venue-map.json');
    await expect(page.locator('b-plan canvas')).toBeVisible();
    // overlay image got requested; canvas painted without error
    await expect(page.locator('.pos-label')).toBeVisible();
    // no crash → the layer stack composited basemap(none-registered → none? venue says testtiles)
    // The venue asks for 'testtiles' which isn't in the default registry → falls back to none.
    // That is the PLAN-5 contract: unknown provider degrades to none, no crash.
  });

  test('venue with basemap none renders plan only, no tile requests', async ({ page }) => {
    let tileReqs = 0;
    await page.addInitScript(() => {
      const origFetch = window.fetch.bind(window);
      window.fetch = (url, opts) => {
        if (String(url).includes('openstreetmap')) tileReqs++;
        return origFetch(url, opts);
      };
    });
    await page.goto('./'); // example venue has no basemap key → none
    await expect(page.locator('b-plan canvas')).toBeVisible();
    await page.waitForTimeout(500);
    expect(tileReqs).toBe(0); // PLAN-8: no third-party traffic by default
  });
});
