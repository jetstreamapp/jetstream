import { logger } from '@jetstream/shared/client-logger';
import type { NewFile, OpenReader } from 'excelize-wasm';
import { clamp, isBoolean, isNumber, isString } from 'lodash';

type Excelize = {
  NewFile: typeof NewFile;
  OpenReader: typeof OpenReader;
};

const SERVER_PATH = '/assets/wasm/excelize.wasm.gz';
let _excelize: Excelize;

async function getExcelize() {
  if (_excelize) {
    return _excelize;
  }
  const { init } = await import('excelize-wasm');
  _excelize = await init(SERVER_PATH);
  return _excelize;
}

/**
 * Generate single excel worksheet from data
 * If header is not provided, it will be generated from keys of the first row of data
 *
 * @param data
 * @param options
 * @returns
 */
export async function generateExcelWorksheet(
  data: any[],
  options: {
    header?: string[];
    sheetName?: string;
    boldHeader?: boolean;
    autoFilter?: boolean;
    autoSizeColumns?: boolean;
    freezeTopRow?: boolean;
  } = {}
) {
  const { header = Object.keys(data[0]), sheetName = 'Records', ...restOptions } = options;
  // TODO: fallback to normal XLSX if this fails
  const excelize = await getExcelize();

  const spreadsheet = excelize.NewFile();
  spreadsheet.NewSheet(sheetName);
  spreadsheet.DeleteSheet('Sheet1');

  addDataToWorksheet(spreadsheet, data, header, sheetName, restOptions);

  const buffer = spreadsheet.WriteToBuffer();
  if (!(buffer instanceof Uint8Array)) {
    logger.warn('Error generating file', buffer);
    throw new Error('Error generating file');
  }

  return buffer;
}

/**
 * Generate excel worksheet from data. Each key in data will be a separate worksheet
 * If headers is not provided, it will be generated from keys of the first row of data
 * Headers should have same keys as data
 *
 * @param data
 * @param options
 * @returns
 */
export async function generateExcelWorksheets(
  data: Record<string, any[]>,
  options: {
    headers?: Record<string, string[]>;
    boldHeader?: boolean;
    autoFilter?: boolean;
    autoSizeColumns?: boolean;
    freezeTopRow?: boolean;
  } = {}
) {
  const { headers, ...restOptions } = options;
  // TODO: fallback to normal XLSX if this fails
  const excelize = await getExcelize();

  const spreadsheet = excelize.NewFile();

  for (const [sheetName, sheetData] of Object.entries(data)) {
    spreadsheet.NewSheet(sheetName);
    const header = headers[sheetName] || Object.keys(sheetData[0]);
    addDataToWorksheet(spreadsheet, sheetData, header, sheetName, restOptions);
  }

  // delete default sheet
  spreadsheet.DeleteSheet('Sheet1');

  const buffer = spreadsheet.WriteToBuffer();
  if (!(buffer instanceof Uint8Array)) {
    logger.warn('Error generating file', buffer);
    throw new Error('Error generating file');
  }

  return buffer;
}

export function addDataToWorksheet(
  spreadsheet: NewFile,
  data: any[],
  header: string[],
  sheetName: string,
  options: {
    boldHeader?: boolean; // default true
    autoFilter?: boolean; // default true
    autoSizeColumns?: boolean; // default true
    freezeTopRow?: boolean; // default true
  } = {}
) {
  const { boldHeader = true, autoSizeColumns = true, autoFilter = true, freezeTopRow = true } = options;

  const columnAddresses = getColumnAddresses(header.length);
  const columnContentMaxWidths: number[] = [];

  // Add header row
  for (let i = 0; i < header.length; i++) {
    const value = header[i];
    columnContentMaxWidths[i] = (value.length || 10) * (boldHeader ? 1.2 : 1);
    spreadsheet.SetCellValue(sheetName, `${columnAddresses[i]}1`, value);
  }

  // Add all other rows
  for (let row = 0; row < data.length; row++) {
    for (let col = 0; col < header.length; col++) {
      const rowData = data[row];
      const cellAddress = `${columnAddresses[col]}${row + 2}`;

      let cellValue = rowData[header[col]] ?? '';

      if (cellValue && typeof cellValue === 'object') {
        cellValue = JSON.stringify(cellValue);
      }

      let setValueError: any;
      if (isString(cellValue)) {
        const { error } = spreadsheet.SetCellStr(sheetName, cellAddress, cellValue.substring(0, 32767));
        setValueError = error;
        columnContentMaxWidths[col] = Math.max(columnContentMaxWidths[col] || 0, cellValue?.length || 0);
      } else if (isBoolean(cellValue)) {
        const { error } = spreadsheet.SetCellBool(sheetName, cellAddress, cellValue);
        setValueError = error;
        columnContentMaxWidths[col] = Math.max(columnContentMaxWidths[col] || 0, 5);
      } else if (isNumber(cellValue)) {
        if (Number.isInteger(cellValue)) {
          const { error } = spreadsheet.SetCellInt(sheetName, cellAddress, cellValue);
          setValueError = error;
        } else {
          const { error } = spreadsheet.SetCellFloat(sheetName, cellAddress, cellValue, -1, 64);
          setValueError = error;
        }
        columnContentMaxWidths[col] = Math.max(columnContentMaxWidths[col] || 0, cellValue.toString().length || 0);
      } else {
        const { error } = spreadsheet.SetCellValue(sheetName, cellAddress, cellValue);
        setValueError = error;
      }

      // Fallback to JSON stringified value if we can't set the value
      if (setValueError) {
        logger.warn('Error setting cell value - falling back to string', setValueError);
        cellValue = JSON.stringify(cellValue).substring(0, 32767);
        spreadsheet.SetCellValue(sheetName, cellAddress, cellValue);
        columnContentMaxWidths[col] = Math.max(columnContentMaxWidths[col] || 0, cellValue.length || 0);
      }
    }
  }
  const firstCol = `${columnAddresses[0]}1`;
  const finalCol = `${columnAddresses[header.length - 1]}1`;
  const finalRowFirstCol = `A${data.length + 1}`;
  const finalRowFinalCol = `${columnAddresses[header.length - 1]}${data.length + 1}`;

  if (boldHeader) {
    const { style, error } = spreadsheet.NewStyle({
      // Border: [{ Type: 'bottom', Color: 'ff0000', Style: 1 }],
      Font: { Bold: true, Size: 14 },
    });

    if (!error) {
      spreadsheet.SetCellStyle(sheetName, firstCol, finalCol, style);
    } else {
      logger.warn('Error generating style', error);
    }
  }

  // TODO: should we detect columns with long text and wrap them?

  if (autoFilter) {
    // FIXME: this worked in published version but had a different signature
    spreadsheet.AutoFilter(sheetName, `${firstCol}:${finalRowFinalCol}`, {});
  }

  // FIXME: This does not seem to work correctly for some long cells
  // Also, auto-wrap is set but does not work correctly in GSheets (shows applied, but does not wrap without unsetting and re-setting)
  if (autoSizeColumns) {
    const { style } = spreadsheet.NewStyle({
      Alignment: { WrapText: true },
    });
    for (let col = 0; col < header.length; col++) {
      const value = clamp(columnContentMaxWidths[col], 10, 200);

      if (value > 100 && style) {
        spreadsheet.SetColStyle(sheetName, `${columnAddresses[col]}:${columnAddresses[col]}`, style);
      }

      const { error } = spreadsheet.SetColWidth(sheetName, columnAddresses[col], columnAddresses[col], value);
      if (error) {
        logger.warn('Error setting column width', error);
      }
    }
  }

  // freeze header
  if (freezeTopRow) {
    // https://xuri.me/excelize/en/utils.html#SetPanes
    spreadsheet.SetPanes(sheetName, {
      Freeze: true,
      Split: false,
      XSplit: 0,
      YSplit: 1,
      TopLeftCell: 'A1',
      ActivePane: 'topLeft',
    });
  }
}

/**
 * Get the Excel compatible column addresses for a given number of cells
 * Example:
 * numCells = 10
 * returns: ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J']
 */
function getColumnAddresses(numCells: number): string[] {
  const cellAddresses = [];

  for (let i = 0; i < numCells; i++) {
    const columnNumber = i + 1; // index start at 1
    let columnLetter = '';
    let divisor = columnNumber;
    while (divisor > 0) {
      const mod = (divisor - 1) % 26;
      columnLetter = String.fromCharCode(65 + mod) + columnLetter;
      divisor = Math.floor((divisor - mod) / 26);
    }

    cellAddresses.push(columnLetter);
  }

  return cellAddresses;
}
