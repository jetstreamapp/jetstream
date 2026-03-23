import { Locator, Page } from '@playwright/test';
import type { editor } from 'monaco-editor';
import { ApiRequestUtils } from '../ApiRequestUtils';

declare global {
  interface Window {
    monaco: { editor: typeof editor };
  }
}

export class FormulaEvaluatorPage {
  readonly apiRequestUtils: ApiRequestUtils;
  readonly page: Page;
  readonly testBtn: Locator;
  readonly formulaResult: Locator;
  readonly formulaError: Locator;
  readonly recordFields: Locator;

  constructor(page: Page, apiRequestUtils: ApiRequestUtils) {
    this.apiRequestUtils = apiRequestUtils;
    this.page = page;
    this.testBtn = page.getByRole('button', { name: 'Test' });
    this.formulaResult = page.getByTestId('formula-result');
    this.formulaError = page.getByTestId('formula-error');
    this.recordFields = page.getByTestId('formula-record-fields');
  }

  async goto() {
    await this.page.goto('/app/formula-evaluator');
    await this.page.waitForURL('**/formula-evaluator');
  }

  async selectObject(sobjectName: string) {
    const dropdown = this.page.getByTestId('dropdown-Select an Object');
    const input = dropdown.getByRole('textbox');
    await input.click();
    await input.fill(sobjectName);
    await dropdown.getByRole('option', { name: sobjectName }).first().click();
  }

  async searchAndSelectRecord(searchTerm: string) {
    const dropdown = this.page.getByTestId('dropdown-Record');
    const input = dropdown.getByRole('textbox');
    await input.click();
    // Use pressSequentially to fire proper keyUp events that the combobox listens for
    await input.pressSequentially(searchTerm, { delay: 50 });
    // Wait for debounced search (300ms) to complete and results to render
    const listItem = dropdown.locator('.slds-listbox__item').first();
    await listItem.waitFor({ state: 'visible', timeout: 15000 });
    await listItem.click();
  }

  async setFormula(formula: string) {
    await this.page.evaluate((formulaText) => {
      window.monaco.editor
        .getEditors()
        .find((editor) => !editor.getRawOptions().readOnly)
        ?.setValue(formulaText);
    }, formula);
  }

  async clickTest() {
    await this.testBtn.click();
  }

  async setReturnType(label: string) {
    const dropdown = this.page.getByTestId('dropdown-Output Type');
    const input = dropdown.getByRole('textbox');
    await input.click();
    await dropdown.getByRole('option', { name: label }).click();
  }

  async setNullBehavior(behavior: 'ZERO' | 'BLANK') {
    if (behavior === 'ZERO') {
      await this.page.getByRole('radio', { name: 'Treat as zero' }).click({ force: true });
    } else {
      await this.page.getByRole('radio', { name: 'Treat as blank' }).click({ force: true });
    }
  }

  /**
   * Set formula, click Test, wait for results, and return the result text.
   */
  async evaluateFormula(formula: string): Promise<string> {
    await this.setFormula(formula);
    await this.clickTest();
    await this.formulaResult.waitFor({ state: 'visible', timeout: 30000 });
    return (await this.formulaResult.textContent()) || '';
  }

  /**
   * Set formula, click Test, and expect an error message.
   */
  async evaluateFormulaExpectError(formula: string): Promise<string> {
    await this.setFormula(formula);
    await this.clickTest();
    await this.formulaError.waitFor({ state: 'visible', timeout: 30000 });
    return (await this.formulaError.textContent()) || '';
  }
}
