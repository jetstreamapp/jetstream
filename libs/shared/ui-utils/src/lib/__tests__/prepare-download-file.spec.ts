import { MIME_TYPES } from '@jetstream/shared/constants';
import { unparse } from 'papaparse';
import { describe, expect, it } from 'vitest';
import { prepareCsvFile, prepareJsonFile } from '../shared-ui-utils';

const RECORD_COUNTS = [0, 1, 2, 1_000];

// Records this long put a few of them over the 8M characters that are gathered before moving them into a Blob
const LONG_TEXT = 'x'.repeat(3_000_000);

const CSV_HEADER = ['Id', 'Name', 'Description'];

/** Values that need quoting and escaping, so a chunk seam that broke them would show up in the output */
function buildCsvRecords(count: number): Record<string, string>[] {
  return Array.from({ length: count }, (_, i) => ({
    Id: `001${String(i).padStart(15, '0')}`,
    Name: `Account, "${i}"`,
    Description: `line one\r\nline two ${i}`,
  }));
}

function buildJsonRecords(count: number) {
  return Array.from({ length: count }, (_, i) => ({
    attributes: { type: 'Account', url: `/services/data/v62.0/sobjects/Account/${i}` },
    Id: `001${i}`,
    Name: `Account "${i}"`,
    Owner: { Name: 'Jane Doe', Manager: null },
    Contacts: { totalSize: 2, records: [{ Id: `003${i}a` }, { Id: `003${i}b` }] },
  }));
}

describe('prepareCsvFile', () => {
  it.each(RECORD_COUNTS)('produces the same CSV as a single unparse call for %i records', async (count) => {
    const data = buildCsvRecords(count);

    const file = prepareCsvFile(data, CSV_HEADER);

    expect(await file.text()).toBe(unparse({ fields: CSV_HEADER, data }, { header: true, quotes: true, delimiter: ',', newline: '\r\n' }));
  });

  it('produces the same CSV when the file is gathered from several Blobs', async () => {
    const data = buildCsvRecords(6).map((record) => ({ ...record, Description: `${record.Description} "${LONG_TEXT}"` }));

    const file = prepareCsvFile(data, CSV_HEADER);

    expect(await file.text()).toBe(unparse({ fields: CSV_HEADER, data }, { header: true, quotes: true, delimiter: ',', newline: '\r\n' }));
  });

  it('writes the header row when there are no records', async () => {
    const file = prepareCsvFile([], CSV_HEADER);

    // papaparse ends a header-only file with a newline
    expect(await file.text()).toBe('"Id","Name","Description"\r\n');
  });

  it('is typed as CSV', () => {
    expect(prepareCsvFile(buildCsvRecords(1), CSV_HEADER).type).toBe(MIME_TYPES.CSV);
  });
});

describe('prepareJsonFile', () => {
  it.each(RECORD_COUNTS)('produces the same JSON as JSON.stringify for %i records', async (count) => {
    const records = buildJsonRecords(count);

    const file = prepareJsonFile(records);

    expect(await file.text()).toBe(JSON.stringify(records, null, 2));
  });

  it('produces the same JSON when the file is gathered from several Blobs', async () => {
    const records = buildJsonRecords(6).map((record) => ({ ...record, Description: LONG_TEXT }));

    expect(await prepareJsonFile(records).text()).toBe(JSON.stringify(records, null, 2));
  });

  it('serializes data that is not an array as-is', async () => {
    const data = { Account: buildJsonRecords(2), Contact: [] };

    expect(await prepareJsonFile(data).text()).toBe(JSON.stringify(data, null, 2));
  });

  it('is typed as JSON', () => {
    expect(prepareJsonFile(buildJsonRecords(2)).type).toBe(MIME_TYPES.JSON);
  });
});
