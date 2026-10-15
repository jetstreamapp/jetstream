import { decodeTextFile } from '../decode-text-file';
import { readFile } from '../shared-ui-utils';

const utf8 = (text: string) => new TextEncoder().encode(text);

// "Café" as Excel for Windows' "CSV (Comma delimited)" save writes it: é is the single byte 0xE9
const WINDOWS_1252_CAFE = new Uint8Array([0x43, 0x61, 0x66, 0xe9]);

describe('decodeTextFile', () => {
  it('decodes UTF-8 without a byte-order mark', () => {
    expect(decodeTextFile(utf8('Name\nCafé,日本'))).toBe('Name\nCafé,日本');
  });

  it('decodes an ArrayBuffer', () => {
    expect(decodeTextFile(utf8('Café').buffer as ArrayBuffer)).toBe('Café');
  });

  it('returns an empty string for an empty file', () => {
    expect(decodeTextFile(new Uint8Array())).toBe('');
  });

  it('drops a UTF-8 byte-order mark', () => {
    expect(decodeTextFile(new Uint8Array([0xef, 0xbb, 0xbf, ...utf8('Name')]))).toBe('Name');
  });

  it('falls back to Windows-1252 when the bytes are not valid UTF-8', () => {
    expect(decodeTextFile(WINDOWS_1252_CAFE)).toBe('Café');
  });

  it('uses the Windows-1252 mapping rather than ISO-8859-1 for the 0x80-0x9F range', () => {
    // € and curly quotes are printable in Windows-1252 but control characters in ISO-8859-1
    expect(decodeTextFile(new Uint8Array([0x80, 0x93, 0x94, 0x92]))).toBe('€“”’');
  });

  it('honors a UTF-16 LE byte-order mark', () => {
    expect(decodeTextFile(new Uint8Array([0xff, 0xfe, 0x43, 0x00, 0xe9, 0x00]))).toBe('Cé');
  });

  it('honors a UTF-16 BE byte-order mark', () => {
    expect(decodeTextFile(new Uint8Array([0xfe, 0xff, 0x00, 0x43, 0x00, 0xe9]))).toBe('Cé');
  });
});

describe('readFile', () => {
  it('reads a Windows-1252 csv as text without replacement characters', async () => {
    const file = new File([WINDOWS_1252_CAFE], 'contacts.csv', { type: 'text/csv' });
    await expect(readFile(file, 'text')).resolves.toBe('Café');
  });

  it('reads a UTF-8 csv as text', async () => {
    const file = new File([utf8('Id,Name\n001,Café')], 'contacts.csv', { type: 'text/csv' });
    await expect(readFile(file, 'text')).resolves.toBe('Id,Name\n001,Café');
  });

  it('still returns the raw bytes when asked for an array buffer', async () => {
    const file = new File([WINDOWS_1252_CAFE], 'contacts.xlsx');
    const result = await readFile(file, 'array_buffer');
    expect(new Uint8Array(result)).toEqual(WINDOWS_1252_CAFE);
  });
});
