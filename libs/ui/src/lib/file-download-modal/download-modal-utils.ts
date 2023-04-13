import { FileExtCsv, FileExtJson, FileExtXLSX, FileExtXml, FileExtZip } from '@jetstream/types';

export const RADIO_FORMAT_XLSX: FileExtXLSX = 'xlsx';
export const RADIO_FORMAT_CSV: FileExtCsv = 'csv';
export const RADIO_FORMAT_JSON: FileExtJson = 'json';
export const RADIO_FORMAT_GDRIVE = 'gdrive';
export const RADIO_FORMAT_XML: FileExtXml = 'xml';
export const RADIO_FORMAT_ZIP: FileExtZip = 'zip';

export const RADIO_ALL_BROWSER = 'all-browser';
export const RADIO_ALL_SERVER = 'all-server';
export const RADIO_FILTERED = 'filtered';
export const RADIO_SELECTED = 'selected';

export const RADIO_DOWNLOAD_METHOD_STANDARD = 'radio-download-method-standard' as const;
export const RADIO_DOWNLOAD_METHOD_BULK_API = 'radio-download-method-bulk-api' as const;
