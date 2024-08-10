import { expect, test } from '../../fixtures/fixtures';

test.beforeEach(async ({ page }) => {
  await page.evaluate('__IS_CHROME_EXTENSION__ = false;');
  await page.goto('/app');
});

test.describe.configure({ mode: 'parallel' });

test.describe('PLATFORM EVENTS', () => {
  test('Should subscribe to and get published event', async ({ platformEventPage }) => {
    const platformEventName = 'Example_Event__e';
    const testField = 'Test_Field__c';
    const testValue = String(new Date().getTime());

    await platformEventPage.goto();
    await platformEventPage.subscribeToEvent(platformEventName);
    await platformEventPage.publishEvent(platformEventName, testField, testValue);

    await expect(platformEventPage.listenerCard.getByText(`{"${testField}":"${testValue}"`)).toBeVisible();

    await platformEventPage.unsubscribeToEvent();
  });
});
