import { Download, expect, Page } from '@playwright/test';

export class DataHistoryPage {
  constructor(public page: Page) {}

  get detailDialog() {
    return this.page.getByRole('dialog', { name: 'Data History Detail' });
  }

  async goto() {
    await this.page.getByRole('link', { name: 'Data History' }).first().click();
    await expect(this.page.getByTestId('data-history-page')).toBeVisible();
  }

  /**
   * The row for the newest entry of a given feature. Capture is fire-and-forget and finishes after
   * the load UI reports "Finished", so the row can land a moment after navigation.
   */
  getRowByFeature(featureLabel: string) {
    return this.page.getByRole('row').filter({ hasText: featureLabel }).first();
  }

  async waitForEntry(featureLabel: string) {
    await expect(this.getRowByFeature(featureLabel)).toBeVisible({ timeout: 30000 });
  }

  async openDetail(featureLabel: string) {
    const viewButton = this.getRowByFeature(featureLabel).getByRole('button', { name: 'View' });
    // The grid scrolls its active cell into view on mousedown. `Actions` is the rightmost column and
    // the columns are wider than the viewport, so clicking `View` as the grid's first interaction
    // scrolls the button out from under the cursor before mouseup and the click never lands.
    // Scrolling it in first makes that mousedown scroll a no-op.
    await viewButton.scrollIntoViewIfNeeded();
    await viewButton.click();
    if (!(await this.detailDialog.isVisible())) {
      // First click was consumed establishing the grid's active cell; nothing moves on the second.
      await viewButton.click();
    }
    await expect(this.detailDialog).toBeVisible();
  }

  async closeDetail() {
    await this.detailDialog.getByRole('button', { name: 'Close' }).click();
    await expect(this.detailDialog).toBeHidden();
  }

  /**
   * Download the first saved payload from the open detail modal. Each file kind renders its own
   * download button, accessibly named `Download <label>` (e.g. `Download Input Data`) so screen
   * readers can tell them apart. Clicking one opens the shared file-download modal
   * (`Download <label>`) where the footer's `Download` actually writes the file.
   */
  async downloadFirstPayload(): Promise<Download> {
    await this.detailDialog
      .getByRole('button', { name: /^Download / })
      .first()
      .click();

    const downloadDialog = this.page.getByRole('dialog', { name: /^Download / });
    await expect(downloadDialog).toBeVisible();

    const downloadPromise = this.page.waitForEvent('download');
    await downloadDialog.getByRole('button', { name: 'Download', exact: true }).click();
    return downloadPromise;
  }
}
