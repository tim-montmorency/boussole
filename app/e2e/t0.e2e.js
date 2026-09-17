import { test, expect } from '@playwright/test';

// T0 happy path (plan Phase 3.6): no permissions — load venue, browse list,
// open repère, set manual position by tapping the plan, verify bearing/distance.
test.describe('T0 — Plan (zero permissions)', () => {
  test('loads the venue and shows the plan with nav', async ({ page }) => {
    await page.goto('./');
    await expect(page.locator('b-plan canvas')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Repères' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Plan' })).toHaveAttribute('aria-current', 'true');
  });

  test('list → repère detail → manual position → distance/bearing', async ({ page }) => {
    await page.goto('./');
    // list shows the repère
    await page.getByRole('button', { name: 'Repères' }).click();
    await expect(page.locator('.repere-list .repere')).toHaveCount(2);
    await page.locator('.repere-list .repere').first().click();
    // detail shows name + hint
    await expect(page.locator('.repere-detail h1')).toHaveText('Studios Multimédia');
    await expect(page.locator('.repere-detail .hint')).toContainText('lumière');
    // no pose yet → no stats
    await expect(page.locator('.repere-detail .stats')).toHaveCount(0);
    // back to plan, tap to set manual position
    await page.getByRole('button', { name: 'Plan' }).click();
    await page.locator('b-plan canvas').click({ position: { x: 200, y: 300 } });
    await expect(page.locator('.pos-label')).toHaveText('position manuelle');
    // detail now shows distance and bearing
    await page.getByRole('button', { name: 'Repères' }).click();
    await page.locator('.repere-list .repere').first().click();
    await expect(page.locator('.repere-detail .stats')).toContainText('m');
    await expect(page.locator('.repere-detail .stats')).toContainText('Cap');
  });

  test('manual check-in records the repère in the carnet (unverified without pose)', async ({ page }) => {
    await page.goto('./');
    await page.getByRole('button', { name: 'Repères' }).click();
    await page.locator('.repere-list .repere').first().click();
    await page.getByRole('button', { name: 'Je suis là' }).click();
    await page.getByRole('button', { name: 'Carnet' }).click();
    await expect(page.locator('ul.carnet li')).toHaveCount(1);
    await expect(page.locator('ul.carnet')).toContainText('Studios Multimédia');
    await expect(page.locator('ul.carnet')).toContainText('non vérifié');
    // persists across reload
    await page.reload();
    await page.getByRole('button', { name: 'Carnet' }).click();
    await expect(page.locator('ul.carnet li')).toHaveCount(1);
  });

  test('entrance QR ancre gives an instant start pose (PERM-6)', async ({ page }) => {
    await page.goto('./?ancre=a-agora');
    await expect(page.locator('b-plan canvas')).toBeVisible();
    await expect(page.locator('.pos-label')).toHaveText(''); // ancre pose is not "manual"
    await page.getByRole('button', { name: 'Repères' }).click();
    await expect(page.locator('.repere-list small').first()).toContainText('m');
  });

  test('settings shows the tier and permission states (PERM-5)', async ({ page }) => {
    await page.goto('./');
    await page.getByRole('button', { name: 'Réglages' }).click();
    await expect(page.locator('#tier')).toHaveText('T0');
    await expect(page.locator('.settings ul')).toContainText('Position');
  });

  test('invalid venue bundle shows the DATA-4 error card, not a blank app', async ({ page }) => {
    await page.goto('./?venue=../app/tests/fixtures/venue-bad.json');
    await expect(page.locator('.card.error')).toBeVisible();
    await expect(page.locator('.card.error')).toContainText('chargé');
  });
});
