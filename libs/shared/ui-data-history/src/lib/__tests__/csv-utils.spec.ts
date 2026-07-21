import { describe, expect, it } from 'vitest';
import { serializeRowsToCsvChunks } from '../csv-utils';

const TEXT_DECODER = new TextDecoder();

function collect(rows: Record<string, unknown>[], header: string[], includeHeader: boolean): string {
  return Array.from(serializeRowsToCsvChunks(rows, header, { includeHeader }))
    .map((chunk) => TEXT_DECODER.decode(chunk))
    .join('');
}

describe('serializeRowsToCsvChunks', () => {
  it('serializes rows with a header in the first chunk only', () => {
    const csv = collect(
      [
        { Name: 'Acme', Industry: 'Tech' },
        { Name: 'Globex, Inc', Industry: 'Energy' },
      ],
      ['Name', 'Industry'],
      true,
    );
    expect(csv).toBe('Name,Industry\nAcme,Tech\n"Globex, Inc",Energy');
  });

  it('prefixes with a newline when appending without a header', () => {
    const csv = collect([{ Name: 'Acme' }], ['Name'], false);
    expect(csv).toBe('\nAcme');
  });

  it('respects column order and fills missing values', () => {
    const csv = collect([{ Industry: 'Tech' }], ['Name', 'Industry'], true);
    expect(csv).toBe('Name,Industry\n,Tech');
  });

  it('yields nothing for empty input', () => {
    expect(Array.from(serializeRowsToCsvChunks([], ['Name'], { includeHeader: true }))).toHaveLength(0);
  });

  it('splits large row sets into multiple chunks that reassemble losslessly', () => {
    const rows = Array.from({ length: 5001 }, (_, i) => ({ Name: `row-${i}` }));
    const chunks = Array.from(serializeRowsToCsvChunks(rows, ['Name'], { includeHeader: true }));
    expect(chunks.length).toBe(2);
    const csv = chunks.map((chunk) => TEXT_DECODER.decode(chunk)).join('');
    const lines = csv.split('\n');
    expect(lines).toHaveLength(5002);
    expect(lines[0]).toBe('Name');
    expect(lines[1]).toBe('row-0');
    expect(lines[5001]).toBe('row-5000');
    // header must appear exactly once
    expect(lines.filter((line) => line === 'Name')).toHaveLength(1);
  });
});
