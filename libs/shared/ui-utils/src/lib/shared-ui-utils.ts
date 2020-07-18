import { Field } from 'jsforce';
import { orderObjectsBy } from '@jetstream/shared/utils';
import {
  MimeType,
  PositionAll,
  QueryFilterOperator,
  ExpressionType,
  SalesforceOrgUi,
  ExpressionRowValueType,
  ExpressionConditionRowSelectedItems,
  ListItem,
} from '@jetstream/types';
import { saveAs } from 'file-saver';
import { Placement as tippyPlacement } from 'tippy.js';
import { WhereClause, Operator, LiteralType } from 'soql-parser-js';
import { HTTP } from '@jetstream/shared/constants';
import { logger } from '@jetstream/shared/client-logger';
import { get as safeGet } from 'lodash';

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

export function polyfillFieldDefinition(field: Field) {
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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function saveFile(content: any, filename: string, type: MimeType) {
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

export function convertFiltersToWhereClause(filters: ExpressionType): WhereClause {
  if (!filters) {
    return;
  }
  logger.log({ filters });
  // filter out all invalid/incomplete filters
  const rows = filters.rows.filter(
    (row) =>
      row.selected.operator &&
      row.selected.resource &&
      (row.selected.value || row.selected.operator === 'isNull' || row.selected.operator === 'isNotNull')
  );
  const groups = filters.groups
    .map((group) => {
      return {
        ...group,
        rows: group.rows.filter((row) => row.selected.operator && row.selected.resource && row.selected.value),
      };
    })
    .filter((group) => group.rows.length > 0);

  // return if no items to process
  if (rows.length === 0 && rows.length === 0) {
    return undefined;
  }

  // init all where clauses
  const whereClauses = rows.map((row, i) => {
    const whereClause: WhereClause = {
      left: {
        operator: convertQueryFilterOperator(row.selected.operator),
        logicalPrefix: hasLogicalPrefix(row.selected.operator) ? 'NOT' : undefined,
        field: row.selected.resource,
        value: getValue(row.selected.operator, row.selected.value),
        literalType: getLiteralType(row.selected),
      },
      // operator: i !== 0 ? filters.action : undefined,
      operator: filters.action,
    };
    return whereClause;
  });

  // init all groups where clauses
  groups.forEach((group, i) => {
    const tempWhereClauses: WhereClause[] = [];
    group.rows.forEach((row, i) => {
      const whereClause: WhereClause = {
        left: {
          operator: convertQueryFilterOperator(row.selected.operator),
          logicalPrefix: hasLogicalPrefix(row.selected.operator) ? 'NOT' : undefined,
          field: row.selected.resource,
          value: getValue(row.selected.operator, row.selected.value),
          literalType: getLiteralType(row.selected),
        },
        // operator: i !== 0 ? group.action : undefined,
        operator: group.action,
      };
      tempWhereClauses.push(whereClause);
      whereClauses.push(whereClause);
    });
    tempWhereClauses[0].left.openParen = 1;
    tempWhereClauses[tempWhereClauses.length - 1].left.closeParen = 1;
  });

  // combine all where clauses
  const rootClause = whereClauses[0];
  whereClauses.reduce((whereClause, currWhereClause, i) => {
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

function hasLogicalPrefix(operator: QueryFilterOperator): boolean {
  switch (operator) {
    case 'doesNotContain':
    case 'doesNotStartWith':
    case 'doesNotEndWith':
      return true;
    default:
      return false;
  }
}

function getValue(operator: QueryFilterOperator, value: string): string | string[] {
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
      return value.split('\n');
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
export function getOrgUrlParams(org: SalesforceOrgUi): string {
  const params = {
    [HTTP.HEADERS.X_SFDC_ID]: org.uniqueId || '',
    [HTTP.HEADERS.X_SFDC_LOGIN_URL]: org.loginUrl || '',
    [HTTP.HEADERS.X_SFDC_INSTANCE_URL]: org.instanceUrl || '',
    [HTTP.HEADERS.X_SFDC_ACCESS_TOKEN]: org.accessToken || '',
    [HTTP.HEADERS.X_SFDC_API_VER]: org.apiVersion || '',
    [HTTP.HEADERS.X_SFDC_NAMESPACE_PREFIX]: org.orgNamespacePrefix || '',
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
    { id: 'True', label: 'True', value: 'True' },
    { id: 'False', label: 'False', value: 'False' },
  ];
}

export function getPicklistListItems(field: Field): ListItem[] {
  return [
    {
      id: '',
      label: `-- No Value --`,
      value: '',
    },
  ].concat(
    (field.picklistValues || []).map((item) => ({
      id: item.value,
      label: item.label || item.value,
      value: item.value,
    }))
  );
}
