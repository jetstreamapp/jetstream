import { expect, test } from '../../fixtures/fixtures';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
});

test.describe.configure({ mode: 'parallel' });

test.describe('Authentication Session Management', () => {
  test.use({ userAgent: '' });

  test('Should be logged out', async ({ page, authenticationPage, playwrightPage }) => {
    // TODO: ensure that using the same session with a different user agent deletes the session from DB
    expect(true).toBe(true);
  });
});
