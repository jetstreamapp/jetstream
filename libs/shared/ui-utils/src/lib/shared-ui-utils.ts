import { logger } from '@jetstream/shared/client-logger';
import { DATE_FORMATS, HTTP, INPUT_ACCEPT_FILETYPES } from '@jetstream/shared/constants';
import {
  anonymousApex,
  checkMetadataResults,
  checkMetadataRetrieveResults,
  checkMetadataRetrieveResultsAndDeployToTarget,
} from '@jetstream/shared/data';
import { NOOP, REGEX, delay, ensureBoolean, orderObjectsBy } from '@jetstream/shared/utils';
import type {
  AndOr,
  BulkJobWithBatches,
  ChangeSet,
  DeployOptions,
  DeployResult,
  DescribeGlobalSObjectResult,
  DescribeSObjectResult,
  ErrorResult,
  ExpressionConditionRowSelectedItems,
  ExpressionConditionType,
  ExpressionGroupType,
  ExpressionType,
  Field,
  ListItem,
  Maybe,
  MimeType,
  Nullable,
  PermissionSetRecord,
  PermissionSetWithProfileRecord,
  PositionAll,
  QueryFieldWithPolymorphic,
  QueryFilterOperator,
  RetrieveResult,
  SalesforceOrgUi,
  SalesforceOrgUiType,
  UseReducerFetchAction,
  UseReducerFetchState,
} from '@jetstream/types';
import {
  HavingClause,
  HavingClauseWithRightCondition,
  LiteralType,
  Operator,
  ValueCondition,
  ValueFunctionCondition,
  ValueWithDateLiteralCondition,
  WhereClause,
  WhereClauseWithRightCondition,
} from '@jetstreamapp/soql-parser-js';
import { parseISO } from 'date-fns/parseISO';
import { saveAs } from 'file-saver';
import safeGet from 'lodash/get';
import isFunction from 'lodash/isFunction';
import isNil from 'lodash/isNil';
import isString from 'lodash/isString';
import isUndefined from 'lodash/isUndefined';
import numeral from 'numeral';
import { UnparseConfig, parse as parseCsv, unparse, unparse as unparseCsv } from 'papaparse';
import { Placement as tippyPlacement } from 'tippy.js';
import * as XLSX from 'xlsx';

initXlsx(XLSX);

/**
 * Lazy load cpexcel since it appears it was failing to load for at least one user
 * https://github.com/jetstreamapp/jetstream/issues/211
 * https://git.sheetjs.com/sheetjs/sheetjs/issues/2900
 */
export function initXlsx(_xlsx: typeof import('xlsx')) {
  import('xlsx/dist/cpexcel.full.mjs')
    .then((module) => {
      _xlsx.set_cptable(module);
    })
    .catch((ex) => {
      // ignore error
    });
}

export function formatNumber(number?: number) {
  return numeral(number || 0).format('0,0');
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function parseQueryParams<T = any>(queryString: string): T {
  const pairs = (queryString[0] === '?' ? queryString.substr(1) : queryString).split('&');
  return pairs.reduce((query: Partial<T>, currPair) => {
    const [key, value] = currPair.split('=');
    query[decodeURIComponent(key)] = decodeURIComponent(value || '');
    return query;
  }, {}) as T;
}

export function parseCookie<T>(cookieName: string): T | null {
  const cookieStrRegex: RegExpExecArray | null = RegExp(`${cookieName}[^;]+`).exec(document.cookie);
  const cookieStr = decodeURIComponent(cookieStrRegex ? cookieStrRegex.toString().replace(/^[^=]+./, '') : '');
  if (cookieStr.startsWith('j:')) {
    try {
      return JSON.parse(cookieStr.slice(2));
    } catch (ex) {
      this.log.warn('Could not parse cookie');
      return null;
    }
  }
  return null;
}

export function eraseCookies() {
  document.cookie.split(';').forEach((cookie) => {
    const [name] = cookie.trim().split('=');
    document.cookie = `${name}=; expires=${Number(new Date())}; domain=${document.domain}; path=/`;
  });
}

type FieldAccumulator<T> = {
  id: Nullable<T>;
  name: Nullable<T>;
  remaining: T[];
};

export function sortQueryFields<T extends Pick<Field, 'name' | 'label'>>(fields: T[]): T[] {
  // partition name and id field out, then append to front
  const reducedFields = orderObjectsBy(fields, 'label').reduce(
    (out: FieldAccumulator<T>, field) => {
      if (field.name === 'Id') {
        out.id = field;
      } else if (field.name === 'Name') {
        out.name = field;
      } else {
        out.remaining.push(field);
      }
      return out;
    },
    {
      id: null,
      name: null,
      remaining: [],
    }
  );

  const firstItems: T[] = [];
  if (reducedFields.id) {
    firstItems.push(reducedFields.id);
  }
  if (reducedFields.name) {
    firstItems.push(reducedFields.name);
  }

  return firstItems.concat(reducedFields.remaining);
}

export function sortQueryFieldsStr(fields: string[]): string[] {
  // partition name and id field out, then append to front
  const reducedFields = fields.reduce(
    (out: FieldAccumulator<string>, field) => {
      if (field === 'Id') {
        out.id = field;
      } else if (field === 'Name') {
        out.name = field;
      } else {
        out.remaining.push(field);
      }
      return out;
    },
    {
      id: null,
      name: null,
      remaining: [],
    }
  );

  const firstItems: string[] = [];
  if (reducedFields.id) {
    firstItems.push(reducedFields.id);
  }
  if (reducedFields.name) {
    firstItems.push(reducedFields.name);
  }

  return firstItems.concat(reducedFields.remaining);
}

/**
 * Sort fields, Id and Name are first, then remaining fields
 * Relationship fields will always sort in order with the current relationship level
 * This is required to ensure that TYPEOF fields are processed accurately
 *
 * USAGE:
 * [{...}].sort(sortQueryFieldsPolymorphicComparable)
 *
 * NOTE: this is slow algorithm as it is recursive through relationships
 * But the input values is not extremely high, so it should be ok
 *
 * May be worth investing in some optimization
 */
export function sortQueryFieldsPolymorphicComparable(field1: QueryFieldWithPolymorphic, field2: QueryFieldWithPolymorphic): number {
  const a = `${field1.field || ''}`.toLocaleLowerCase();
  const aParts = a.split('.');
  const b = `${field2.field || ''}`.toLocaleLowerCase();
  const bParts = b.split('.');
  if (a === b) {
    return 0;
  } else if (a === 'id') {
    return -1;
  } else if (b === 'id') {
    return 1;
  } else if (a === 'name') {
    return -1;
  } else if (b === 'name') {
    return 1;
  } else if (aParts.length === 1 || bParts.length === 1) {
    if (a < b) {
      return -1;
    } else if (a > b) {
      return 1;
    }
    return 0;
  } else {
    // has related fields, remove first element and sort based on remaining parts
    const aRoot = aParts.shift();
    const bRoot = bParts.shift();
    if (aRoot === bRoot) {
      return sortQueryFieldsPolymorphicComparable(
        { field: aParts.join('.'), polymorphicObj: field1.polymorphicObj } as any,
        { field: bParts.join('.'), polymorphicObj: field2.polymorphicObj } as any
      );
    } else {
      if (a < b) {
        return -1;
      } else if (a > b) {
        return 1;
      }
      return 0;
    }
  }
}

export function polyfillFieldDefinition(field: Field): string {
  if (!field) {
    return '';
  }
  const autoNumber: boolean = field.autoNumber;
  const { type, calculated, calculatedFormula, externalId, nameField, extraTypeInfo, length, precision, referenceTo, scale } = field;
  let prefix = '';
  let suffix = '';
  let value = '';

  if (calculated && calculatedFormula) {
    prefix = 'Formula(';
    suffix = ')';
  } else if (calculated) {
    prefix = 'Roll-Up Summary(';
    suffix = ')';
  } else if (externalId) {
    suffix = ' (External Id)';
  }

  if (type === 'id') {
    value = `Lookup()`;
  } else if (autoNumber) {
    value = `Auto Number`;
  } else if (nameField) {
    value = 'Name';
  } else if (type === 'textarea' && extraTypeInfo === 'plaintextarea') {
    value = `${length > 255 ? 'Long ' : ''}Text Area(${length})`;
  } else if (type === 'textarea' && extraTypeInfo === 'richtextarea') {
    value = `Rich Text Area(${length})`;
  } else if (isRelationshipField(field)) {
    // includes text/reference if referenceTo has data
    value = `Lookup(${(referenceTo || []).join(',')})`;
  } else if (type === 'string') {
    value = `Text(${length})`;
  } else if (type === 'boolean') {
    value = 'Checkbox';
  } else if (type === 'datetime') {
    value = 'Date/Time';
  } else if (type === 'currency') {
    value = `Currency(${precision}, ${scale})`;
  } else if (calculated && !calculatedFormula && !autoNumber) {
    value = `Number`;
  } else if (type === 'double' || type === 'int') {
    if (calculated) {
      value = `Number`;
    } else {
      value = `Number(${precision}, ${scale})`;
    }
  } else if (type === 'encryptedstring') {
    value = `Text (Encrypted)(${length})`;
  } else if (type === 'location') {
    value = 'Geolocation';
  } else if (type === 'percent') {
    value = `Percent(${precision}, ${scale})`;
  } else if (type === 'url') {
    value = `URL(${length})`;
  } else {
    // Address, Email, Date, Time, picklist, phone
    value = `${type[0].toUpperCase()}${type.substring(1)}`;
  }

  return `${prefix}${value}${suffix}`;
}

/**
 * Prepares excel file
 * @param data Array of objects for one sheet, or map of multiple objects where the key is sheet name
 * @param header Array of strings id data is array, or map of strings[] where the key matches the sheet name This will be auto-detected if not provided
 * @param [defaultSheetName]
 * @returns excel file
 */
export function prepareExcelFile(data: any[], header?: string[], defaultSheetName?: string): ArrayBuffer;
export function prepareExcelFile(data: Record<string, any[]>, header?: Record<string, string[]>, defaultSheetName?: void): ArrayBuffer;
export function prepareExcelFile(data: any, header: any, defaultSheetName: any = 'Records'): ArrayBuffer {
  const workbook = XLSX.utils.book_new();

  if (Array.isArray(data)) {
    header = header || Object.keys(data[0]);
    const worksheet = XLSX.utils.aoa_to_sheet(convertArrayOfObjectToArrayOfArray(data, header as string[]));
    XLSX.utils.book_append_sheet(workbook, worksheet, defaultSheetName);
  } else {
    Object.keys(data).forEach((sheetName) => {
      if (data[sheetName].length > 0) {
        let currentHeader = header && header[sheetName];
        let isArrayOfArray = false;
        if (!currentHeader) {
          if (Array.isArray(data[sheetName][0])) {
            isArrayOfArray = true;
          } else {
            currentHeader = Object.keys(data[sheetName][0]);
          }
        }
        XLSX.utils.book_append_sheet(
          workbook,
          XLSX.utils.aoa_to_sheet(isArrayOfArray ? data[sheetName] : convertArrayOfObjectToArrayOfArray(data[sheetName], currentHeader)),
          sheetName
        );
      }
    });
  }

  return excelWorkbookToArrayBuffer(workbook);
}

export function excelWorkbookToArrayBuffer(workbook: XLSX.WorkBook): ArrayBuffer {
  // https://github.com/sheetjs/sheetjs#writing-options
  const workbookArrayBuffer: ArrayBuffer = XLSX.write(workbook, {
    bookType: 'xlsx',
    bookSST: false,
    type: 'array', // ArrayBuffer
  });
  return workbookArrayBuffer;
}

export function prepareCsvFile(data: Record<string, string>[], header: string[]): string {
  return unparse(
    {
      data,
      fields: header,
    },
    { header: true, quotes: true, delimiter: detectDelimiter() }
  );
}

/**
 * Helper method to allow auto-detecting column widths for excel export
 */
export function getMaxWidthFromColumnContent(data: string[][], skipRows: Set<number> = new Set(), defaultIfSkipped = 15): XLSX.ColInfo[] {
  const output: number[] = [];
  data.forEach((row, rowIdx) => {
    row.forEach((col, i) => {
      if (skipRows.has(rowIdx)) {
        output[i] = defaultIfSkipped;
        return;
      }
      const width = `${col || ''}`.length;
      output[i] = output[i] || 0;
      output[i] = output[i] > width ? output[i] : width;
    });
  });
  return output.map((width): XLSX.ColInfo => ({ width: width + 2 }));
}

export function getFilename(org: SalesforceOrgUi, parts: string[]) {
  return `${parts.join('-')}-${org.username}-${new Date().getTime()}`.replace(REGEX.SAFE_FILENAME, '_');
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function saveFile(content: any, filename: string, type: MimeType) {
  const blob = new Blob([content], { type });
  saveAs(blob, filename);
}

export function arrayBufferToBase64(buffer: ArrayBuffer): string {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

export function base64ToArrayBuffer(base64: string): ArrayBuffer {
  return Uint8Array.from(atob(base64), (c) => c.charCodeAt(0)).buffer;
}

export function convertTippyPlacementToSlds(placement: tippyPlacement): PositionAll | null {
  switch (placement) {
    case 'left':
      return 'right';
    case 'left-start':
      return 'right-bottom';
    case 'left-end':
      return 'right-top';
    case 'right':
      return 'left';
    case 'right-start':
      return 'left-bottom';
    case 'right-end':
      return 'left-top';
    case 'top':
      return 'bottom';
    case 'top-start':
      return 'bottom-right';
    case 'top-end':
      return 'bottom-left';
    case 'bottom':
      return 'top';
    case 'bottom-start':
      return 'top-right';
    case 'bottom-end':
      return 'top-left';
    default:
      return null;
  }
}

export function queryFilterHasValue(row: ExpressionConditionType) {
  const hasValue = Array.isArray(row.selected.value) ? row.selected.value.length : !!row.selected.value;
  return (
    row.selected.operator &&
    row.selected.resource &&
    (hasValue || row.selected.operator === 'isNull' || row.selected.operator === 'isNotNull')
  );
}
// did not want to have circular imports
function isExpressionConditionType(value: any): value is ExpressionConditionType {
  return !Array.isArray(value.rows);
}

export function convertFiltersToWhereClause<T extends WhereClause | HavingClause>(filters: ExpressionType): T | undefined {
  if (!filters) {
    return;
  }
  logger.log({ filters });

  // Process all where clauses
  const whereOrHavingClauses = filters.rows.reduce((whereOrHavingClauses: T[], row, i) => {
    if (isExpressionConditionType(row)) {
      if (queryFilterHasValue(row)) {
        buildExpressionConditionWhereClause(whereOrHavingClauses, row, filters.action);
      }
    } else {
      const group = { ...row };
      group.rows = group.rows.filter(queryFilterHasValue);
      if (group.rows.length > 0) {
        buildExpressionGroupConditionWhereClause(whereOrHavingClauses, group, filters.action);
      }
    }
    return whereOrHavingClauses;
  }, []);

  if (!whereOrHavingClauses.length) {
    return;
  }

  // combine all where clauses
  const rootClause = whereOrHavingClauses[0];
  whereOrHavingClauses.reduce((whereOrHavingClause: T, currClause, i) => {
    if (whereOrHavingClause) {
      // TODO: should have better types
      (whereOrHavingClause as any).right = currClause;
      // use current operator as the prior operator (e.x. AND on this item applies to the prior item and this item)
      // whereClauses[i - 1].operator = currWhereClause.operator;
    }
    // if (i === whereClauses.length && currWhereClause.operator) {
    //   currWhereClause.operator = undefined;
    // }
    return currClause;
  });

  return rootClause;
}

export function getOperatorFromWhereClause(operator: Operator, value: string, hasNegation = false): QueryFilterOperator {
  // Some invalid queries have value as an array
  value = !value || typeof value !== 'string' ? '' : value;
  operator = (operator?.toUpperCase() as Operator) || operator;
  switch (operator) {
    case '=':
      if (value?.toLowerCase() === 'null') {
        return 'isNull';
      }
      return 'eq';
    case '!=':
      if (value?.toLowerCase() === 'null') {
        return 'isNotNull';
      }
      return 'ne';
    case '<=':
      return 'lte';
    case '>=':
      return 'gte';
    case '>':
      return 'gt';
    case '<':
      return 'lt';
    case 'LIKE':
      if ((value.startsWith('%') && value.endsWith('%')) || (value.startsWith(`'%`) && value.endsWith(`%'`))) {
        return hasNegation ? 'doesNotContain' : 'contains';
      } else if (value.startsWith('%') || value.startsWith(`'%`)) {
        return hasNegation ? 'doesNotEndWith' : 'endsWith';
      } else {
        return hasNegation ? 'doesNotStartWith' : 'startsWith';
      }
    case 'IN':
      return 'in';
    case 'NOT IN':
      return 'notIn';
    case 'INCLUDES':
      return 'includes';
    case 'EXCLUDES':
      return 'excludes';
    default:
      return 'eq';
  }
}

/**
 * Build where clauses from filter rows
 */
function buildExpressionConditionWhereClause<T extends WhereClause | HavingClause>(
  whereOrHavingClauses: T[],
  row: ExpressionConditionType,
  action: AndOr
): T[] {
  // REGULAR WHERE CLAUSE
  if (isNegationOperator(row.selected.operator)) {
    (whereOrHavingClauses as (WhereClause | HavingClause)[]).push({
      left: { openParen: 1 },
      operator: 'NOT',
    });
    (whereOrHavingClauses as (WhereClause | HavingClause)[]).push({
      left: {
        fn: row.selected.function
          ? {
              functionName: row.selected.function,
              parameters: [row.selected.resource],
            }
          : undefined,
        operator: convertQueryFilterOperator(row.selected.operator),
        logicalPrefix: isNegationOperator(row.selected.operator) ? 'NOT' : undefined,
        field: row.selected.resource,
        value: getValue(row.selected.operator, row.selected.value),
        literalType: getLiteralType(row.selected, row.selected.function),
        closeParen: 1,
      } as ValueCondition | ValueWithDateLiteralCondition | ValueFunctionCondition,
      operator: action,
    });
  } else {
    // REGULAR WHERE CLAUSE
    (whereOrHavingClauses as (WhereClause | HavingClause)[]).push({
      left: {
        fn: row.selected.function
          ? {
              functionName: row.selected.function,
              parameters: [row.selected.resource],
            }
          : undefined,
        operator: convertQueryFilterOperator(row.selected.operator),
        logicalPrefix: isNegationOperator(row.selected.operator) ? 'NOT' : undefined,
        field: row.selected.resource,
        value: getValue(row.selected.operator, row.selected.value),
        literalType: getLiteralType(row.selected, row.selected.function),
      } as ValueCondition | ValueWithDateLiteralCondition | ValueFunctionCondition,
      operator: action,
    });
  }
  return whereOrHavingClauses;
}

function buildExpressionGroupConditionWhereClause<T extends WhereClause | HavingClause>(
  whereOrHavingClauses: T[],
  group: ExpressionGroupType,
  parentAction: AndOr
): T[] {
  const tempWhereOrHavingClauses: (WhereClauseWithRightCondition | HavingClauseWithRightCondition)[] = [];
  group.rows.forEach((row, i) => {
    const whereOrHavingClause: Partial<WhereClauseWithRightCondition | HavingClauseWithRightCondition> = {
      left: {
        operator: convertQueryFilterOperator(row.selected.operator),
        logicalPrefix: isNegationOperator(row.selected.operator) ? 'NOT' : undefined,
        field: row.selected.resource,
        value: getValue(row.selected.operator, row.selected.value),
        literalType: getLiteralType(row.selected),
      } as ValueCondition | ValueWithDateLiteralCondition,
      // for final row, use the parent action as the operator so that the next filter does not get the group's operator
      operator: i === group.rows.length - 1 ? parentAction : group.action,
    };
    // Add additional where clause
    if (isNegationOperator(row.selected.operator)) {
      const negationCondition: Partial<WhereClauseWithRightCondition | HavingClauseWithRightCondition> = {
        left: { openParen: 1 },
        operator: 'NOT',
      };
      (whereOrHavingClause.left as ValueCondition | ValueWithDateLiteralCondition).closeParen = 1;
      tempWhereOrHavingClauses.push(negationCondition as WhereClauseWithRightCondition | HavingClauseWithRightCondition);
      whereOrHavingClauses.push(negationCondition as T);
    }
    tempWhereOrHavingClauses.push(whereOrHavingClause as WhereClauseWithRightCondition | HavingClauseWithRightCondition);
    whereOrHavingClauses.push(whereOrHavingClause as T);
  });
  if (tempWhereOrHavingClauses[0].left.openParen) {
    tempWhereOrHavingClauses[0].left.openParen += 1;
  } else {
    tempWhereOrHavingClauses[0].left.openParen = 1;
  }
  const currentLeft = tempWhereOrHavingClauses[tempWhereOrHavingClauses.length - 1].left as ValueCondition | ValueWithDateLiteralCondition;
  if (currentLeft.closeParen) {
    currentLeft.closeParen += 1;
  } else {
    currentLeft.closeParen = 1;
  }

  return whereOrHavingClauses;
}

export function isNegationOperator(operator: Maybe<QueryFilterOperator>): boolean {
  switch (operator) {
    case 'doesNotContain':
    case 'doesNotStartWith':
    case 'doesNotEndWith':
      return true;
    default:
      return false;
  }
}

function getValue(operator: Maybe<QueryFilterOperator>, value: string | string[]): string | string[] {
  value = value || '';
  value = Array.isArray(value) ? value.map(escapeSoqlString) : escapeSoqlString(value);
  switch (operator) {
    case 'contains':
    case 'doesNotContain':
      return `%${value}%`;
    case 'startsWith':
    case 'doesNotStartWith':
      return `${value}%`;
    case 'endsWith':
    case 'doesNotEndWith':
      return `%${value}`;
    case 'isNull':
    case 'isNotNull':
      return `NULL`;
    case 'in':
    case 'notIn':
    case 'includes':
    case 'excludes':
      return Array.isArray(value)
        ? value
        : value
            .split('\n')
            .map((value) => value.trim())
            .filter((item) => item !== '');
    default:
      return value;
  }
}

export function escapeSoqlString(value: string) {
  if (!value) {
    return value;
  }
  // https://github.com/packagestats/sql-escape/blob/master/index.js
  // return value.replace(/[\0\x08\x09\x1a\n\r"'\\\%]/g, (char) => {
  return value.replace(/['\\\%]/g, (char) => {
    // prepends a backslash to backslash, percent, and double/single quotes
    return '\\' + char;
  });
}

export function unescapeSoqlString(value: string) {
  if (!value) {
    return value;
  }

  return value
    .replace(REGEX.ESCAPED_SINGLE_QUOTE, `'`)
    .replace(REGEX.ESCAPED_PERCENT_QUOTE, `%`)
    .replace(REGEX.ESCAPED_BACKSLASH_QUOTE, `\\`);
}

/**
 * Allows case-insensitive lookup
 * @returns a map of lowercase function names to their proper case
 */
export function getLowercaseFieldFunctionMap(): Record<string, string> {
  return [
    'AVG',
    'COUNT',
    'COUNT_DISTINCT',
    'MIN',
    'MAX',
    'SUM',
    'CALENDAR_MONTH',
    'CALENDAR_QUARTER',
    'CALENDAR_YEAR',
    'DAY_IN_MONTH',
    'DAY_IN_WEEK',
    'DAY_IN_YEAR',
    'DAY_ONLY',
    'FISCAL_MONTH',
    'FISCAL_QUARTER',
    'FISCAL_YEAR',
    'HOUR_IN_DAY',
    'WEEK_IN_MONTH',
    'WEEK_IN_YEAR',
  ].reduce((acc, item) => {
    acc[item.toLowerCase()] = item;
    return acc;
  }, {});
}

function getLiteralType(selected: ExpressionConditionRowSelectedItems, functionName?: Maybe<string>): LiteralType {
  const field: Field = safeGet(selected, 'resourceMeta.metadata', safeGet(selected, 'resourceMeta'));

  if (selected.operator === 'isNull' || selected.operator === 'isNotNull') {
    return 'NULL';
  }

  if (field && functionName) {
    switch (functionName) {
      case 'AVG':
      case 'COUNT':
      case 'COUNT_DISTINCT':
      case 'MIN':
      case 'MAX':
      case 'SUM':
        return 'INTEGER';
      case 'CALENDAR_MONTH':
      case 'CALENDAR_QUARTER':
      case 'CALENDAR_YEAR':
      case 'DAY_IN_MONTH':
      case 'DAY_IN_WEEK':
      case 'DAY_IN_YEAR':
      case 'DAY_ONLY':
      case 'FISCAL_MONTH':
      case 'FISCAL_QUARTER':
      case 'FISCAL_YEAR':
      case 'HOUR_IN_DAY':
      case 'WEEK_IN_MONTH':
      case 'WEEK_IN_YEAR':
        if (selected.resourceType === 'SELECT') {
          return 'DATE_LITERAL';
        }
        return 'INTEGER';
    }
  }

  if (field) {
    switch (field.type) {
      case 'boolean':
        return 'BOOLEAN';
      case 'double':
      case 'currency':
      case 'percent':
        return 'DECIMAL';
      case 'int':
        return 'INTEGER';
      case 'date':
        if (selected.resourceType === 'SELECT') {
          return 'DATE_LITERAL';
        }
        return 'DATE';
      case 'datetime':
        if (selected.resourceType === 'SELECT') {
          return 'DATE_LITERAL';
        }
        return 'DATETIME';
      default:
        return 'STRING';
    }
  }
  return 'STRING';
}

function convertQueryFilterOperator(operator: Maybe<QueryFilterOperator>): Operator {
  switch (operator) {
    case 'eq':
    case 'isNull':
      return '=';
    case 'ne':
    case 'isNotNull':
      return '!=';
    case 'lt':
      return '<';
    case 'lte':
      return '<=';
    case 'gt':
      return '>';
    case 'gte':
      return '>=';
    case 'in':
      return 'IN';
    case 'notIn':
      return 'NOT IN';
    case 'includes':
      return 'INCLUDES';
    case 'excludes':
      return 'EXCLUDES';
    case 'contains':
    case 'doesNotContain':
    case 'startsWith':
    case 'doesNotStartWith':
    case 'endsWith':
    case 'doesNotEndWith':
      return 'LIKE';
    default:
      return '=';
  }
}

/**
 * Generate authentication in the url from a salesforce
 * @param org
 */
export function getOrgUrlParams(org: SalesforceOrgUi, additionalParams: { [param: string]: string } = {}): string {
  return new URLSearchParams({
    ...additionalParams,
    [HTTP.HEADERS.X_SFDC_ID]: org?.uniqueId || '',
  }).toString();
}

export function getOrgType(org: Maybe<SalesforceOrgUi>): SalesforceOrgUiType | undefined {
  if (org?.uniqueId) {
    if (org.orgIsSandbox) {
      return 'Sandbox';
    }
    return org.orgOrganizationType === 'Developer Edition' ? 'Developer' : 'Production';
  }
  return undefined;
}
// TODO: add support for N date literals
export function getDateLiteralListItems(): ListItem<string, { hasUserInput: boolean }>[] {
  return [
    { id: 'YESTERDAY', label: 'YESTERDAY', value: 'YESTERDAY', meta: { hasUserInput: false } },
    { id: 'TODAY', label: 'TODAY', value: 'TODAY', meta: { hasUserInput: false } },
    { id: 'TOMORROW', label: 'TOMORROW', value: 'TOMORROW', meta: { hasUserInput: false } },
    { id: 'LAST_WEEK', label: 'LAST_WEEK', value: 'LAST_WEEK', meta: { hasUserInput: false } },
    { id: 'THIS_WEEK', label: 'THIS_WEEK', value: 'THIS_WEEK', meta: { hasUserInput: false } },
    { id: 'NEXT_WEEK', label: 'NEXT_WEEK', value: 'NEXT_WEEK', meta: { hasUserInput: false } },
    { id: 'LAST_MONTH', label: 'LAST_MONTH', value: 'LAST_MONTH', meta: { hasUserInput: false } },
    { id: 'THIS_MONTH', label: 'THIS_MONTH', value: 'THIS_MONTH', meta: { hasUserInput: false } },
    { id: 'NEXT_MONTH', label: 'NEXT_MONTH', value: 'NEXT_MONTH', meta: { hasUserInput: false } },
    { id: 'LAST_90_DAYS', label: 'LAST_90_DAYS', value: 'LAST_90_DAYS', meta: { hasUserInput: false } },
    { id: 'NEXT_90_DAYS', label: 'NEXT_90_DAYS', value: 'NEXT_90_DAYS', meta: { hasUserInput: false } },
    // { id: 'LAST_N_DAYS:n', label: 'LAST_N_DAYS:n', value: 'LAST_N_DAYS:n', meta: { hasUserInput: true } },
    // { id: 'NEXT_N_DAYS:n', label: 'NEXT_N_DAYS:n', value: 'NEXT_N_DAYS:n', meta: { hasUserInput: true } },
    // { id: 'NEXT_N_WEEKS:n', label: 'NEXT_N_WEEKS:n', value: 'NEXT_N_WEEKS:n', meta: { hasUserInput: true } },
    // { id: 'LAST_N_WEEKS:n', label: 'LAST_N_WEEKS:n', value: 'LAST_N_WEEKS:n', meta: { hasUserInput: true } },
    // { id: 'NEXT_N_MONTHS:n', label: 'NEXT_N_MONTHS:n', value: 'NEXT_N_MONTHS:n', meta: { hasUserInput: true } },
    // { id: 'LAST_N_MONTHS:n', label: 'LAST_N_MONTHS:n', value: 'LAST_N_MONTHS:n', meta: { hasUserInput: true } },
    { id: 'THIS_QUARTER', label: 'THIS_QUARTER', value: 'THIS_QUARTER', meta: { hasUserInput: false } },
    { id: 'LAST_QUARTER', label: 'LAST_QUARTER', value: 'LAST_QUARTER', meta: { hasUserInput: false } },
    { id: 'NEXT_QUARTER', label: 'NEXT_QUARTER', value: 'NEXT_QUARTER', meta: { hasUserInput: false } },
    // { id: 'NEXT_N_QUARTERS:n', label: 'NEXT_N_QUARTERS:n', value: 'NEXT_N_QUARTERS:n', meta: { hasUserInput: true } },
    // { id: 'LAST_N_QUARTERS:n', label: 'LAST_N_QUARTERS:n', value: 'LAST_N_QUARTERS:n', meta: { hasUserInput: true } },
    { id: 'THIS_YEAR', label: 'THIS_YEAR', value: 'THIS_YEAR', meta: { hasUserInput: false } },
    { id: 'LAST_YEAR', label: 'LAST_YEAR', value: 'LAST_YEAR', meta: { hasUserInput: false } },
    { id: 'NEXT_YEAR', label: 'NEXT_YEAR', value: 'NEXT_YEAR', meta: { hasUserInput: false } },
    // { id: 'NEXT_N_YEARS:n', label: 'NEXT_N_YEARS:n', value: 'NEXT_N_YEARS:n', meta: { hasUserInput: true } },
    // { id: 'LAST_N_YEARS:n', label: 'LAST_N_YEARS:n', value: 'LAST_N_YEARS:n', meta: { hasUserInput: true } },
    { id: 'THIS_FISCAL_QUARTER', label: 'THIS_FISCAL_QUARTER', value: 'THIS_FISCAL_QUARTER', meta: { hasUserInput: false } },
    { id: 'LAST_FISCAL_QUARTER', label: 'LAST_FISCAL_QUARTER', value: 'LAST_FISCAL_QUARTER', meta: { hasUserInput: false } },
    { id: 'NEXT_FISCAL_QUARTER', label: 'NEXT_FISCAL_QUARTER', value: 'NEXT_FISCAL_QUARTER', meta: { hasUserInput: false } },
    // { id: 'NEXT_N_FISCAL_QUARTERS:n', label: 'NEXT_N_FISCAL_QUARTERS:n', value: 'NEXT_N_FISCAL_QUARTERS:n', meta: { hasUserInput: true } },
    // { id: 'LAST_N_FISCAL_QUARTERS:n', label: 'LAST_N_FISCAL_QUARTERS:n', value: 'LAST_N_FISCAL_QUARTERS:n', meta: { hasUserInput: true } },
    { id: 'THIS_FISCAL_YEAR', label: 'THIS_FISCAL_YEAR', value: 'THIS_FISCAL_YEAR', meta: { hasUserInput: false } },
    { id: 'LAST_FISCAL_YEAR', label: 'LAST_FISCAL_YEAR', value: 'LAST_FISCAL_YEAR', meta: { hasUserInput: false } },
    { id: 'NEXT_FISCAL_YEAR', label: 'NEXT_FISCAL_YEAR', value: 'NEXT_FISCAL_YEAR', meta: { hasUserInput: false } },
    // { id: 'NEXT_N_FISCAL_YEARS:n', label: 'NEXT_N_FISCAL_YEARS:n', value: 'NEXT_N_FISCAL_YEARS:n', meta: { hasUserInput: true } },
    // { id: 'LAST_N_FISCAL_YEARS:n', label: 'LAST_N_FISCAL_YEARS:n', value: 'LAST_N_FISCAL_YEARS:n', meta: { hasUserInput: true } },
  ];
}

export const DATE_LITERALS_SET = new Set(getDateLiteralListItems().map((item) => item.value));

export function getBooleanListItems(): ListItem[] {
  return [
    { id: 'TRUE', label: 'True', value: 'True' },
    { id: 'FALSE', label: 'False', value: 'False' },
  ];
}

export function getPicklistListItems(field: Field): ListItem[] {
  return (field.picklistValues || []).map((item) => ({
    id: item.value,
    label: item.label || item.value,
    value: item.value,
  }));
}

/// START ADD ORG ////
let windowRef: Maybe<Window>;
let addOrgCallbackFn: (org: SalesforceOrgUi) => void;

function handleWindowEvent(event: MessageEvent) {
  if (isString(event.data)) {
    try {
      const org: SalesforceOrgUi = JSON.parse(event.data);
      org.orgIsSandbox = ensureBoolean(org.orgIsSandbox);
      // ensure from our origin // FIXME:
      logger.log({ org });
      if (addOrgCallbackFn) {
        addOrgCallbackFn(org);
      }
      if (windowRef) {
        windowRef.close();
        window.removeEventListener('message', handleWindowEvent);
      }
    } catch (ex) {
      // TODO: tell user there was a problem
    }
  }
}

export function addOrg(options: { serverUrl: string; loginUrl: string; addLoginTrue?: boolean }, callback: (org: SalesforceOrgUi) => void) {
  const { serverUrl, loginUrl, addLoginTrue } = options;
  addOrgCallbackFn = callback;
  window.removeEventListener('message', handleWindowEvent);
  const strWindowFeatures = 'toolbar=no, menubar=no, width=1025, height=700';
  const url = new URL(`${serverUrl}/oauth/sfdc/auth`);
  url.searchParams.set('loginUrl', loginUrl);
  url.searchParams.set('clientUrl', document.location.origin);
  if (addLoginTrue) {
    url.searchParams.set('addLoginParam', 'true');
  }
  windowRef = window.open(url, 'Add Salesforce Org', strWindowFeatures);
  window.addEventListener('message', handleWindowEvent, false);
}
/// END ADD ORG ////

export function hasFeatureFlagAccess(featureFlags: Set<string>, flag: string) {
  if (featureFlags.has('all')) {
    return true;
  }
  return featureFlags.has(flag);
}

const DEFAULT_INTERVAL_5_SEC = 5000;
const DEFAULT_MAX_ATTEMPTS = 500;
// number of attempts before checking less often
const BACK_OFF_INTERVAL = 25;

export function checkIfBulkApiJobIsDone(jobInfo: BulkJobWithBatches, totalBatches: number) {
  if (jobInfo.state === 'Failed' || jobInfo.state === 'Aborted') {
    return true;
  }
  return (
    jobInfo.batches.length > 0 &&
    jobInfo.batches.length === totalBatches &&
    jobInfo.batches.every((batch) => batch.state === 'Completed' || batch.state === 'Failed' || batch.state === 'NotProcessed')
  );
}

/**
 *
 * @param selectedOrg
 * @param id
 * @param options Defaults below
 *  includeDetails = false
 *  interval = 2000
 *  maxAttempts = 100
 */
export async function pollMetadataResultsUntilDone(
  selectedOrg: SalesforceOrgUi,
  id: string,
  options?: { includeDetails?: boolean; interval?: number; maxAttempts?: number; onChecked?: (deployResults: DeployResult) => void }
) {
  let { includeDetails, interval, maxAttempts, onChecked } = options || {};
  includeDetails = includeDetails || false;
  interval = interval || DEFAULT_INTERVAL_5_SEC;
  maxAttempts = maxAttempts || DEFAULT_MAX_ATTEMPTS;
  onChecked = isFunction(onChecked) ? onChecked : NOOP;

  let attempts = 0;
  let done = false;
  let deployResults: DeployResult = {} as DeployResult;
  while (!done && attempts <= maxAttempts) {
    await delay(interval);
    deployResults = await checkMetadataResults(selectedOrg, id, includeDetails);
    logger.log({ deployResults });
    onChecked(deployResults);
    done = deployResults.done;
    attempts++;
    // back off checking if it is taking a long time
    if (attempts % BACK_OFF_INTERVAL === 0) {
      interval += DEFAULT_INTERVAL_5_SEC;
    }
  }
  if (!done) {
    throw new Error('Timed out while checking for metadata results, check Salesforce for results.');
  }
  return deployResults;
}

/**
 *
 * @param selectedOrg
 * @param id
 * @param options
 * @returns
 */
export async function pollRetrieveMetadataResultsUntilDone(
  selectedOrg: SalesforceOrgUi,
  id: string,
  options?: { interval?: number; maxAttempts?: number; onChecked?: (retrieveResults: RetrieveResult) => void; isCancelled?: () => boolean }
) {
  let { interval, maxAttempts, onChecked } = options || {};
  interval = interval || DEFAULT_INTERVAL_5_SEC;
  maxAttempts = maxAttempts || DEFAULT_MAX_ATTEMPTS;
  onChecked = isFunction(onChecked) ? onChecked : NOOP;
  const isCancelled = options?.isCancelled || (() => false);

  let attempts = 0;
  let done = false;
  let retrieveResults: RetrieveResult = {} as RetrieveResult;
  while (!done && attempts <= maxAttempts) {
    await delay(interval);
    if (isCancelled && isCancelled()) {
      throw new Error('Job cancelled');
    }
    retrieveResults = await checkMetadataRetrieveResults(selectedOrg, id);
    logger.log({ retrieveResults });
    onChecked(retrieveResults);
    done = retrieveResults.done;
    attempts++;
    // back off checking if it is taking a long time
    if (attempts % BACK_OFF_INTERVAL === 0) {
      interval += DEFAULT_INTERVAL_5_SEC;
    }
    if (isCancelled && isCancelled()) {
      throw new Error('Job cancelled');
    }
  }
  if (!done) {
    throw new Error('Timed out while checking for metadata results, check Salesforce for results.');
  }
  return retrieveResults;
}

/**
 * Retrieve and deploy to second org once results are ready
 * @param selectedOrg
 * @param targetOrg
 * @param id
 * @param options
 */
export async function pollAndDeployMetadataResultsWhenReady(
  selectedOrg: SalesforceOrgUi,
  targetOrg: SalesforceOrgUi,
  id: string,
  options?: {
    interval?: number;
    maxAttempts?: number;
    deployOptions: DeployOptions;
    changesetName?: string;
    replacementPackageXml?: string;
    onChecked?: (retrieveResults: { type: 'deploy' | 'retrieve'; results: RetrieveResult; zipFile?: string }) => void;
  }
) {
  // eslint-disable-next-line prefer-const
  let { interval, maxAttempts, deployOptions, replacementPackageXml, changesetName, onChecked } = options || {};
  interval = interval || DEFAULT_INTERVAL_5_SEC;
  maxAttempts = maxAttempts || DEFAULT_MAX_ATTEMPTS;
  onChecked = isFunction(onChecked) ? onChecked : NOOP;

  let attempts = 0;
  let done = false;
  let retrieveResults: { type: 'deploy' | 'retrieve'; results: RetrieveResult; zipFile?: string } | undefined = undefined;
  while (!done && attempts <= maxAttempts) {
    await delay(interval);
    retrieveResults = await checkMetadataRetrieveResultsAndDeployToTarget(selectedOrg, targetOrg, {
      id,
      deployOptions,
      replacementPackageXml,
      changesetName,
    });
    logger.log({ retrieveResults });
    onChecked(retrieveResults);
    done = retrieveResults.type === 'deploy';
    attempts++;
    if (attempts % BACK_OFF_INTERVAL === 0) {
      interval += DEFAULT_INTERVAL_5_SEC;
    }
  }
  if (!done || !retrieveResults) {
    throw new Error('Timed out while checking for metadata results, check Salesforce for results.');
  }
  return retrieveResults;
}

/**
 * Read file in browser using FileReader
 * @param file
 * @param readAsArrayBuffer
 */
export function readFile(file: File, type: 'array_buffer'): Promise<ArrayBuffer>;
export function readFile(file: File, type: 'text' | 'data_url'): Promise<string>;
export function readFile(file: File, type: 'text' | 'array_buffer' | 'data_url' = 'text'): Promise<string | ArrayBuffer> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    if (type === 'array_buffer') {
      reader.readAsArrayBuffer(file);
    } else if (type === 'data_url') {
      reader.readAsDataURL(file);
    } else {
      reader.readAsText(file);
    }
    reader.onload = (event: ProgressEvent<FileReader>) => {
      resolve(reader.result || '');
    };
    reader.onabort = (event: ProgressEvent<FileReader>) => {
      logger.log('onabort', { event });
      reject(new Error('Reading the file was aborted'));
    };
    reader.onerror = (event: ProgressEvent<FileReader>) => {
      logger.log('onerror', { event });
      reject(reader.error);
    };
  });
}

/**
 * Parse file
 * Supported Types: CSV / XLSX
 *
 * TODO: support other filetypes (.zip)
 *
 * @param content string | ArrayBuffer
 * @param options - If onParsedMultipleWorkbooks is provided, then this is called to ask the user which worksheet to use
 */
export async function parseFile(
  content: string | ArrayBuffer,
  options?: {
    onParsedMultipleWorkbooks?: (worksheets: string[]) => Promise<string>;
    isBinaryString?: boolean;
    isPasteFromClipboard?: boolean;
    extension?: string;
  }
): Promise<{
  data: any[];
  headers: string[];
  errors: string[];
}> {
  options = options || {};
  if (!options.isBinaryString && isString(content)) {
    // csv - read from papaparse
    let csvResult = parseCsv(content, {
      delimiter: options.isPasteFromClipboard ? undefined : detectDelimiter(options.extension),
      header: true,
      skipEmptyLines: true,
    });
    // Check if it is likely an incorrect delimiter was used and re-parse file with auto-detect delimiter
    if (
      Array.isArray(csvResult.meta.fields) &&
      csvResult.meta.fields.length === 1 &&
      ((csvResult.meta.fields[0].includes(',') && csvResult.meta.delimiter === ';') ||
        (csvResult.meta.fields[0].includes(';') && csvResult.meta.delimiter === ','))
    ) {
      csvResult = parseCsv(content, {
        header: true,
        skipEmptyLines: true,
      });
    }
    return {
      data: csvResult.data,
      headers: Array.from(new Set(csvResult.meta.fields)), // remove duplicates, if any
      errors: csvResult.errors.map((error) => (error.row ? `Row ${error.row}: ${error.message}` : error.message)),
    };
  } else {
    // ArrayBuffer / binary string - xlsx file
    const workbook = options.isBinaryString
      ? XLSX.read(content, { cellText: false, cellDates: true, type: 'binary' })
      : XLSX.read(content, { cellText: false, cellDates: true, type: 'array' });
    return parseWorkbook(workbook, options);
  }
}

export async function parseWorkbook(
  workbook: XLSX.WorkBook,
  options?: {
    onParsedMultipleWorkbooks?: (worksheets: string[]) => Promise<string>;
  }
): Promise<{
  data: any[];
  headers: string[];
  errors: string[];
}> {
  let selectedSheet = workbook.Sheets[workbook.SheetNames[0]];
  if (workbook.SheetNames.length > 1 && typeof options?.onParsedMultipleWorkbooks === 'function') {
    const sheetName = await options.onParsedMultipleWorkbooks(workbook.SheetNames);
    if (workbook.Sheets[sheetName]) {
      selectedSheet = workbook.Sheets[sheetName];
    }
  }

  const data = XLSX.utils.sheet_to_json(selectedSheet, {
    dateNF: 'yyyy"-"mm"-"dd"T"hh:mm:ss',
    defval: '',
    blankrows: false,
    rawNumbers: true,
  });
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  const headers = data.length > 0 ? Object.keys(data[0]!) : [];
  return {
    data,
    headers: headers.filter((field) => !field.startsWith('__empty')),
    errors: [],
  };
}

export function generateCsv(data: any[], options: UnparseConfig = {}): string {
  options = options || {};
  options.newline = options.newline || '\n';
  if (!options.delimiter) {
    options.delimiter = detectDelimiter();
  }
  return unparseCsv(data, options);
}

function detectDelimiter(extension?: string): string {
  if (extension === INPUT_ACCEPT_FILETYPES.TSV) {
    return '\t';
  }
  let delimiter = ',';
  try {
    // determine if delimiter is the same as the decimal symbol in current locale
    // if so, change delimiter to ;
    if (delimiter === (1.1).toLocaleString(navigator.language).substring(1, 2)) {
      delimiter = ';';
    }
  } catch (ex) {
    logger.warn('[ERROR] Error detecting CSV delimiter', ex);
  }
  return delimiter;
}

/**
 * Convert a date or ISO date string to a string in the users locale
 * If options (Intl.DateTimeFormatOptions) is provided, that will be used
 * otherwise `toLocaleString()` is used as a fallback
 *
 * @param dateOrIsoDateString
 * @param options
 * @returns
 */
export function convertDateToLocale(dateOrIsoDateString: string | Date, options?: Intl.DateTimeFormatOptions): string | undefined {
  if (!dateOrIsoDateString) {
    return undefined;
  }
  const date = dateOrIsoDateString instanceof Date ? dateOrIsoDateString : parseISO(dateOrIsoDateString);
  if (!options) {
    return date.toLocaleString();
  } else {
    return new Intl.DateTimeFormat(navigator.language, options).format(date);
  }
}

export function detectDateFormatForLocale() {
  try {
    const locale = navigator.language || 'en-US';
    const testDate = new Date(2021, 11, 24); // December 24, 2021
    const formattedDate = new Intl.DateTimeFormat(locale).format(testDate);

    if (formattedDate.startsWith('12')) {
      return DATE_FORMATS.MM_DD_YYYY;
    } else if (formattedDate.startsWith('24')) {
      return DATE_FORMATS.DD_MM_YYYY;
    } else if (formattedDate.startsWith('2021')) {
      return DATE_FORMATS.YYYY_MM_DD;
    }
  } catch (ex) {
    logger.warn(`[ERROR] Exception detecting date format`, ex.message);
  }

  logger.warn(`[ERROR] Falling back to ${DATE_FORMATS.MM_DD_YYYY}`);
  return DATE_FORMATS.MM_DD_YYYY;
}

export function convertArrayOfObjectToArrayOfArray(data: any[], headers?: string[]): any[][] {
  if (!data || !data.length) {
    return [];
  }
  headers = headers || Object.keys(data[0]) || [];
  return [headers].concat(data.map((row) => headers?.map((header) => row[header]) || []));
}

export function getValueForExcel(value: any) {
  if (isNil(value)) {
    value = '';
  } else if (isString(value)) {
    if (value.includes('\n') || value.includes('\t') || value.includes('"')) {
      value = `"${value.replace(REGEX.QUOTE, '""')}"`;
    } else if (value.startsWith('+')) {
      value = `'${value}`;
    }
  } else if (typeof value === 'object') {
    value = JSON.stringify(value);
  }
  return value;
}

/**
 * Copy an object into a string that is spreadsheet compatible for pasting
 *
 * @param data
 * @param fields
 */
export function transformTabularDataToExcelStr<T = Record<string, unknown>>(
  data: Maybe<T>[],
  fields?: Maybe<string[]>,
  includeHeader = true
): string {
  if (!Array.isArray(data) || data.length === 0) {
    return '';
  }
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  fields = fields || Object.keys(data[0]!) || [];

  // turn each row into \t delimited string, then combine each row into a string delimited by \n
  let output: string = data
    .map((row) =>
      fields
        ?.map((field) => {
          return getValueForExcel(row?.[field]);
        })
        .join('\t')
    )
    .join('\n');

  if (includeHeader) {
    output = `${fields.map(getValueForExcel).join('\t')}\n${output}`;
  }

  return output;
}

/**
 * Same as transformTabularDataToExcelStr but returns as HTML table
 * This can be pasted into spreadsheet programs like Excel with better formatting
 *
 * @param data
 * @param fields
 * @param includeHeader
 * @returns
 */
export function transformTabularDataToHtml<T = unknown>(data: T[], fields?: Maybe<string[]>, includeHeader = true): string {
  if (!Array.isArray(data) || data.length === 0) {
    return '';
  }
  if (!fields) {
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    fields = Object.keys(data[0]!);
  }

  // turn each row into \t delimited string, then combine each row into a string delimited by \n
  let output: string = data.map((row) => `<tr>${fields?.map((field) => `<td>${escapeHtml(row[field])}</td>`).join('')}</tr>`).join('');

  if (includeHeader) {
    output = `<tr>${fields.map((field) => `<th>${escapeHtml(field)}</th>`).join('')}</tr>${output}`;
  }

  return `<table>${output}</table>`;
}

export function isErrorResponse(value: any): value is ErrorResult {
  return !value.success;
}

/**
 * https://stackoverflow.com/questions/6234773/can-i-escape-html-special-chars-in-javascript
 */
export function escapeHtml(value = '') {
  try {
    if (isNil(value)) {
      value = '';
    }
    if (typeof value === 'object') {
      value = JSON.stringify(value);
    }
    return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
  } catch (ex) {
    return value;
  }
}

// https://github.com/salesforce/design-system-react/blob/master/utilities/menu-item-select-scroll.js
/* Copyright (c) 2015-present, salesforce.com, inc. All rights reserved */
export function menuItemSelectScroll({
  container,
  focusedIndex,
  itemTag = 'li',
  scrollPadding = 4,
}: {
  container: HTMLElement;
  focusedIndex: number;
  itemTag?: string;
  scrollPadding?: number;
}) {
  try {
    const domItem: HTMLLIElement | null = container.querySelector(`${itemTag}:nth-child(${focusedIndex + 1})`);

    if (domItem) {
      if (domItem.offsetHeight - container.scrollTop + domItem.offsetTop >= container.offsetHeight) {
        // eslint-disable-next-line no-param-reassign
        container.scrollTop = domItem.offsetHeight + domItem.offsetTop - container.offsetHeight + scrollPadding;
      } else if (domItem.offsetTop <= container.scrollTop) {
        // eslint-disable-next-line no-param-reassign
        container.scrollTop = domItem.offsetTop - scrollPadding;
      }
    }
  } catch (ex) {
    // ignore errors
  }
}

export function isPermissionSetWithProfile(value: PermissionSetRecord): value is PermissionSetWithProfileRecord {
  return value.IsOwnedByProfile;
}

/**
 * Returns a reducer function for useReducers that can be used for fetch actions
 * Nested function allows type safety, otherwise generic would not be able to be specified un useReducer
 */
export function useReducerFetchFn<T>() {
  function reducer(state: UseReducerFetchState<T>, action: UseReducerFetchAction<T>): UseReducerFetchState<T> {
    switch (action.type) {
      case 'REQUEST':
        // data is only overwritten if provided
        return isUndefined(action.payload)
          ? { ...state, hasLoaded: true, loading: true, hasError: false, errorMessage: null }
          : { ...state, hasLoaded: true, loading: true, hasError: false, errorMessage: null, data: action.payload };
      case 'SUCCESS':
        return { ...state, loading: false, data: action.payload };
      case 'ERROR':
        return {
          ...state,
          loading: false,
          hasError: true,
          errorMessage: action.payload?.errorMessage,
          data: action.payload?.data ?? state.data,
        };
      default:
        throw new Error('Invalid action');
    }
  }
  return reducer;
}

const is15or18Digits = /[a-z0-9]{15}|[a-z0-9]{18}/i;
const is18Digits = /[a-z0-9]{18}/i;

/**
 * Validate if a string is a valid salesforce id
 * https://gist.github.com/step307/3d265b7c7cb4eccdf0cf55a68c9cfefa
 */
export function isValidSalesforceRecordId(recordId?: string, allow15Char = true): boolean {
  const regex = allow15Char ? is15or18Digits : is18Digits;
  if (!recordId || !regex.test(recordId)) {
    return false;
  }
  if (recordId.length === 15 && allow15Char) {
    // no way to completely validate this
    return true;
  }
  const upperCaseToBit = (char: string) => (char.match(/[A-Z]/) ? '1' : '0');
  const binaryToSymbol = (digit: number) => (digit <= 25 ? String.fromCharCode(digit + 65) : String.fromCharCode(digit - 26 + 48));

  const parts = [
    recordId.slice(0, 5).split('').reverse().map(upperCaseToBit).join(''),
    recordId.slice(5, 10).split('').reverse().map(upperCaseToBit).join(''),
    recordId.slice(10, 15).split('').reverse().map(upperCaseToBit).join(''),
  ];

  const check = parts.map((str) => binaryToSymbol(parseInt(str, 2))).join('');

  return check === recordId.slice(-3);
}

/**
 * Convert Salesforce 15 digit id to 18 digit id
 * If value is not in correct format, return original value
 * https://github.com/mslabina/sf15to18/blob/master/sf15to18.js
 */
export function convertId15To18(id: string): string {
  if (!id || !isString(id) || id.length !== 15) {
    return id;
  }

  // Generate three last digits of the id
  for (let i = 0; i < 3; i++) {
    let f = 0;

    // For every 5-digit block of the given id
    for (let j = 0; j < 5; j++) {
      // Assign the j-th chracter of the i-th 5-digit block to c
      const char = id.charAt(i * 5 + j);

      // Check if c is an uppercase letter
      if (char >= 'A' && char <= 'Z') {
        // Set a 1 at the character's position in the reversed segment
        f += 1 << j;
      }
    }

    // Add the calculated character for the current block to the id
    id += 'ABCDEFGHIJKLMNOPQRSTUVWXYZ012345'.charAt(f);
  }

  return id;
}

/**
 * Parse changesets from changeset page in Salesforce, use anonymous apex to parse the page
 *
 * This is pretty sketchy, but Salesforce has not updated their changeset page in forever, so should generally be mostly safe
 *
 * Inspired by {@link https://salesforce.stackexchange.com/questions/253434/how-can-i-get-a-list-of-the-current-changeset-names}
 *
 * @param org
 * @returns
 */
export async function getChangesetsFromDomParse(org: SalesforceOrgUi) {
  const apex = `
    System.debug(new PageReference('/changemgmt/listOutboundChangeSet.apexp').getContent().toString());
  `;
  const { result, debugLog } = await anonymousApex(org, apex, 'DEBUG');

  const htmlDocument = debugLog.substring(debugLog.indexOf('<html'), debugLog.indexOf('</html>') + '</html>'.length);

  const dom = new DOMParser().parseFromString(htmlDocument, 'text/html');
  const changesetTable = dom.querySelectorAll('.pbBody table table tbody > tr');

  const changesets: ChangeSet[] = Array.from(changesetTable)
    .map((row) => ({
      link: row.children[1].children[0].getAttribute('href') || '',
      name: row.children[1].textContent?.replace('\n', '').trim() || '',
      description: row.children[2].textContent?.replace('\n', '').trim() || null,
      status: row.children[3].textContent?.replace('\n', '').trim() as 'Open' | 'Closed',
      modifiedBy: row.children[4].textContent?.replace('\n', '').trim() || '',
      modifiedDate: row.children[5].textContent?.replace('\n', '').trim() || '',
    }))
    .filter((item) => item.status === 'Open');

  return changesets;
}

/**
 * Gets map of list items by id
 * recursively traverses child items
 */
export function getFlattenedListItemsById(items: ListItem[], output = {}): Record<string, ListItem> {
  items.forEach((item) => {
    output[item.id] = item;
    if (Array.isArray(item.childItems)) {
      getFlattenedListItemsById(item.childItems, output);
    }
  });
  return output;
}

/**
 * Given an object of all items by id, use the parentId field to create a tree structure
 * the parentId is blank for all the top level items and is "." delimited for all parentId's
 */
export function unFlattenedListItemsById(items: Record<string, ListItem>): ListItem[] {
  const output: ListItem[] = [];
  const childItemsByParentId: Record<string, ListItem[]> = {};
  // clone items to ensure we don't mutate the original
  items = JSON.parse(JSON.stringify(items));
  Object.keys(items).forEach((key) => {
    const item = items[key];
    if (item.parentId === '') {
      output.push(item);
    } else if (item.parentId) {
      childItemsByParentId[item.parentId] = childItemsByParentId[item.parentId] || [];
      childItemsByParentId[item.parentId].push(item);
    }
  });
  Object.keys(childItemsByParentId).forEach((key) => {
    if (items[key]) {
      items[key].childItems = childItemsByParentId[key];
    }
  });
  return output;
}

export function getListItemsFromFieldWithRelatedItems(fields: Field[], parentId = ''): ListItem[] {
  const parentPath = parentId ? `${parentId}.` : '';
  const allowChildren = parentPath.split('.').length <= 5;
  const relatedFields: ListItem[] = fields
    .filter((field) => allowChildren && Array.isArray(field.referenceTo) && field.referenceTo.length > 0 && field.relationshipName)
    .map((field) => ({
      id: `${parentPath}${field.relationshipName}`,
      value: `${parentPath}${field.relationshipName}`,
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      label: field.relationshipName!,
      secondaryLabel: field.referenceTo?.[0],
      secondaryLabelOnNewLine: true,
      isDrillInItem: true,
      parentId: parentId,
      meta: field,
    }));

  const coreFields: ListItem[] = fields.flatMap((field) => ({
    id: `${parentPath}${field.name}`,
    value: `${parentPath}${field.name}`,
    label: field.label,
    secondaryLabel: field.name,
    secondaryLabelOnNewLine: true,
    parentId: parentId,
    meta: field,
  }));

  return [...relatedFields, ...coreFields];
}

/**
 * If there is a change in UI that would make an element take a render ror more
 * to be added to the dom, this will try a {maxAttempts} times to focus the element
 *
 * @param element
 * @param backOff
 * @param attempt
 * @param maxAttempts
 * @returns
 */
export function focusElementFromRefWhenAvailable<T extends HTMLElement>(
  element: Maybe<React.RefObject<T>>,
  backOff = 0,
  attempt = 0,
  maxAttempts = 3
) {
  if (!element) {
    return;
  }
  if (element.current) {
    element.current.focus();
  } else {
    if (attempt < maxAttempts) {
      setTimeout(() => {
        focusElementFromRefWhenAvailable(element, backOff + 50, attempt + 1, maxAttempts);
      }, backOff);
    }
  }
}

export function isRelationshipField(field: Field): boolean {
  // Some fields are listed as a string, but are actually lookup fields
  return (field.type === 'reference' || field.type === 'string') && !!field.relationshipName && !!field.referenceTo?.length;
}

/**
 * Filter objects for load
 * @param sobject
 * @returns
 */
export function filterLoadSobjects(sobject: DescribeGlobalSObjectResult | DescribeSObjectResult) {
  return (
    (sobject.createable || sobject.updateable || sobject.name.endsWith('__mdt')) &&
    !sobject.name.endsWith('__History') &&
    !sobject.name.endsWith('__Tag') &&
    !sobject.name.endsWith('__Feed')
  );
}
