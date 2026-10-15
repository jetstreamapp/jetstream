type BomEncoding = 'utf-8' | 'utf-16le' | 'utf-16be';

/**
 * Decode the bytes of a text file (csv, tsv, json, xml) the way a spreadsheet application opens it.
 *
 * `FileReader.readAsText` decodes anything without a byte-order mark as UTF-8 and swaps every byte it cannot
 * decode for U+FFFD. Excel for Windows' default "CSV (Comma delimited)" save writes the Windows-1252 code page
 * ("ANSI"), so an é arrives as the single byte 0xE9 and used to be loaded into Salesforce as "Caf�".
 * https://github.com/jetstreamapp/jetstream/issues/2156
 *
 * - A UTF-8 / UTF-16 LE / UTF-16 BE byte-order mark picks the encoding and is dropped from the result, as readAsText does.
 * - Otherwise the bytes are decoded as UTF-8 when they are valid UTF-8, and as Windows-1252 when they are not.
 */
export function decodeTextFile(bytes: ArrayBuffer | Uint8Array): string {
  const view = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  const bomEncoding = textEncodingFromBom(view);
  if (bomEncoding) {
    // TextDecoder drops the byte-order mark of the encoding it was told about
    return new TextDecoder(bomEncoding).decode(view);
  }
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(view);
  } catch {
    return new TextDecoder('windows-1252').decode(view);
  }
}

function textEncodingFromBom(bytes: Uint8Array): BomEncoding | undefined {
  if (bytes.length >= 3 && bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) {
    return 'utf-8';
  }
  if (bytes.length >= 2 && bytes[0] === 0xff && bytes[1] === 0xfe) {
    return 'utf-16le';
  }
  if (bytes.length >= 2 && bytes[0] === 0xfe && bytes[1] === 0xff) {
    return 'utf-16be';
  }
  return undefined;
}
