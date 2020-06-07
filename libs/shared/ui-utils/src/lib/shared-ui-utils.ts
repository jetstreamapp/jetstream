import { Field } from 'jsforce';
import { orderObjectsBy } from '@jetstream/shared/utils';
import { MimeType, PositionAll, QueryFilterOperator, ExpressionType } from '@jetstream/types';
import { saveAs } from 'file-saver';
import { Placement as tippyPlacement } from 'tippy.js';
import { Query, WhereClause, Operator } from 'soql-parser-js';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function parseQueryParams<T = any>(queryString: string): T {
  const pairs = (queryString[0] === '?' ? queryString.substr(1) : queryString).split('&');
  return pairs.reduce((query: Partial<T>, currPair) => {
    const [key, value] = currPair.split('=');
    query[decodeURIComponent(key)] = decodeURIComponent(value || '');
    return query;
  }, {}) as T;
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
  // filter out all invalid/incomplete filters
  const rows = filters.rows.filter((row) => row.selected.operator && row.selected.resource && row.selected.value);
  const groups = filters.groups
    .map((group) => {
      return {
        ...group,
        rows: rows.filter((row) => row.selected.operator && row.selected.resource && row.selected.value),
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
        value: row.selected.value,
        literalType: 'STRING', // FIXME: we need to know more type info
      },
      operator: i !== 0 ? filters.action : undefined,
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
          value: row.selected.value,
          literalType: 'STRING', // FIXME: we need to know more type info
        },
        operator: i !== 0 ? group.action : undefined,
      };
      tempWhereClauses.push(whereClause);
      whereClauses.push(whereClause);
    });
    tempWhereClauses[0].left.openParen = 1;
    tempWhereClauses[tempWhereClauses.length - 1].left.closeParen = 1;
  });

  // combine all where clauses
  const rootClause = whereClauses[0];
  whereClauses.reduce((whereClause, currWhereClause) => {
    if (whereClause) {
      whereClause.right = currWhereClause;
    }
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

function convertQueryFilterOperator(operator: QueryFilterOperator): Operator {
  switch (operator) {
    case 'eq': {
      return '=';
    }
    case 'ne': {
      return '!=';
    }
    case 'lt': {
      return '<';
    }
    case 'lte': {
      return '<=';
    }
    case 'gt': {
      return '>';
    }
    case 'gte': {
      return '>=';
    }
    case 'in': {
      return 'IN';
    }
    case 'notIn': {
      return 'NOT IN';
    }
    case 'includes': {
      return 'INCLUDES';
    }
    case 'excludes': {
      return 'EXCLUDES';
    }
    default:
      return 'LIKE';
  }
}
