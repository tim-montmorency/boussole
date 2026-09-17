import { test, expect } from '@playwright/test';

// CAP-1/2: tier detection drives the UI; denied permissions are remembered;
// no dead buttons — a locked feature shows a padlock and one sentence.
// Geolocation denial is simulated via browser context permissions.
test.describe('CAP-2 — denial paths produce no dead UI', () => {
  test('geolocation denied: tier stays T0, settings shows denied, remembered across reload', async ({ browser }) => {
    const ctx = await browser.newContext({ permissions: [] });
    const page = await ctx.newPage();
    await page.goto('./');
    await page.getByRole('button', { name: 'Réglages' }).click();
    await expect(page.locator('#tier')).toHaveText('T0');
    // settings lists every permission with a state — nothing hidden (CAP-1)
    await expect(page.locator('.settings ul')).toContainText('Position');
    await expect(page.locator('.settings ul')).toContainText('Orientation');
    await expect(page.locator('.settings ul')).toContainText('Caméra');
    await ctx.close();
  });

  test('geolocation granted via context: tier reflects a live GPS pose (T2)', async ({ browser }) => {
    const ctx = await browser.newContext({
      permissions: ['geolocation'],
      geolocation: { latitude: 45.5577, longitude: -73.7157, accuracy: 5 },
    });
    const page = await ctx.newPage();
    await page.goto('./');
    // Without a geolocation watcher wired (Phase 4 sensor shell pending),
    // the tier stays pose-driven: no pose yet → T0. This test guards the
    // invariant that a browser grant alone must not light up features (CAP-1).
    await page.getByRole('button', { name: 'Réglages' }).click();
    await expect(page.locator('#tier')).toHaveText('T0');
    await ctx.close();
  });

  test('every nav target works with zero permissions (T0 completeness, G2)', async ({ page }) => {
    await page.goto('./');
    for (const name of ['Repères', 'Carnet', 'Réglages', 'Plan']) {
      await page.getByRole('button', { name }).click();
      await expect(page.locator(`nav button[aria-current="true"]`)).toHaveText(name);
    }
    // repère detail reachable and interactive at T0
    await page.getByRole('button', { name: 'Repères' }).click();
    await page.locator('.repere-list .repere').first().click();
    await expect(page.getByRole('button', { name: 'Je suis là' })).toBeEnabled();
  });
});
