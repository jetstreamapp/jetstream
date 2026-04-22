import { expect, test } from '../../fixtures/fixtures';

test.describe.configure({ mode: 'parallel' });

test.describe('404 handling', () => {
  // Regression guard for the fix that replaced `res.redirect('/404/')` with an
  // inline 404 response. A 302 → /404/ redirect made access-log status-code metrics
  // unable to identify which URLs actually 404'd. The status code returned by the
  // server must be 404 (not 302), and the original URL must stay visible.
  test('Unknown URL returns a real 404 with the landing 404 page HTML', async ({ page }) => {
    const bogusPath = `/this-path-does-not-exist-${Date.now()}.php7`;

    const response = await page.goto(bogusPath);

    expect(response).not.toBeNull();
    expect(response?.status()).toBe(404);
    expect(page.url()).toContain(bogusPath);

    const contentType = response?.headers()['content-type'] ?? '';
    expect(contentType).toContain('text/html');

    await expect(page.getByRole('heading', { name: 'Page not found' })).toBeVisible();
  });
});
