import { test, expect } from '@playwright/test';

// The \"Me guider\" gesture chain (PERM-1/2/7): orientation prompt (mocked
// granted on Chromium), geolocation watch starts, audio unlock attempted,
// fusion receives live GPS fixes → tier rises to T2.

/** Wait for the app context to be exposed, then call guide(). */
async function callGuide(page) {
  await page.waitForFunction(() => /** @type {any} */ (window).__ctx?.guide);
  await page.evaluate(() => /** @type {any} */ (window).__ctx.guide());
}

test.describe('Me guider gesture chain', () => {
  test('guide() starts geolocation and fusion receives fixes (T2)', async ({ browser }) => {
    const context = await browser.newContext({
      permissions: ['geolocation'],
      geolocation: { latitude: 45.5577, longitude: -73.7157, accuracy: 6 },
    });
    const page = await context.newPage();
    await page.goto('./');
    // trigger the gesture chain directly (the pre-prompt sheet lands with the
    // Phase 4 UI pass; the chain itself is what we test here)
    await callGuide(page);
    // GPS fix arrives → pose is gps-sourced, tier T2
    await page.getByRole('button', { name: 'Réglages' }).click();
    await expect(page.locator('#tier')).toHaveText('T2');
    await page.getByRole('button', { name: 'Plan' }).click();
    // live GPS pose is neither manual nor estimated → no label
    await expect(page.locator('.pos-label')).toHaveText('');
    await context.close();
  });

  test('guide() without geolocation permission keeps tier at T1-or-below', async ({ page }) => {
    await page.goto('./');
    await callGuide(page);
    await page.getByRole('button', { name: 'Réglages' }).click();
    const tier = await page.locator('#tier').textContent();
    expect(['T0', 'T1']).toContain(tier); // no GPS fix → never T2
  });
});
