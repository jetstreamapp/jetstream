import { expect, test } from '../../fixtures/fixtures';

test.beforeEach(async ({ page }) => {
  await page.goto('/app');
});

test.describe.configure({ mode: 'parallel' });

test.describe('QUICK QUERY POPOVER', () => {
  test('Should sanitize non-breaking spaces from pasted text', async ({ page, apiRequestUtils }) => {
    await apiRequestUtils.selectDefaultOrg();

    await page.getByRole('button', { name: 'Query Search - ctrl/command' }).click();

    const editorContainer = page.locator('.monaco-editor').first();
    await editorContainer.waitFor({ state: 'visible' });

    // Each whitespace slot uses a different lookalike space character that the sanitizer targets:
    //   \u00A0 non-breaking space (Jira, Word)
    //   \u202F narrow no-break space
    //   \u2007 figure space
    //   \u2008 punctuation space
    //   \u2009 thin space
    //   \u200A hair space
    //   \u3000 ideographic space (CJK tools)
    const SANITIZED_CHARS = ['\u00A0', '\u202F', '\u2007', '\u2008', '\u2009', '\u200A', '\u3000'];
    const dirtyQuery = `SELECT\u00A0Id,\u202FName,\u2007Type\u2008FROM\u2009Account\u200ALIMIT\u30001`;
    const cleanQuery = 'SELECT Id, Name, Type FROM Account LIMIT 1';

    await page.context().grantPermissions(['clipboard-read', 'clipboard-write']);
    await page.evaluate(async (query) => {
      await navigator.clipboard.writeText(query);
    }, dirtyQuery);

    // Focus the editor and paste
    await editorContainer.click();
    await page.keyboard.press('ControlOrMeta+v');

    // Wait until Monaco's onDidPaste handler has replaced all lookalike spaces
    await page.waitForFunction((chars) => {
      const monacoInstance = (window as any).monaco;
      const value = monacoInstance?.editor.getEditors().find((editor: any) => !editor.getRawOptions().readOnly)?.getValue();
      return value && chars.every((char: string) => !value.includes(char));
    }, SANITIZED_CHARS);

    const editorValue = await page.evaluate(() => {
      const monacoInstance = (window as any).monaco;
      return monacoInstance?.editor.getEditors().find((editor: any) => !editor.getRawOptions().readOnly)?.getValue();
    });

    expect(editorValue).toBe(cleanQuery);
    for (const char of SANITIZED_CHARS) {
      expect(editorValue).not.toContain(char);
    }
  });
});
