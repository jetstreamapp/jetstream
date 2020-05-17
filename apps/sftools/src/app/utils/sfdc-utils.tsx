import { Field } from 'jsforce';

export function getFieldDefinitionQuery(sobject: string) {
  return `
    SELECT
      Id,
      QualifiedApiName,
      Label,
      MasterLabel,
      DataType,
      ValueTypeId,
      ReferenceTo,
      ExtraTypeInfo,
      PublisherId,
      RelationshipName,
      LastModifiedBy.Name,
      LastModifiedDate,
      IsCompound,
      IsHighScaleNumber,
      IsHtmlFormatted,
      IsNameField,
      IsNillable,
      IsCalculated,
      IsApiFilterable,
      IsApiGroupable,
      IsApiSortable,
      IsPolymorphicForeignKey
    FROM FieldDefinition
    WHERE EntityDefinitionId = '${sobject}'
  `;
}

/**
 * Fetching field definition for some object types fails
 * (e.x. user)
 */
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
