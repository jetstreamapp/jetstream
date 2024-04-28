import { REGEX } from '@jetstream/shared/utils';
import { FieldType } from '@jetstream/types';
import isBoolean from 'lodash/isBoolean';
import isObject from 'lodash/isObject';
import isString from 'lodash/isString';

type FieldValue = string | number | boolean | null;
type AtLeast<T, K extends keyof T> = Partial<T> & Pick<T, K>;
export type RecordToApexOptionsInitialOptions = AtLeast<RecordToApexOptions, 'sobjectName'>;

/** STRING CHARACTERS */
const EMPTY = '';
const COMMA = ',';
const NEWLINE = '\n';
const SPACE = ' ';
const TAB = '\t';
const SEMI = ';';
const PERIOD = '.';
const OPEN_PAREN = '(';
const CLOSE_PAREN = ')';
const OPEN_CLOSE_PAREN = `${OPEN_PAREN}${CLOSE_PAREN}`;
const EQ = `=`;
const EQ_SPACE = ` ${EQ} `;
const COMMA_NL = `${COMMA}${NEWLINE}`;
const COMMA_SPACE = `${COMMA} `;
const SEMI_NL = `${SEMI}${NEWLINE}`;
const NEW_SPACE = ` new `;
const PUBLIC = 'public';
const STATIC = 'static';
const RETURN = 'return';
const INSERT = 'insert';
const GET = 'get';
const OPEN_BRACKET = '{';
const CLOSE_BRACKET = '}';

/** CONSTANTS */
const NAMESPACE_RGX = /^.*?__/;
const SUFFIX_RGX = /__[a-z]+$/;

/** DEFAULTS */
const DEF_INLINE = true;
const DEF_WRAP_IN_METHOD = false;
const DEF_INDENTATION = 'spaces';
const DEF_TAB_SIZE = 2;
const DEF_TAB_SIZE_TABS = 1;
const DEF_REPLACE_DATE_W_TODAY = false;
const DEF_INSERT_STATEMENT = false;

export interface RecordToApexOptions {
  sobjectName: string;
  fieldMetadata: Record<string, FieldType>;
  /** Inline returned apex */
  inline: boolean;
  /** Surround code in method */
  wrapInMethod: boolean;
  /** Only applies if wrapInMethod=true, true if method should be static  */
  wrapInMethodStatic: boolean;
  /** If provided, the fields to include in Apex, otherwise all primitives are included */
  fields: string[];
  indentation: 'spaces' | 'tabs';
  tabSize: number;
  replaceDateWithToday: boolean;
  insertStatement: boolean;
  includeNullFields: boolean;
  includeBooleanIfFalse: boolean;
}

/**
 * TODO: handle date fields
 * TODO: FETCH METADATA OR REQUIRE TO BE PASSED IN
 */
export function recordToApex(record: any, initialOptions: RecordToApexOptionsInitialOptions): string {
  let output = '';
  if (isObject(record)) {
    const options = getDefaultOptions(record, initialOptions);
    const { inline, wrapInMethod, sobjectName } = options;
    const variableName = getVariableName(sobjectName);

    const fieldsApex = getFieldValues(record, options)
      .map((fields) => getFieldAsApex(fields, variableName, options))
      .join(inline ? COMMA_NL : SEMI_NL);

    if (inline) {
      //A_Custom_Obj__c obj = new A_Custom_Obj__c(
      //  foo = 'bar',
      //);
      output += `${sobjectName} ${variableName} ${EQ}${NEW_SPACE}${sobjectName}${OPEN_PAREN}${NEWLINE}${fieldsApex}${NEWLINE}${CLOSE_PAREN}${SEMI}`;
    } else {
      // A_Custom_Obj__c obj = new A_Custom_Obj__c();
      // obj.foo = 'bar';
      output += `${sobjectName} ${variableName} ${EQ}${NEW_SPACE}${sobjectName}${OPEN_PAREN}${CLOSE_PAREN}${SEMI_NL}`;
      output += `${fieldsApex}${SEMI}`;
    }

    if (wrapInMethod) {
      const methodName = `${GET}${variableName[0].toUpperCase()}${variableName.substring(1)}`;
      const lines = transformLinesForMethod(output, options);
      output = getMethodSignature(methodName, options);
      output += `${lines}${NEWLINE}${NEWLINE}`;
      output += getInsertStatement(variableName, options);
      output += getMethodReturn(variableName, options);
      output += CLOSE_BRACKET;
    } else {
      output += getInsertStatement(variableName, options);
    }
  }
  return output;
}

/**
 * Convert multiple records to apex
 * The records will always be constructed inline
 *
 * @param records any[]
 * @param initialOptions
 * @returns
 */
export function recordsToApex(records: any[], initialOptions: RecordToApexOptionsInitialOptions): string {
  const options = getDefaultOptions(records[0], initialOptions);
  const { wrapInMethod, sobjectName } = options;
  const variableName = getVariableName(sobjectName, true);

  // List<Account> accounts = new List<Account>{
  let output = `List<${sobjectName}> ${variableName} = new List<${sobjectName}>{\n`;

  output += records
    .map((record) => {
      if (isObject(record)) {
        const fieldsApex = getFieldValues(record, options)
          .map((fields) => getFieldAsApex(fields, variableName, options, true))
          .join(COMMA_SPACE);
        // new Account(foo = 'bar', bar = 'baz')
        return `${NEW_SPACE}${sobjectName}${OPEN_PAREN}${fieldsApex}${CLOSE_PAREN}`;
      }
      return '';
    })
    .filter(Boolean)
    .join(COMMA_NL);

  output += '\n};';

  if (wrapInMethod) {
    const methodName = `${GET}${variableName[0].toUpperCase()}${variableName.substring(1)}`;
    const lines = transformLinesForMethod(output, options);
    output = getMethodSignature(methodName, options, true);
    output += `${NEWLINE}${lines}${NEWLINE}${NEWLINE}`;
    output += getInsertStatement(variableName, options);
    output += getMethodReturn(variableName, options);
    output += CLOSE_BRACKET;
  } else {
    output += getInsertStatement(variableName, options);
  }
  return output;
}

/**
 * Initialize options
 * @param options
 * @returns
 */
function getDefaultOptions(record: any, options: RecordToApexOptionsInitialOptions): RecordToApexOptions {
  const indentation = options.indentation ?? DEF_INDENTATION;
  return {
    sobjectName: options.sobjectName,
    fieldMetadata: options.fieldMetadata ?? {},
    inline: options.inline ?? DEF_INLINE,
    wrapInMethod: options.wrapInMethod ?? DEF_WRAP_IN_METHOD,
    wrapInMethodStatic: options.wrapInMethodStatic ?? false,
    /** Use passed in fields or get fields from record */
    fields:
      Array.isArray(options.fields) && options.fields.length > 0
        ? options.fields
        : Object.keys(record).filter((field) => field !== 'attributes' && !isObject(record[field])),
    indentation,
    /** Inline spaces vs tabs has different defaults */
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    tabSize: Number.isFinite(options.tabSize) ? Math.abs(options.tabSize!) : indentation === 'spaces' ? DEF_TAB_SIZE : DEF_TAB_SIZE_TABS,
    replaceDateWithToday: options.replaceDateWithToday ?? DEF_REPLACE_DATE_W_TODAY,
    insertStatement: options.insertStatement ?? DEF_INSERT_STATEMENT,
    includeNullFields: options.includeNullFields ?? false,
    includeBooleanIfFalse: options.includeNullFields ?? false,
  };
}

function getMethodSignature(methodName: string, options: RecordToApexOptions, isList = false) {
  const { wrapInMethodStatic, sobjectName } = options;
  const staticStr = wrapInMethodStatic ? `${STATIC}${SPACE}` : '';
  return `${PUBLIC} ${staticStr}${
    isList ? `List<${sobjectName}>` : sobjectName
  } ${methodName}${OPEN_CLOSE_PAREN} ${OPEN_BRACKET}${NEWLINE}`;
}

function transformLinesForMethod(output: string, options: RecordToApexOptions) {
  return output
    .split(NEWLINE)
    .map((value) => `${getIndentation(options)}${value}`)
    .join(NEWLINE);
}

/**
 * Returns an insert statement if options enable it, otherwise returns empty string
 *
 * @param variableName
 * @param options
 * @returns
 */
function getInsertStatement(variableName: string, options: RecordToApexOptions) {
  const { wrapInMethod, insertStatement } = options;
  if (!insertStatement) {
    return '';
  }
  if (wrapInMethod) {
    return `${getIndentation(options)}${INSERT}${SPACE}${variableName}${SEMI}${NEWLINE}${NEWLINE}`;
  }
  return `${NEWLINE}${NEWLINE}${INSERT}${SPACE}${variableName}${SEMI}`;
}

function getMethodReturn(variableName: string, options: RecordToApexOptions) {
  return `${getIndentation(options)}${RETURN}${SPACE}${variableName}${SEMI}${NEWLINE}`;
}

function getVariableName(sobjectName: string, plural = false) {
  let tempName = sobjectName;
  if (REGEX.HAS_NAMESPACE.test(tempName)) {
    tempName = tempName.replace(NAMESPACE_RGX, '');
  }
  // remove suffix (e.x. __c) and any non-alpha character
  tempName = tempName.replace(SUFFIX_RGX, '').replace(REGEX.NOT_ALPHA, '');
  // make first character lowercase
  tempName = `${tempName[0].toLowerCase()}${tempName.substring(1)}`;
  return `${tempName}${plural ? 's' : ''}`;
}

function getFieldValues(record: any, options: RecordToApexOptions): [string, FieldValue][] {
  const { fields, fieldMetadata, replaceDateWithToday, includeNullFields, includeBooleanIfFalse } = options;
  return fields
    .filter(
      (field) =>
        field in record &&
        !isObject(record[field]) &&
        (includeNullFields || record[field] !== null) &&
        (includeBooleanIfFalse || !isBoolean(record[field] || record[field]))
    )
    .map((field): [string, FieldValue] => {
      if (isString(record[field])) {
        if (fieldMetadata[field] === 'date' || fieldMetadata[field] === 'datetime') {
          return [field, getDateOrDatetimeValue(record[field], fieldMetadata[field] === 'datetime', replaceDateWithToday)];
        }
        if (fieldMetadata[field] === 'time') {
          return [field, getTimeValue(record[field])];
        }
        return [field, `'${record[field].replaceAll(`'`, `\\'`)}'`];
      } else {
        return [field, record[field] as FieldValue];
      }
    });
}

/**
 * Format is assumed to be SFDC API return format: 2020-11-01T06:00:00.000+0000
 * @param value
 * @param isDatetime
 * @param replaceDateWithToday
 * @returns
 */
function getDateOrDatetimeValue(value: string, isDatetime: boolean, replaceDateWithToday: boolean): string {
  if (isDatetime && replaceDateWithToday) {
    return `Datetime.now()`;
  } else if (isDatetime) {
    return `(Datetime) JSON.deserialize('"${value}"', Datetime.class)`;
  } else if (replaceDateWithToday) {
    return `Date.today()`;
  }
  return `(Date) JSON.deserialize('"${value}"', Date.class)`;
}

/**
 * Return time string formatted as `16:20:00.000Z` to `Time.newInstance(16, 20, 0, 0);`
 */
function getTimeValue(value: string): string {
  const [hours, minutes, secondsTemp] = value.split(':');
  const [seconds, milliseconds] = secondsTemp.split('.');
  return `Time.newInstance(${Number(hours)}, ${Number(minutes)}, ${Number(seconds)}, ${Number.parseInt(milliseconds)})`;
}

function getFieldAsApex([field, value]: [string, FieldValue], variableName: string, options: RecordToApexOptions, isList = false): string {
  const { inline } = options;
  if (isString(value)) {
    value = value.replaceAll('\n', '\\n');
  }
  if (inline) {
    return `${isList ? '' : getIndentation(options)}${field}${EQ_SPACE}${value}`;
  } else {
    return `${variableName}${PERIOD}${field}${EQ_SPACE}${value}`;
  }
}

function getIndentation(options: RecordToApexOptions): string {
  const { indentation, tabSize } = options;
  return new Array(tabSize).fill(indentation === 'spaces' ? SPACE : TAB).join(EMPTY);
}
