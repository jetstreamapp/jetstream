import { logger } from '@jetstream/shared/client-logger';
import type { NewFile, OpenReader } from 'excelize-wasm';
import { clamp } from 'lodash';

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

export async function generateExcelWorksheet(
  data: any[],
  options: {
    header?: string[];
    sheetName?: string;
    boldHeader?: boolean;
    autoSizeColumns?: boolean;
    freezeTopRow?: boolean;
  } = {}
) {
  const { header = Object.keys(data[0]), sheetName = 'Records', boldHeader = true, autoSizeColumns = true, freezeTopRow = true } = options;
  // TODO: fallback to normal XLSX if this fails
  const excelize = await getExcelize();

  const spreadsheet = excelize.NewFile();
  spreadsheet.SetSheetName('Sheet1', sheetName);

  const columnAddresses = getColumnAddresses(header.length);
  const columnContentMaxWidths: number[] = [];

  // Add header row
  for (let i = 0; i < header.length; i++) {
    const value = header[i];
    columnContentMaxWidths[i] = Math.max(columnContentMaxWidths[i] || 0, value.length || 0);
    spreadsheet.SetCellValue(sheetName, `${columnAddresses[i]}1`, value);
  }
  // Add all other rows
  for (let row = 0; row < data.length; row++) {
    for (let col = 0; col < header.length; col++) {
      const rowData = data[row];
      const cellAddress = `${columnAddresses[col]}${row + 2}`;
      let cellValue = rowData[header[col]] ?? ''; // TODO: confirm this value is "boolean | number | string" (date?)
      columnContentMaxWidths[col] = Math.max(columnContentMaxWidths[col] || 0, cellValue.length || 0);
      // maybe for dates we need to add a cell style?
      const { error } = spreadsheet.SetCellValue(sheetName, cellAddress, cellValue);
      if (error) {
        logger.warn('Error setting cell value - falling back to string', error);
        cellValue = JSON.stringify(cellValue);
        spreadsheet.SetCellValue(sheetName, cellAddress, cellValue);
        columnContentMaxWidths[col] = Math.max(columnContentMaxWidths[col] || 0, cellValue.length || 0);
      }
    }
  }

  if (boldHeader) {
    const { style, error } = spreadsheet.NewStyle(
      JSON.stringify({
        // Border: [{ Type: 'bottom', Color: 'ff0000', Style: 1 }],
        Font: { Bold: true },
      })
    );

    if (!error) {
      spreadsheet.SetCellStyle(sheetName, `${columnAddresses[0]}1`, `${columnAddresses[header.length - 1]}1`, style);
    } else {
      logger.warn('Error generating style', error);
    }
  }

  if (autoSizeColumns) {
    for (let col = 0; col < header.length; col++) {
      const value = clamp(columnContentMaxWidths[col], 10, 200);
      spreadsheet.SetColWidth(sheetName, columnAddresses[col], columnAddresses[col], value);
    }
  }

  // freeze header
  if (freezeTopRow) {
    // https://xuri.me/excelize/en/utils.html#SetPanes
    spreadsheet.SetPanes(
      sheetName,
      JSON.stringify({
        freeze: true,
        split: false,
        x_split: 0,
        y_split: 1,
        top_left_cell: 'A1',
        active_pane: 'topLeft',
      })
    );
  }

  const buffer = spreadsheet.WriteToBuffer();
  if (!(buffer instanceof Uint8Array)) {
    logger.warn('Error generating file', buffer);
    throw new Error('Error generating file');
  }

  return buffer;
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
