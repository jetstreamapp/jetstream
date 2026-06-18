import { logger } from '@jetstream/shared/client-logger';
import copyToClipboard from 'copy-to-clipboard';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { copyRecordsToClipboard } from '../shared-ui-data-utils';

// `copy-to-clipboard` performs a real `document.execCommand('copy')` against the OS clipboard,
// which jsdom does not implement. We mock it so we can assert exactly what content/options the
// function hands to the clipboard. The actual "did it land on the OS clipboard" behavior is only
// verifiable in a real browser (e.g. Playwright) and is intentionally out of scope here.
vi.mock('copy-to-clipboard', () => ({ default: vi.fn() }));

const mockedCopyToClipboard = vi.mocked(copyToClipboard);

/** Convenience accessor for the args of the (single) copyToClipboard call. */
function getCopyCall(callIndex = 0): [string, Parameters<typeof copyToClipboard>[1]] {
  const call = mockedCopyToClipboard.mock.calls[callIndex];
  return [call[0], call[1]];
}

describe('copyRecordsToClipboard', () => {
  beforeEach(() => {
    mockedCopyToClipboard.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  describe('csv', () => {
    it('copies flattened records as CSV with text/plain format', async () => {
      const records = [
        { Id: '001', Name: 'Acme' },
        { Id: '002', Name: 'Globex' },
      ];

      await copyRecordsToClipboard(records, 'csv', ['Id', 'Name']);

      expect(mockedCopyToClipboard).toHaveBeenCalledTimes(1);
      const [text, options] = getCopyCall();
      expect(text).toBe('Id,Name\r\n001,Acme\r\n002,Globex');
      expect(options).toEqual({ format: 'text/plain' });
    });

    it('flattens nested/dotted field paths before serializing', async () => {
      const records = [{ Id: '001', Account: { Name: 'Acme' } }];

      await copyRecordsToClipboard(records, 'csv', ['Id', 'Account.Name']);

      const [text] = getCopyCall();
      expect(text).toBe('Id,Account.Name\r\n001,Acme');
    });

    it('omits the header row when includeHeader is false', async () => {
      const records = [{ Id: '001', Name: 'Acme' }];

      await copyRecordsToClipboard(records, 'csv', ['Id', 'Name'], false);

      const [text] = getCopyCall();
      expect(text).toBe('001,Acme');
    });
  });

  describe('json', () => {
    it('copies pretty-printed JSON with text/plain format (no flattening)', async () => {
      const records = [{ Id: '001', Account: { Name: 'Acme' } }];

      await copyRecordsToClipboard(records, 'json', ['Id', 'Account.Name']);

      expect(mockedCopyToClipboard).toHaveBeenCalledTimes(1);
      const [text, options] = getCopyCall();
      // json branch intentionally does not flatten — nested objects are preserved
      expect(text).toBe(JSON.stringify(records, null, 2));
      expect(JSON.parse(text)[0].Account.Name).toBe('Acme');
      expect(options).toEqual({ format: 'text/plain' });
    });
  });

  describe('excel (default format)', () => {
    it('defaults to excel and copies an HTML table with text/html format', async () => {
      const records = [
        { Id: '001', Name: 'Acme' },
        { Id: '002', Name: 'Globex' },
      ];

      await copyRecordsToClipboard(records, undefined, ['Id', 'Name']);

      expect(mockedCopyToClipboard).toHaveBeenCalledTimes(1);
      const [text, options] = getCopyCall();
      expect(text).toBe(
        '<table><tr><th>Id</th><th>Name</th></tr><tr><td>001</td><td>Acme</td></tr><tr><td>002</td><td>Globex</td></tr></table>',
      );
      expect(options?.format).toBe('text/html');
      expect(typeof options?.onCopy).toBe('function');
    });

    it('onCopy builds a ClipboardItem carrying both HTML and tab-delimited plain text as Blobs', async () => {
      // ClipboardItem is a browser API absent from jsdom; stub it so we can observe the payload.
      const clipboardItemSpy = vi.fn();
      vi.stubGlobal('ClipboardItem', clipboardItemSpy);

      const records = [{ Id: '001', Name: 'Acme' }];
      await copyRecordsToClipboard(records, 'excel', ['Id', 'Name']);

      const [, options] = getCopyCall();
      // copy-to-clipboard would normally invoke onCopy on a successful copy; we invoke it directly
      // since the library is mocked.
      options?.onCopy?.(undefined as never);

      expect(clipboardItemSpy).toHaveBeenCalledTimes(1);
      // The Clipboard API expects Blob values, so assert both the MIME type and the decoded content.
      const [clipboardItemData] = clipboardItemSpy.mock.calls[0] as [Record<string, Blob>];
      expect(Object.keys(clipboardItemData)).toEqual(['text/html', 'text/plain']);

      const htmlBlob = clipboardItemData['text/html'];
      const plainBlob = clipboardItemData['text/plain'];
      expect(htmlBlob).toBeInstanceOf(Blob);
      expect(plainBlob).toBeInstanceOf(Blob);
      expect(htmlBlob.type).toBe('text/html');
      expect(plainBlob.type).toBe('text/plain');
      expect(await htmlBlob.text()).toBe('<table><tr><th>Id</th><th>Name</th></tr><tr><td>001</td><td>Acme</td></tr></table>');
      expect(await plainBlob.text()).toBe('Id\tName\n001\tAcme');
    });
  });

  describe('error handling', () => {
    it('swallows clipboard failures and logs the error', async () => {
      const loggerErrorSpy = vi.spyOn(logger, 'error').mockImplementation(() => undefined);
      mockedCopyToClipboard.mockImplementation(() => {
        throw new Error('clipboard unavailable');
      });

      await expect(copyRecordsToClipboard([{ Id: '001' }], 'csv', ['Id'])).resolves.toBeUndefined();
      expect(loggerErrorSpy).toHaveBeenCalledWith('Copy to clipboard failed', 'clipboard unavailable');
    });
  });
});
