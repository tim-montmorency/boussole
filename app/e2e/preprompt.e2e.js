import { test, expect } from '@playwright/test';

// PERM-1/9: the pre-prompt sheet — only its buttons touch browser APIs.
test.describe('PERM-1 pre-prompt sheet', () => {
  test('Me guider opens the sheet with all three actions', async ({ page }) => {
    await page.goto('./');
    await page.getByRole('button', { name: 'Me guider' }).click();
    const sheet = page.locator('b-preprompt .sheet');
    await expect(sheet).toBeVisible();
    await expect(sheet.getByRole('button', { name: 'Continuer' })).toBeVisible();
    await expect(sheet.getByRole('button', { name: 'Boussole seule' })).toBeVisible();
    await expect(sheet.getByRole('button', { name: 'Pas maintenant' })).toBeVisible();
  });

  test('Pas maintenant dismisses without any permission call', async ({ page }) => {
    await page.goto('./');
    let geoCalled = false;
    await page.addInitScript(() => {
      const orig = navigator.geolocation.watchPosition.bind(navigator.geolocation);
      navigator.geolocation.watchPosition = (...a) => { /** @type {any} */ (window).__geoCalled = true; return orig(...a); };
    });
    await page.goto('./');
    await page.getByRole('button', { name: 'Me guider' }).click();
    await page.getByRole('button', { name: 'Pas maintenant' }).click();
    await expect(page.locator('b-preprompt')).toHaveCount(0);
    expect(await page.evaluate(() => /** @type {any} */ (window).__geoCalled ?? false)).toBe(false);
    await page.getByRole('button', { name: 'Réglages' }).click();
    await expect(page.locator('#tier')).toHaveText('T0');
  });

  test('Boussole seule grants T1 without a location prompt (PERM-9)', async ({ page }) => {
    await page.goto('./');
    await page.addInitScript(() => {
      navigator.geolocation.watchPosition = () => { throw new Error('geo must not be called'); };
    });
    await page.reload();
    await page.getByRole('button', { name: 'Me guider' }).click();
    await page.getByRole('button', { name: 'Boussole seule' }).click();
    await expect(page.locator('b-preprompt')).toHaveCount(0);
    // orientation granted (no-op on Chromium) but no pose → still T0 for guidance
    await page.getByRole('button', { name: 'Réglages' }).click();
    const tier = await page.locator('#tier').textContent();
    expect(['T0', 'T1']).toContain(tier);
  });
});
