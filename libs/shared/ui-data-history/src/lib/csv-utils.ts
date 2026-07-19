import { unparse } from 'papaparse';

/**
 * CSV serialization for history payload files. Unlike the interactive download path
 * (`generateCsv`), history files intentionally use a FIXED comma delimiter and `\n` newline so an
 * archive written under one locale is identical to one written under another.
 */

const CSV_CHUNK_ROW_COUNT = 5000;
const TEXT_ENCODER = new TextEncoder();

/**
 * Serialize rows into encoded CSV chunks sized for streaming to the file store. The header row is
 * emitted only in the first chunk of a file — pass `includeHeader: false` when appending rows to
 * a stream that already received a chunk.
 */
export function* serializeRowsToCsvChunks(
  rows: Record<string, unknown>[],
  header: string[],
  { includeHeader }: { includeHeader: boolean },
): Generator<Uint8Array> {
  for (let offset = 0; offset < rows.length; offset += CSV_CHUNK_ROW_COUNT) {
    const chunkRows = rows.slice(offset, offset + CSV_CHUNK_ROW_COUNT);
    const isFirstChunk = offset === 0;
    const csv = unparse(chunkRows, {
      columns: header,
      header: includeHeader && isFirstChunk,
      delimiter: ',',
      newline: '\n',
    });
    yield TEXT_ENCODER.encode(includeHeader && isFirstChunk ? csv : `\n${csv}`);
  }
}
