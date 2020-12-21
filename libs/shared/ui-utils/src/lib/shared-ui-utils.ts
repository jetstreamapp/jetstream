import { logger } from '@jetstream/shared/client-logger';
import { HTTP } from '@jetstream/shared/constants';
import { checkMetadataResults } from '@jetstream/shared/data';
import { delay, ensureBoolean, orderObjectsBy, REGEX } from '@jetstream/shared/utils';
import {
  AndOr,
  ErrorResult,
  ExpressionConditionRowSelectedItems,
  ExpressionConditionType,
  ExpressionGroupType,
  ExpressionType,
  ListItem,
  MapOf,
  MimeType,
  PositionAll,
  QueryFieldWithPolymorphic,
  QueryFilterOperator,
  SalesforceOrgUi,
} from '@jetstream/types';
import parseISO from 'date-fns/parseISO';
import { saveAs } from 'file-saver';
import { DeployResult, Field } from 'jsforce';
import { get as safeGet } from 'lodash';
import isNil from 'lodash/isNil';
import isString from 'lodash/isString';
import numeral from 'numeral';
import { parse as parseCsv, unparse, unparse as unparseCsv, UnparseConfig } from 'papaparse';
import {
  LiteralType,
  Operator,
  ValueCondition,
  ValueWithDateLiteralCondition,
  WhereClause,
  WhereClauseWithRightCondition,
} from 'soql-parser-js';
import { Placement as tippyPlacement } from 'tippy.js';
import * as XLSX from 'xlsx';

export function formatNumber(number: number) {
  return numeral(number).format('0,0');
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
  const cookieStrRegex: RegExpExecArray = RegExp(`${cookieName}[^;]+`).exec(document.cookie);
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

export function sortQueryFields(fields: Field[]): Field[] {
  // partition name and id field out, then append to front
  const reducedFields = orderObjectsBy(fields, 'label').reduce(
    (out, field) => {
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

  const firstItems = [];
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
    (out, field) => {
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

  const firstItems = [];
  if (reducedFields.id) {
    firstItems.push(reducedFields.id);
  }
  if (reducedFields.name) {
    firstItems.push(reducedFields.name);
  }

  return firstItems.concat(reducedFields.remaining);
}

export function sortQueryFieldsPolymorphic(fields: QueryFieldWithPolymorphic[]): QueryFieldWithPolymorphic[] {
  // partition name and id field out, then append to front
  const reducedFields = fields.reduce(
    (out, item) => {
      const { field } = item;
      if (field === 'Id') {
        out.id = item;
      } else if (field === 'Name') {
        out.name = item;
      } else {
        out.remaining.push(item);
      }
      return out;
    },
    {
      id: null,
      name: null,
      remaining: [],
    }
  );

  const firstItems = [];
  if (reducedFields.id) {
    firstItems.push(reducedFields.id);
  }
  if (reducedFields.name) {
    firstItems.push(reducedFields.name);
  }

  return firstItems.concat(reducedFields.remaining);
}

export function polyfillFieldDefinition(field: Field): string {
  const autoNumber: boolean = field['autoNumber'];
  const { type, calculated, calculatedFormula, externalId, nameField, extraTypeInfo, length, precision, referenceTo, scale } = field;
  let prefix = '';
  let suffix = '';
  let value = '';

  if (calculated && calculatedFormula) {
    prefix = 'Formula (';
    suffix = ')';
  } else if (calculated) {
    prefix = 'Roll-Up Summary';
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
  } else if (type === 'reference') {
    value = `Lookup(${(referenceTo || []).join(',')})`;
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
export function prepareExcelFile(data: MapOf<any[]>, header?: MapOf<string[]>, defaultSheetName?: void): ArrayBuffer;
export function prepareExcelFile(data: any, header: any, defaultSheetName: any = 'Records'): ArrayBuffer {
  const workbook = XLSX.utils.book_new();

  if (Array.isArray(data)) {
    header = header || Object.keys(data[0]);
    const worksheet = XLSX.utils.aoa_to_sheet(convertArrayOfObjectToArrayOfArray(data, header as string[]));
    XLSX.utils.book_append_sheet(workbook, worksheet, defaultSheetName);
  } else {
    Object.keys(data).forEach((sheetName) => {
      if (data[sheetName].length > 0) {
        const currentHeader = (header && header[sheetName]) || Object.keys(data[sheetName][0]);
        XLSX.utils.book_append_sheet(
          workbook,
          XLSX.utils.aoa_to_sheet(convertArrayOfObjectToArrayOfArray(data[sheetName], currentHeader)),
          sheetName
        );
      }
    });
  }

  // https://github.com/sheetjs/sheetjs#writing-options
  const workbookArrayBuffer: ArrayBuffer = XLSX.write(workbook, {
    bookType: 'xlsx',
    bookSST: false,
    type: 'array', // ArrayBuffer
  });
  return workbookArrayBuffer;
}

export function prepareCsvFile(data: MapOf<string>[], header: string[]): string {
  return unparse(
    {
      data,
      fields: header,
    },
    { header: true, quotes: true, delimiter: detectDelimiter() }
  );
}

export function getFilename(org: SalesforceOrgUi, parts: string[]) {
  return `${parts.join('-')}-${org.username}-${new Date().getTime()}`.replace(REGEX.SAFE_FILENAME, '_');
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function saveFile(content: any, filename: string, type: MimeType) {
  // saveAs(new Blob([wbout],{type:"application/octet-stream"}), "test.xlsx");
  const blob = new Blob([content], { type });
  saveAs(blob, filename);
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

function queryFilterHasValueValue(row: ExpressionConditionType) {
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

export function convertFiltersToWhereClause(filters: ExpressionType): WhereClause {
  if (!filters) {
    return;
  }
  logger.log({ filters });

  // Process all where clauses
  const whereClauses = filters.rows.reduce((whereClauses: WhereClause[], row, i) => {
    if (isExpressionConditionType(row)) {
      if (queryFilterHasValueValue(row)) {
        buildExpressionConditionWhereClause(whereClauses, row, filters.action);
      }
    } else {
      const group = { ...row };
      group.rows = group.rows.filter(queryFilterHasValueValue);
      if (group.rows.length > 0) {
        buildExpressionGroupConditionWhereClause(whereClauses, group, filters.action);
      }
    }
    return whereClauses;
  }, []);

  if (!whereClauses.length) {
    return;
  }

  // combine all where clauses
  const rootClause = whereClauses[0];
  whereClauses.reduce((whereClause: WhereClauseWithRightCondition, currWhereClause, i) => {
    if (whereClause) {
      whereClause.right = currWhereClause;
      // use current operator as the prior operator (e.x. AND on this item applies to the prior item and this item)
      // whereClauses[i - 1].operator = currWhereClause.operator;
    }
    // if (i === whereClauses.length && currWhereClause.operator) {
    //   currWhereClause.operator = undefined;
    // }
    return currWhereClause;
  });

  return rootClause;
}

export function getOperatorFromWhereClause(operator: Operator, value: string, hasNegation = false): QueryFilterOperator {
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
      if (value.startsWith('%') && value.endsWith('%')) {
        return hasNegation ? 'contains' : 'doesNotContain';
      } else if (value.startsWith('%')) {
        return hasNegation ? 'endsWith' : 'doesNotEndWith';
      } else {
        return hasNegation ? 'startsWith' : 'doesNotStartWith';
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
function buildExpressionConditionWhereClause(whereClauses: WhereClause[], row: ExpressionConditionType, action: AndOr): WhereClause[] {
  // REGULAR WHERE CLAUSE
  if (isNegationOperator(row.selected.operator)) {
    whereClauses.push({
      left: { openParen: 1 },
      operator: 'NOT',
    });
    whereClauses.push({
      left: {
        operator: convertQueryFilterOperator(row.selected.operator),
        logicalPrefix: isNegationOperator(row.selected.operator) ? 'NOT' : undefined,
        field: row.selected.resource,
        value: getValue(row.selected.operator, row.selected.value),
        literalType: getLiteralType(row.selected),
        closeParen: 1,
      } as ValueCondition | ValueWithDateLiteralCondition,
      operator: action,
    });
  } else {
    // REGULAR WHERE CLAUSE
    whereClauses.push({
      left: {
        operator: convertQueryFilterOperator(row.selected.operator),
        logicalPrefix: isNegationOperator(row.selected.operator) ? 'NOT' : undefined,
        field: row.selected.resource,
        value: getValue(row.selected.operator, row.selected.value),
        literalType: getLiteralType(row.selected),
      } as ValueCondition | ValueWithDateLiteralCondition,
      operator: action,
    });
  }
  return whereClauses;
}

function buildExpressionGroupConditionWhereClause(
  whereClauses: WhereClause[],
  group: ExpressionGroupType,
  parentAction: AndOr
): WhereClause[] {
  const tempWhereClauses: WhereClauseWithRightCondition[] = [];
  group.rows.forEach((row, i) => {
    const whereClause: Partial<WhereClauseWithRightCondition> = {
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
      const negationCondition: Partial<WhereClauseWithRightCondition> = {
        left: { openParen: 1 },
        operator: 'NOT',
      };
      (whereClause.left as ValueCondition | ValueWithDateLiteralCondition).closeParen = 1;
      tempWhereClauses.push(negationCondition as WhereClauseWithRightCondition);
      whereClauses.push(negationCondition as WhereClause);
    }
    tempWhereClauses.push(whereClause as WhereClauseWithRightCondition);
    whereClauses.push(whereClause as WhereClause);
  });
  if (tempWhereClauses[0].left.openParen) {
    tempWhereClauses[0].left.openParen += 1;
  } else {
    tempWhereClauses[0].left.openParen = 1;
  }
  if ((tempWhereClauses[tempWhereClauses.length - 1].left as ValueCondition | ValueWithDateLiteralCondition).closeParen) {
    (tempWhereClauses[tempWhereClauses.length - 1].left as ValueCondition | ValueWithDateLiteralCondition).closeParen += 1;
  } else {
    (tempWhereClauses[tempWhereClauses.length - 1].left as ValueCondition | ValueWithDateLiteralCondition).closeParen = 1;
  }

  return whereClauses;
}

export function isNegationOperator(operator: QueryFilterOperator): boolean {
  switch (operator) {
    case 'doesNotContain':
    case 'doesNotStartWith':
    case 'doesNotEndWith':
      return true;
    default:
      return false;
  }
}

function getValue(operator: QueryFilterOperator, value: string | string[]): string | string[] {
  value = value || '';
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
      return Array.isArray(value) ? value : value.split('\n');
    default:
      return value;
  }
}

function getLiteralType(selected: ExpressionConditionRowSelectedItems): LiteralType {
  const field: Field = safeGet(selected, 'resourceMeta.metadata');

  if (selected.operator === 'isNull' || selected.operator === 'isNotNull') {
    return 'NULL';
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

function convertQueryFilterOperator(operator: QueryFilterOperator): Operator {
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
  const params = {
    ...additionalParams,
    [HTTP.HEADERS.X_SFDC_ID]: org.uniqueId || '',
  };
  return Object.keys(params)
    .map((key) => `${key}=${encodeURIComponent(params[key])}`)
    .join('&');
}

export function getDateLiteralListItems(): ListItem[] {
  return [
    { id: 'YESTERDAY', label: 'YESTERDAY', value: 'YESTERDAY' },
    { id: 'TODAY', label: 'TODAY', value: 'TODAY' },
    { id: 'TOMORROW', label: 'TOMORROW', value: 'TOMORROW' },
    { id: 'LAST_WEEK', label: 'LAST_WEEK', value: 'LAST_WEEK' },
    { id: 'THIS_WEEK', label: 'THIS_WEEK', value: 'THIS_WEEK' },
    { id: 'NEXT_WEEK', label: 'NEXT_WEEK', value: 'NEXT_WEEK' },
    { id: 'LAST_MONTH', label: 'LAST_MONTH', value: 'LAST_MONTH' },
    { id: 'THIS_MONTH', label: 'THIS_MONTH', value: 'THIS_MONTH' },
    { id: 'NEXT_MONTH', label: 'NEXT_MONTH', value: 'NEXT_MONTH' },
    { id: 'LAST_90_DAYS', label: 'LAST_90_DAYS', value: 'LAST_90_DAYS' },
    { id: 'NEXT_90_DAYS', label: 'NEXT_90_DAYS', value: 'NEXT_90_DAYS' },
    { id: 'THIS_YEAR', label: 'THIS_YEAR', value: 'THIS_YEAR' },
    { id: 'LAST_YEAR', label: 'LAST_YEAR', value: 'LAST_YEAR' },
    { id: 'NEXT_YEAR', label: 'NEXT_YEAR', value: 'NEXT_YEAR' },
  ];
}

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
let windowRef: Window | undefined;
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
      }
    } catch (ex) {
      // TODO: tell user there was a problem
    }
  }
}

export function addOrg(
  options: { serverUrl: string; loginUrl: string; replaceOrgUniqueId?: string },
  callback: (org: SalesforceOrgUi) => void
) {
  const { serverUrl, loginUrl, replaceOrgUniqueId } = options;
  addOrgCallbackFn = callback;
  window.removeEventListener('message', handleWindowEvent);
  const strWindowFeatures = 'toolbar=no, menubar=no, width=1025, height=700';
  let url = `${serverUrl}/oauth/sfdc/auth?`;
  url += `loginUrl=${encodeURIComponent(loginUrl)}`;
  url += `&clientUrl=${encodeURIComponent(document.location.origin)}`;
  if (replaceOrgUniqueId) {
    url += `&replaceOrgUniqueId=${encodeURIComponent(replaceOrgUniqueId)}`;
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
  options?: { includeDetails?: boolean; interval?: number; maxAttempts?: number }
) {
  let { includeDetails, interval, maxAttempts } = options || {};
  includeDetails = includeDetails || false;
  interval = interval || 2000;
  maxAttempts = maxAttempts || 100;

  let attempts = 0;
  let done = false;
  let deployResults: DeployResult;
  while (!done && attempts <= maxAttempts) {
    await delay(interval);
    deployResults = await checkMetadataResults(selectedOrg, id, includeDetails);
    logger.log({ deployResults });
    done = deployResults.done;
    attempts++;
  }
  if (!done) {
    throw new Error('Timed out while checking for metadata results');
  }
  return deployResults;
}

/**
 * Read file in browser using FileReader
 * @param file
 * @param readAsArrayBuffer
 */
export function readFile(file: File, readAsArrayBuffer = false): Promise<string | ArrayBuffer> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    if (readAsArrayBuffer) {
      reader.readAsArrayBuffer(file);
    } else {
      reader.readAsText(file);
    }
    reader.onload = (event: ProgressEvent<FileReader>) => {
      resolve(reader.result);
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
  }
): Promise<{
  data: any[];
  headers: string[];
  errors: string[];
}> {
  if (isString(content)) {
    // csv - read from papaparse
    const csvResult = parseCsv(content, {
      delimiter: detectDelimiter(),
      header: true,
      skipEmptyLines: true,
    });
    return {
      data: csvResult.data,
      headers: Array.from(new Set(csvResult.meta.fields)), // remove duplicates, if any
      errors: csvResult.errors.map((error) => `Row ${error.row}: ${error.message}`),
    };
  } else {
    // ArrayBuffer - xlsx file
    const workbook = XLSX.read(content, { cellText: false, cellDates: true, type: 'array' });
    let selectedSheet = workbook.Sheets[workbook.SheetNames[0]];
    if (workbook.SheetNames.length > 1 && typeof options.onParsedMultipleWorkbooks === 'function') {
      const sheetName = await options.onParsedMultipleWorkbooks(workbook.SheetNames);
      if (workbook.Sheets[sheetName]) {
        selectedSheet = workbook.Sheets[sheetName];
      }
    }
    // TODO: ask user what worksheet to use!
    const data = XLSX.utils.sheet_to_json(selectedSheet, {
      dateNF: 'yyyy"-"mm"-"dd"T"hh:mm:ss',
      defval: '',
      blankrows: false,
      rawNumbers: true,
    });
    const headers = data.length > 0 ? Object.keys(data[0]) : [];
    return {
      data,
      headers: headers.filter((field) => !field.startsWith('__empty')),
      errors: [], // TODO:
    };
  }
}

export function generateCsv(data: object[], options: UnparseConfig = {}): string {
  options = options || {};
  options.newline = options.newline || '\n';
  if (!options.delimiter) {
    options.delimiter = detectDelimiter();
  }
  return unparseCsv(data, options);
}

function detectDelimiter(): string {
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

export function convertDateToLocale(isoDateStr: string) {
  return parseISO(isoDateStr).toLocaleString();
}

export function convertArrayOfObjectToArrayOfArray(data: any[], headers?: string[]): any[][] {
  if (!data || !data.length) {
    return [];
  }
  headers = headers || Object.keys(data[0]);
  return [headers].concat(data.map((row) => headers.map((header) => row[header])));
}

/**
 * Copy an object into a string that is spreadsheet compatible for pasting
 *
 * @param data
 * @param fields
 */
export function transformTabularDataToExcelStr<T = unknown>(data: T[], fields?: string[], includeHeader = true): string {
  if (!Array.isArray(data) || data.length === 0) {
    return '';
  }
  if (!fields) {
    fields = Object.keys(data[0]);
  }
  const replaceQuoteRegex = /"/g;

  function getValue(value: any) {
    if (isNil(value)) {
      value = '';
    } else if (isString(value)) {
      if (value.includes('\n') || value.includes('\t') || value.includes('"')) {
        value = `"${value.replace(replaceQuoteRegex, '""')}"`;
      } else if (value.startsWith('+')) {
        value = `'${value}`;
      }
    } else if (typeof value === 'object') {
      value = JSON.stringify(value);
    }
    return value;
  }

  // turn each row into \t delimited string, then combine each row into a string delimited by \n
  let output: string = data
    .map((row) =>
      fields
        .map((field) => {
          return getValue(row[field]);
        })
        .join('\t')
    )
    .join('\n');

  if (includeHeader) {
    output = `${fields.map(getValue).join('\t')}\n${output}`;
  }

  return output;
}

export function isErrorResponse(value: any): value is ErrorResult {
  return !value.success;
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
    const domItem: HTMLLIElement = container.querySelector(`${itemTag}:nth-child(${focusedIndex + 1})`);

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
