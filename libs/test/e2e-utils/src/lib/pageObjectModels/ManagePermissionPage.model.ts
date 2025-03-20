import { formatNumber } from '@jetstream/shared/ui-utils';
import { pluralizeFromNumber } from '@jetstream/shared/utils';
import { Locator, Page, expect } from '@playwright/test';
import { ApiRequestUtils } from '../ApiRequestUtils';

function getSelectionText(length: number, identifier: string) {
  return `${formatNumber(length)} ${pluralizeFromNumber(identifier, length)} selected`;
}

export class ManagePermissionPage {
  readonly apiRequestUtils: ApiRequestUtils;
  readonly page: Page;

  readonly profileList: Locator;
  readonly permissionSetList: Locator;
  readonly sobjectList: Locator;

  readonly continueButton: Locator;
  readonly continueButtonDisabled: Locator;

  readonly standardUserProfileId = '0PSDn000003RK82OAG';
  readonly jetstreamPermSetId = '0PSDn000001M6CFOA0';

  constructor(page: Page, apiRequestUtils: ApiRequestUtils) {
    this.apiRequestUtils = apiRequestUtils;
    this.page = page;

    this.profileList = page.getByTestId('profiles-list');
    this.permissionSetList = page.getByTestId('permission-sets-list');
    this.sobjectList = page.getByTestId('sobject-list-multi-select');
    this.continueButton = page.getByRole('link', { name: 'Continue' });
    this.continueButtonDisabled = page.getByRole('button', { name: 'Continue' });
  }

  getCheckboxLocator(entity: string, field: string, type: 'profile' | 'permissionSet', which: 'read' | 'edit') {
    // await page.locator('[id="Account\\.AccountNumber-0PSDn000003RK82OAG-edit"]').uncheck();
    return this.page.locator(
      `[id="${entity}\\.${field}-${type === 'profile' ? this.standardUserProfileId : this.jetstreamPermSetId}-${which}"]`
    );
  }

  isChecked(entity: string, field: string, type: 'profile' | 'permissionSet', which: 'read' | 'edit') {
    return this.getCheckboxLocator(entity, field, type, which).isChecked();
  }

  async validateFieldDependency(entity: string, field: string, type: 'profile' | 'permissionSet') {
    const read = this.getCheckboxLocator(entity, field, type, 'read');
    const edit = this.getCheckboxLocator(entity, field, type, 'edit');
    await edit.check();
    await expect(read).toBeChecked();
    await expect(edit).toBeChecked();

    await read.uncheck();
    await expect(read).toBeChecked({ checked: false });
    await expect(edit).toBeChecked({ checked: false });
  }

  async modifyValue(entity: string, field: string, type: 'profile' | 'permissionSet') {
    const read = this.getCheckboxLocator(entity, field, type, 'read');
    const edit = this.getCheckboxLocator(entity, field, type, 'edit');
    await edit.check();
    await expect(read).toBeChecked();
    await expect(edit).toBeChecked();

    await read.uncheck();
    await expect(read).toBeChecked({ checked: false });
    await expect(edit).toBeChecked({ checked: false });
  }

  async goto() {
    await this.page.getByRole('menuitem', { name: 'Manage Permissions' }).click();
    await this.page.waitForURL('**/permissions-manager');
  }

  async gotoEditor() {
    await this.continueButton.click();
    await this.page.waitForURL('**/permissions-manager/editor');
  }

  async selectProfilesPermissionSetsAndObjects({
    profileNames,
    permissionSetNames,
    sobjectNames,
  }: {
    sobjectNames: string[];
    profileNames: string[];
    permissionSetNames: string[];
  }) {
    for (const name of profileNames) {
      await this.profileList.getByText(name, { exact: true }).first().click();
    }
    if (profileNames.length > 0) {
      await expect(this.profileList.getByRole('button', { name: getSelectionText(profileNames.length, 'item') })).toBeVisible();
    }

    for (const name of permissionSetNames) {
      await this.permissionSetList.getByText(name, { exact: true }).first().click();
    }
    if (permissionSetNames.length > 0) {
      await expect(this.permissionSetList.getByRole('button', { name: getSelectionText(permissionSetNames.length, 'item') })).toBeVisible();
    }

    for (const name of sobjectNames) {
      await this.sobjectList.getByText(name, { exact: true }).first().click();
    }
    if (sobjectNames.length > 0) {
      await expect(this.sobjectList.getByRole('button', { name: getSelectionText(sobjectNames.length, 'object') })).toBeVisible();
    }
  }
}
