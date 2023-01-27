import { QueryResultsColumn } from '@jetstream/api-interfaces';
import { DataType, FormulaData, FormulaDataValue } from 'formulon';
import isNil from 'lodash/isNil';

export function getFormulonTypeFromColumnType(col: QueryResultsColumn): DataType {
  if (col.booleanType) {
    return 'checkbox';
  } else if (col.numberType) {
    return 'number';
  } else if (col.apexType === 'Date') {
    return 'date';
  } else if (col.apexType === 'Time') {
    return 'time';
  } else if (col.apexType === 'Datetime') {
    return 'datetime';
  } else if (col.apexType === 'Location') {
    return 'geolocation';
  }
  return 'text';
}

export function getFormulonTypeFromValue(col: QueryResultsColumn, value: any): FormulaDataValue {
  const dataType = getFormulonTypeFromColumnType(col);
  if (isNil(value)) {
    return {
      type: 'literal',
      dataType: 'null',
      value: null,
    };
  }
  if (dataType === 'text') {
    return {
      type: 'literal',
      dataType: 'text',
      value,
      options: {
        length: value.length,
      },
    };
  }
  if (dataType === 'number') {
    return {
      type: 'literal',
      dataType: 'number',
      value,
      options: {
        length: value.length,
        scale: getPrecision(value),
      },
    };
  }
  return {
    type: 'literal',
    dataType,
    value,
  };
}

function getPrecision(a) {
  if (!isFinite(a)) return 0;
  let e = 1;
  let p = 0;
  while (Math.round(a * e) / e !== a) {
    e *= 10;
    p++;
  }
  return p;
}

export const formulaFunctions = [
  'ABS',
  'ADD',
  'ADDMONTHS',
  'AND',
  'BEGINS',
  'BLANKVALUE',
  'BR',
  'CASE',
  'CASESAFEID',
  'CEILING',
  'CONTAINS',
  // 'CURRENCYRATE', // NOT IMPLEMENTED
  'DATE',
  'DATETIMEVALUE',
  'DATEVALUE',
  'DAY',
  'DISTANCE',
  'DIVIDE',
  'EQUAL',
  'EXP',
  'EXPONENTIATE',
  'FIND',
  'FLOOR',
  'GEOLOCATION',
  'GETSESSIONID',
  'GREATERTHAN',
  'GREATERTHANOREQUAL',
  'HOUR',
  'HYPERLINK',
  'IF',
  'IMAGE',
  'INCLUDES',
  'ISBLANK',
  // 'ISNULL', // NOT IMPLEMENTED
  // 'ISNUMBER', // NOT IMPLEMENTED
  'ISPICKVAL',
  'LEFT',
  'LEN',
  'LESSTHAN',
  'LESSTHANOREQUAL',
  'LN',
  'LOG',
  'LOWER',
  'LPAD',
  'MAX',
  'MCEILING',
  'MFLOOR',
  'MID',
  'MILLISECOND',
  'MIN',
  'MINUTE',
  'MOD',
  'MONTH',
  'MULTIPLY',
  'NOT',
  'NOW',
  // 'NULLVALUE', // NOT IMPLEMENTED
  'OR',
  'REGEX',
  'RIGHT',
  'ROUND',
  'RPAD',
  'SECOND',
  'SQRT',
  'SUBSTITUTE',
  'SUBTRACT',
  'TEXT',
  'TIMENOW',
  'TIMEVALUE',
  'TODAY',
  'TRIM',
  'UNEQUAL',
  'UPPER',
  'VALUE',
  'WEEKDAY',
  'YEAR',
] as const;
