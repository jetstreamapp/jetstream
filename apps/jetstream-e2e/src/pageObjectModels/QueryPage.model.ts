import { expect, Locator, Page } from '@playwright/test';
import { QueryFilterOperator } from '@jetstream/types';
import { isNumber } from 'lodash';
import { formatNumber } from '@jetstream/shared/ui-utils';

export class QueryPage {
  readonly page: Page;
  readonly sobjectList: Locator;
  readonly fieldsList: Locator;
  readonly soqlQuery: Locator;
  readonly executeBtn: Locator;

  constructor(page: Page) {
    this.page = page;
    this.sobjectList = page.getByTestId('sobject-list');
    this.fieldsList = page.getByTestId('sobject-fields');
    this.soqlQuery = page.getByText('Generated SOQL');
    this.executeBtn = page.getByTestId('execute-query-button');
  }

  async goto() {
    await this.page.getByRole('menuitem', { name: 'Query Records' }).click();
    await this.page.waitForURL('**/query');
  }

  async gotoResults(query: string) {
    await this.page.getByRole('menuitem', { name: 'Query Records' }).click();
    await this.page.waitForURL('**/query');
    await this.page.getByRole('button', { name: 'Manually enter query Manual Query' }).click();
    await this.page.getByRole('textbox', { name: 'Editor content' }).fill(query);
    await this.page.getByRole('link', { name: 'Execute' }).click();
  }

  async selectObject(label: string) {
    await this.sobjectList.getByRole('listitem').filter({ hasText: label }).getByTitle(label, { exact: true }).first().click();
    await expect(this.fieldsList).toBeVisible();
    await expect(this.soqlQuery).toBeVisible();
  }

  async selectField(label: string, locator = this.fieldsList) {
    await locator.getByText(label, { exact: true }).first().click();
  }

  async selectFields(labels: string[]) {
    for (const label of labels) {
      await this.selectField(label);
    }
  }

  async selectRelatedFields(level: number, object: string, labels: string[]) {
    await this.fieldsList
      .getByRole('button', { name: `View ${object} Fields` })
      .first()
      .click();
    const locator = this.fieldsList.getByTestId(`sobject-fields-${level}-${object}`);
    for (const label of labels) {
      await this.selectField(label, locator);
    }
  }

  // getByTestId('sobject-fields-1-User').getByText('Account ID')

  async addFilter(
    { conditionNumber, groupNumber }: { conditionNumber: number; groupNumber?: number },
    field: string,
    operator: QueryFilterOperator,
    value: { type: 'text'; value: string } | { type: 'dropdown'; value: string }
  ) {
    const groupRole = isNumber(groupNumber) ? ` Of Group ${groupNumber}` : '';
    const condition = this.page.getByRole('group', { name: `Condition ${conditionNumber}${groupRole}` });

    await condition.getByLabel('Fields').click();
    await condition.getByLabel('Fields').fill(field);
    await this.page.getByRole('option', { name: field }).locator('span').nth(2).click();

    await condition.getByLabel('Operator').click();
    await this.page.locator(`#${operator}`).click();

    await condition.getByLabel('Value').click();
    (await value.type) === 'text'
      ? condition.getByLabel('Value').fill(value.value)
      : this.page.getByRole('option', { name: value.value }).click();
  }

  async addCondition() {
    await this.page.getByRole('button', { name: 'Add Condition' }).click();
  }

  async addConditionGroup() {
    await this.page.getByRole('button', { name: 'Add Group' }).click();
  }

  async validateQueryByLine(lines: string[]) {
    for (const line of lines) {
      await expect(this.page.getByRole('code').locator('div').filter({ hasText: line }).first()).toBeTruthy();
    }
  }

  async addOrderBy(field: string, direction: 'ASC' | 'DESC', nulls: 'IGNORE' | 'FIRST' | 'LAST' = 'IGNORE') {
    await this.page.getByRole('button', { name: 'Order By' }).click();

    const locator = this.page.getByText('Order ByFieldRelated fields must be selected to appear in this list and only fields');

    await locator.getByLabel('Field').click();
    await locator.getByRole('option', { name: field }).click();

    await locator.getByLabel('Order').click();
    await locator.getByRole('option', { name: direction ? 'Ascending (A to Z)' : 'Descending (Z to A)' }).click();

    if (nulls !== 'IGNORE') {
      await locator.getByLabel('Nulls').click();
      await locator.getByRole('option', { name: nulls === 'FIRST' ? 'Nulls First' : 'Nulls Last' }).click();
    }
  }

  async addLimit(limit?: number, skip?: number) {
    await this.page.getByRole('button', { name: 'Limit' }).click();

    const locator = this.page.getByText('LimitLimitSkip');

    if (isNumber(limit)) {
      await locator.getByPlaceholder('Max records to return').fill(`${limit}`);
    }
    if (isNumber(skip)) {
      await locator.getByPlaceholder('Records to skip').fill(`${skip}`);
      // await locator.press('tab');
    }
  }

  async confirmQueryRecords() {
    // TODO: this does not really work
    // let rows = await this.page.getByRole('grid').getByRole('gridcell', { name: 'Select row' }).all();
    // console.log(`Showing ${formatNumber(rows.length)} of ${formatNumber(rows.length)} records`);
    // await this.page.getByText(`Showing ${formatNumber(rows.length)} of ${formatNumber(rows.length)} records`);
  }

  async submitQuery() {
    await this.executeBtn.click();
    await this.page.waitForURL('**/query/results');
  }
}
