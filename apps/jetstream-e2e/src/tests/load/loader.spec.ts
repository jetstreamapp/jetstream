import { expect, test } from '../../fixtures/fixtures';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
});

test.describe.configure({ mode: 'parallel' });

test.describe('LOADER', () => {
  test('should load basic file', async ({ loadPage }) => {
    // TODO:
  });
});
