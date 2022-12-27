import { expect, test } from '@playwright/test';

test.describe('Smoke tests for new app', () => {
  test('default dummy @smoketest', () => {
    expect(true).toBe(true);
  });
});
