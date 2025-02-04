import { Browser, expect, Page } from '@playwright/test';

export class PlaywrightPage {
  readonly browser: Browser;
  readonly page: Page;

  constructor(page: Page) {
    this.page = page;
  }

  async selectDropdownItem(
    label: string,
    value: string,
    options: {
      searchForValue?: boolean;
    } = {}
  ) {
    const { searchForValue } = options;
    const dropdown = this.page.getByTestId(`dropdown-${label}`);
    await dropdown.getByLabel(label).click();
    if (searchForValue) {
      await dropdown.getByLabel(label).fill(value);
    }
    await dropdown.getByRole('option', { name: value }).click();
    return dropdown;
  }

  async logout() {
    await this.page.getByRole('button', { name: 'Avatar' }).click();
    await this.page.getByRole('menuitem', { name: 'Logout' }).click();
    await expect(this.page.getByTestId('home-hero-container')).toBeVisible();
  }

  async goToProfile() {
    await this.page.getByRole('button', { name: 'Avatar' }).click();
    await this.page.getByRole('menuitem', { name: 'Profile' }).click();
  }
}
