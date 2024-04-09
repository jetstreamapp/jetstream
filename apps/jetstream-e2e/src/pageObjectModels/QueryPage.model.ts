import { formatNumber } from '@jetstream/shared/ui-utils';
import { isRecordWithId } from '@jetstream/shared/utils';
import { QueryFilterOperator, QueryResults } from '@jetstream/types';
import { APIRequestContext, Locator, Page, expect } from '@playwright/test';
import isNumber from 'lodash/isNumber';
import { ApiRequestUtils } from '../fixtures/ApiRequestUtils';
import { PlaywrightPage } from './PlaywrightPage.model';

export class QueryPage {
  readonly apiRequestUtils: ApiRequestUtils;
  readonly playwrightPage: PlaywrightPage;
  readonly page: Page;
  readonly request: APIRequestContext;
  readonly sobjectList: Locator;
  readonly fieldsList: Locator;
  readonly soqlQuery: Locator;
  readonly executeBtn: Locator;

  constructor(page: Page, request: APIRequestContext, apiRequestUtils: ApiRequestUtils, playwrightPage: PlaywrightPage) {
    this.apiRequestUtils = apiRequestUtils;
    this.playwrightPage = playwrightPage;
    this.page = page;
    this.request = request;
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
    await this.setManualQuery(query, 'EXECUTE');
  }

  async setManualQuery(query: string, action?: 'EXECUTE' | 'RESTORE') {
    await this.page.getByRole('menuitem', { name: 'Query Records' }).click();
    await this.page.waitForURL('**/query');
    await this.page.getByRole('button', { name: 'Manually enter query Manual Query' }).first().click();
    const manualQueryPopover = this.page.getByTestId('manual-query');
    await manualQueryPopover.getByRole('textbox', { name: 'Editor content' }).fill(query);

    if (action === 'EXECUTE') {
      await Promise.all([
        this.page.waitForURL('**/query/results', { waitUntil: 'networkidle' }),
        manualQueryPopover.getByRole('link', { name: 'Execute' }).click(),
      ]);
    } else if (action === 'RESTORE') {
      await manualQueryPopover.getByRole('button', { name: 'Restore' }).click();
    } else {
      await manualQueryPopover.getByRole('button', { name: 'Close dialog' }).click();
    }
  }

  async resetQueryPage() {
    await this.page.getByRole('button', { name: 'Reset Page' }).click();
  }

  async selectObject(sobjectName: string) {
    await this.sobjectList.getByTestId(sobjectName).click();
    await expect(this.fieldsList).toBeVisible();
    await expect(this.soqlQuery).toBeVisible();
  }

  async selectField(label: string, locator = this.fieldsList) {
    await locator.getByText(label, { exact: true }).first().click();
  }

  async selectFields(fieldLabels: string[]) {
    for (const label of fieldLabels) {
      await this.selectField(label);
    }
  }

  async selectRelatedFields(level: number, object: string, fieldLabels: string[]) {
    await this.fieldsList
      .getByRole('button', { name: `View ${object} Fields` })
      .first()
      .click();
    const locator = this.fieldsList.getByTestId(`sobject-fields-${level}-${object}`);
    for (const label of fieldLabels) {
      await this.selectField(label, locator);
    }
  }

  getSelectedField(label: string) {
    return this.fieldsList.getByRole('option').filter({
      has: this.page.getByText(label, { exact: true }).first(),
    });
  }

  async selectSubqueryObject(relationshipName: string) {
    await this.page.getByRole('tab', { name: 'Related Objects (Subquery)' }).click();
    await this.page.getByPlaceholder('Filter child objects').fill(relationshipName);
    await this.page.getByTestId(relationshipName).click();
  }

  async selectSubquery(relationshipName: string, fieldLabels: string[]) {
    await this.selectSubqueryObject(relationshipName);

    await this.selectFields(fieldLabels);

    // Close relationship menu
    await this.page.getByTestId(relationshipName).click();
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

    await condition.getByLabel('Field').click();
    await this.page.keyboard.type(field, { delay: 100 });
    // await condition.getByLabel('Field').fill(field);
    await condition.getByRole('option', { name: field }).first().click();

    await condition.getByLabel('Operator').click();
    await condition.locator(`#${operator}`).click();

    await condition.getByLabel('Value').click();
    (await value.type) === 'text'
      ? condition.getByLabel('Value').fill(value.value)
      : condition.getByRole('option', { name: value.value }).click();
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

  async addOrderBy(field: string, direction: 'ASC' | 'DESC', nulls: 'IGNORE' | 'FIRST' | 'LAST' = 'IGNORE', groupNumber = 1) {
    await this.page.getByRole('button', { name: 'Order By' }).click();

    const orderByRow = this.page.getByRole('group', { name: `Filter row ${groupNumber}` });

    await orderByRow.getByLabel('Field').click();
    await this.page.keyboard.type(field, { delay: 100 });
    // await orderByRow.getByLabel('Field').fill(field);
    await orderByRow.getByRole('option', { name: field }).first().click();

    await orderByRow.getByLabel('Order').click();
    await orderByRow.getByRole('option', { name: direction ? 'Ascending (A to Z)' : 'Descending (Z to A)' }).click();

    if (nulls !== 'IGNORE') {
      await orderByRow.getByLabel('Nulls').click();
      await orderByRow.getByRole('option', { name: nulls === 'FIRST' ? 'Nulls First' : 'Nulls Last' }).click();
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

  async waitForQueryResults(query: string) {
    const { queryResults } = await this.apiRequestUtils.makeRequest<QueryResults>('POST', `/api/query`, { query });
    await expect(queryResults.records.length).toBeGreaterThan(0);
    await this.page.getByText(`Showing ${formatNumber(queryResults.records.length)} of ${formatNumber(queryResults.totalSize)} records`);
    return queryResults;
  }

  async confirmQueryRecords(query: string) {
    const queryResults = await this.waitForQueryResults(query);

    // validate first 15 records - check that id is present
    for (const record of queryResults.records.slice(0, 15)) {
      await expect(isRecordWithId(record)).toBeTruthy();
      isRecordWithId(record) && (await expect(this.page.getByRole('gridcell', { name: record.Id })).toBeVisible());
    }

    // FIXME: this was causing the browser to crash - could not reproduce or identify cause
    // reload page to make sure query still shows up
    // await this.page.reload();
    // await this.page.getByText(`Showing ${formatNumber(queryResults.records.length)} of ${formatNumber(queryResults.totalSize)} records`);

    // verify correct query shows up
    await this.page.getByRole('button', { name: 'SOQL Query' }).click();
    // The full query is broken up in a weird way, we we check each token individually
    for (const token of query.split(' ')) {
      await expect(this.page.getByRole('code').locator('div').filter({ hasText: token }).first()).toBeVisible();
    }
    await this.page.getByRole('button', { name: 'Collapse SOQL Query' }).click();

    await this.page.getByLabel('Query History').click();

    // verify query history
    await expect(
      this.page.getByRole('dialog', { name: 'Query History' }).getByRole('code').locator('div').filter({ hasText: query }).first()
    ).toBeVisible();

    await this.page.getByRole('dialog', { name: 'Query History' }).getByRole('button', { name: 'Close' }).click();
  }

  async performQueryHistoryAction(query: string, action: 'EXECUTE' | 'RESTORE' | 'SAVE' | 'UN_SAVE' = 'EXECUTE') {
    let buttonName = 'Execute';
    let role: 'link' | 'button' = 'link';
    if (action === 'RESTORE') {
      buttonName = 'Restore';
      role = 'button';
    } else if (action === 'SAVE') {
      buttonName = 'Save';
      role = 'button';
    } else if (action === 'UN_SAVE') {
      buttonName = 'Saved';
      role = 'button';
    }
    await this.page.getByLabel('Query History').click();
    await this.page.getByTestId(`query-history-${query}`).getByRole(role, { name: buttonName }).click();
  }

  async submitQuery() {
    await this.executeBtn.click();
    await this.page.waitForURL('**/query/results');
  }

  async clickBulkAction(
    action:
      | 'Bulk update records'
      | 'Create new record'
      | 'Delete selected records'
      | 'Convert selected records to Apex'
      | 'Open selected records in Salesforce'
  ) {
    await this.page.getByRole('button', { name: 'Record actions' }).click();
    await this.page.getByRole('menuitem', { name: action }).click();
  }
}
