import { Field } from 'jsforce';
import { orderObjectsBy } from '@silverthorn/shared/utils';
import { MimeType, PositionAll } from '@silverthorn/types';
import { saveAs } from 'file-saver';
import { Placement as tippyPlacement } from 'tippy.js';

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
