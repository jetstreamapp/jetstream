import { APIRequestContext, expect, Locator, Page } from '@playwright/test';
import { QueryFilterOperator } from '@jetstream/types';
import { isNumber } from 'lodash';
import { formatNumber } from '@jetstream/shared/ui-utils';
import { QueryResults } from '@jetstream/api-interfaces';
import { ApiRequestUtils } from '../fixtures/ApiRequestUtils';
import { isRecordWithId } from '@jetstream/shared/utils';

export class QueryPage {
  readonly apiRequestUtils: ApiRequestUtils;
  readonly page: Page;
  readonly request: APIRequestContext;
  readonly sobjectList: Locator;
  readonly fieldsList: Locator;
  readonly soqlQuery: Locator;
  readonly executeBtn: Locator;

  constructor(page: Page, request: APIRequestContext, apiRequestUtils: ApiRequestUtils) {
    this.apiRequestUtils = apiRequestUtils;
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
      await manualQueryPopover.getByRole('button', { name: 'Close dialog' }).click();
    } else {
      await manualQueryPopover.getByRole('button', { name: 'Close dialog' }).click();
    }
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

    await condition.getByLabel('Fields').click();
    await condition.getByLabel('Fields').fill(field);
    await condition.getByRole('option', { name: field }).locator('span').nth(2).click();

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

    // reload page to make sure query still shows up
    await this.page.reload();
    await this.page.getByText(`Showing ${formatNumber(queryResults.records.length)} of ${formatNumber(queryResults.totalSize)} records`);

    // verify correct query shows up
    await this.page.getByRole('button', { name: 'SOQL Query' }).click();
    await expect(this.page.getByRole('code').locator('div').filter({ hasText: query }).first()).toBeVisible();
    await this.page.getByRole('button', { name: 'Collapse SOQL Query' }).click();

    await this.page.getByRole('button', { name: 'History' }).click();

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
    await this.page.getByRole('button', { name: 'History' }).click();
    await this.page.getByTestId(`query-history-${query}`).getByRole(role, { name: buttonName }).click();
  }

  async submitQuery() {
    await this.executeBtn.click();
    await this.page.waitForURL('**/query/results');
  }
}
