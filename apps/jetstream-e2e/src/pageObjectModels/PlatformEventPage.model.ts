import { APIRequestContext, Locator, Page, expect } from '@playwright/test';
import { ApiRequestUtils } from '../fixtures/ApiRequestUtils';
import { PlaywrightPage } from './PlaywrightPage.model';

export class PlatformEventPage {
  readonly apiRequestUtils: ApiRequestUtils;
  readonly playwrightPage: PlaywrightPage;
  readonly page: Page;
  readonly request: APIRequestContext;
  readonly listenerCard: Locator;
  readonly publisherCard: Locator;

  constructor(page: Page, request: APIRequestContext, apiRequestUtils: ApiRequestUtils, playwrightPage: PlaywrightPage) {
    page.evaluate('__IS_CHROME_EXTENSION__ = false;');
    this.apiRequestUtils = apiRequestUtils;
    this.playwrightPage = playwrightPage;
    this.page = page;
    this.request = request;
    this.listenerCard = page.getByTestId('platform-event-monitor-listener-card');
    this.publisherCard = page.getByTestId('platform-event-monitor-publisher-card');
  }

  async goto() {
    await this.page.getByRole('button', { name: 'Developer Tools' }).click();
    await this.page.getByRole('menuitemcheckbox', { name: 'Platform Events' }).click();
    await this.page.waitForURL('**/platform-event-monitor');
  }

  async subscribeToEvent(eventName: string) {
    await this.listenerCard.getByPlaceholder('Select an Option').click();
    await this.listenerCard.getByRole('option', { name: `(${eventName}) /event/${eventName}` }).click();
    await this.listenerCard.getByRole('button', { name: 'Subscribe', exact: true }).click();
    // Ensure subscription was successful
    await expect(this.listenerCard.getByRole('button', { name: 'Unsubscribe' })).toBeVisible();
    await expect(this.listenerCard.getByPlaceholder('-1')).toBeDisabled();
  }

  async unsubscribeToEvent() {
    await this.listenerCard.getByRole('button', { name: 'Unsubscribe' }).click();
    await expect(this.listenerCard.getByPlaceholder('-1')).toBeEnabled();
    await expect(this.listenerCard.getByRole('button', { name: 'Subscribe', exact: true })).toBeVisible();
  }

  async publishEvent(eventName: string, fieldName: string, fieldValue: string) {
    await this.publisherCard.getByPlaceholder('Select an Option').click();
    await this.publisherCard.getByRole('option', { name: eventName }).click();
    await this.publisherCard.getByLabel(`(${fieldName})`).fill(fieldValue);
    await this.publisherCard.getByRole('button', { name: 'Publish Event' }).click();
    await expect(this.publisherCard.getByText(/informationEvent Id: [0-9a-fA-F-]+/)).toBeVisible();
  }
}
