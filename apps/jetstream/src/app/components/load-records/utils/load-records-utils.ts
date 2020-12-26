import { logger } from '@jetstream/shared/client-logger';
import { DATE_FORMATS, SFDC_BULK_API_NULL_VALUE } from '@jetstream/shared/constants';
import { queryWithCache } from '@jetstream/shared/data';
import { describeSObjectWithExtendedTypes } from '@jetstream/shared/ui-utils';
import { REGEX } from '@jetstream/shared/utils';
import { EntityParticleRecord, MapOf, SalesforceOrgUi } from '@jetstream/types';
import { formatISO as formatISODate, parse as parseDate, parseISO as parseISODate, startOfDay as startOfDayDate } from 'date-fns';
import { DescribeGlobalSObjectResult } from 'jsforce';
import { isNumber } from 'lodash';
import groupBy from 'lodash/groupBy';
import isNil from 'lodash/isNil';
import isString from 'lodash/isString';
import { composeQuery, getField } from 'soql-parser-js';
import { FieldWithRelatedEntities, FieldMapping, FieldRelatedEntity, PrepareDataPayload } from '../load-records-types';

const DATE_ERR_MESSAGE =
  'There was an error reading one or more date fields in your file. Ensure date fields are properly formatted with a four character year.';

export function filterLoadSobjects(sobject: DescribeGlobalSObjectResult) {
  return (
    sobject.createable &&
    sobject.updateable &&
    !sobject.name.endsWith('__History') &&
    !sobject.name.endsWith('__Tag') &&
    !sobject.name.endsWith('__Share')
  );
}

export async function getFieldMetadata(org: SalesforceOrgUi, sobject: string): Promise<FieldWithRelatedEntities[]> {
  const fields = (await describeSObjectWithExtendedTypes(org, sobject)).fields
    .filter((field) => field.createable || field.updateable || field.name === 'Id')
    .map(
      (field): FieldWithRelatedEntities => ({
        label: field.label,
        name: field.name,
        type: field.type,
        externalId: field.externalId,
        typeLabel: field.typeLabel,
        referenceTo: (field.type === 'reference' && field.referenceTo?.[0]) || undefined,
        relationshipName: field.relationshipName || undefined,
      })
    );

  // fetch all related external Id fields
  const fieldsWithRelationships = fields.filter((field) => !!field.referenceTo);
  const relatedObjects = new Set(fieldsWithRelationships.map((field) => field.referenceTo));
  // related records
  if (relatedObjects.size > 0) {
    const relatedEntities = (
      await queryWithCache<EntityParticleRecord>(org, getExternalIdFieldsForSobjectsQuery(Array.from(relatedObjects)), true)
    ).data;
    const relatedEntitiesByObj = groupBy(relatedEntities.queryResults.records, 'EntityDefinition.QualifiedApiName');
    fieldsWithRelationships.forEach((field) => {
      const relatedFields = relatedEntitiesByObj[field.referenceTo];
      if (relatedFields) {
        field.relatedFields = relatedFields.map(
          (particle): FieldRelatedEntity => ({
            name: particle.Name,
            label: particle.Label,
            type: particle.DataType,
          })
        );
      }
    });
  }
  return fields;
}

/**
 * Attempt to automatch CSV fields to object fields
 * TODO: match against label as well
 * 1. exact API name match
 * 2. lowercase match
 * 3. match without any special characters
 *
 * If field has a "." then an auto-match against the related fields are attempted using steps 1 and 2 from above
 *
 * @param inputHeader
 * @param fields
 */
export function autoMapFields(inputHeader: string[], fields: FieldWithRelatedEntities[]): FieldMapping {
  const output: FieldMapping = {};
  const fieldVariations: MapOf<FieldWithRelatedEntities> = {};

  // create versions of field that can be used to match back to original field
  fields.forEach((field) => {
    fieldVariations[field.name] = field;
    const lowercase = field.name.toLowerCase();
    fieldVariations[lowercase] = field;
    if (isString(field.relationshipName)) {
      fieldVariations[field.relationshipName] = field;
      fieldVariations[field.relationshipName.toLowerCase()] = field;
    }
    fieldVariations[lowercase.replace(REGEX.NOT_ALPHANUMERIC, '')] = field;
  });

  inputHeader.forEach((field) => {
    const [baseFieldOrRelationship, relatedField] = field.split('.');
    const lowercaseFieldOrRelationship = baseFieldOrRelationship.toLowerCase();
    const matchedField =
      fieldVariations[baseFieldOrRelationship] ||
      fieldVariations[lowercaseFieldOrRelationship] ||
      fieldVariations[lowercaseFieldOrRelationship.replace(REGEX.NOT_ALPHANUMERIC, '')];

    output[field] = {
      csvField: field,
      targetField: matchedField?.name || null,
      mappedToLookup: false,
      fieldMetadata: matchedField,
    };

    if (relatedField && matchedField && Array.isArray(matchedField.relatedFields)) {
      const matchedRelatedField = matchedField.relatedFields.find(
        (relatedEntityField) =>
          relatedField === relatedEntityField.name || relatedField.toLowerCase() === relatedEntityField.name.toLowerCase()
      );
      if (matchedRelatedField) {
        output[field].mappedToLookup = true;
        output[field].targetLookupField = matchedRelatedField.name;
        output[field].relationshipName = matchedField.relationshipName;
        output[field].fieldMetadata = matchedField;
        output[field].relatedFieldMetadata = matchedRelatedField;
      } else {
        output[field].targetField = null;
        output[field].fieldMetadata = undefined;
      }
    }
  });

  return checkForDuplicateFieldMappings(output);
}

export function resetFieldMapping(inputHeader: string[]): FieldMapping {
  return inputHeader.reduce((output: FieldMapping, field) => {
    output[field] = {
      csvField: field,
      targetField: null,
      mappedToLookup: false,
      fieldMetadata: undefined,
    };
    return output;
  }, {});
}

export function checkForDuplicateFieldMappings(fieldMapping: FieldMapping): FieldMapping {
  fieldMapping = { ...fieldMapping };
  const mappedFieldFrequency = Object.values(fieldMapping)
    .filter((field) => !!field.targetField)
    .reduce((output: MapOf<number>, field) => {
      output[field.targetField] = output[field.targetField] || 0;
      output[field.targetField] += 1;
      return output;
    }, {});
  Object.keys(fieldMapping).forEach((key) => {
    if (fieldMapping[key].targetField) {
      fieldMapping[key] = { ...fieldMapping[key], isDuplicateMappedField: mappedFieldFrequency[fieldMapping[key].targetField] > 1 };
    } else {
      fieldMapping[key] = { ...fieldMapping[key], isDuplicateMappedField: false };
    }
  });
  return fieldMapping;
}

function getExternalIdFieldsForSobjectsQuery(sobjects: string[]) {
  const soql = composeQuery({
    fields: [
      getField('Id'),
      getField('Name'),
      getField('EntityDefinitionId'),
      getField('EntityDefinition.QualifiedApiName'),
      getField('IsIdLookup'),
      getField('DataType'),
      getField('ValueTypeId'),
      getField('ReferenceTo'),
      getField('IsCreatable'),
      getField('IsUpdatable'),
      getField('Label'),
      getField('MasterLabel'),
      getField('QualifiedApiName'),
      getField('RelationshipName'),
    ],
    sObject: 'EntityParticle',
    where: {
      left: {
        field: 'EntityDefinition.QualifiedApiName',
        operator: 'IN',
        value: sobjects,
        literalType: 'STRING',
      },
      operator: 'AND',
      right: {
        left: {
          field: 'IsIdLookup',
          operator: '=',
          value: 'true',
          literalType: 'BOOLEAN',
        },
      },
    },
    orderBy: [
      {
        field: 'EntityDefinitionId',
      },
      { field: 'Label' },
    ],
  });
  logger.info('getExternalIdFieldsForSobjectsQuery()', { soql });
  return soql;
}

export function getFieldHeaderFromMapping(fieldMapping: FieldMapping) {
  return Object.values(fieldMapping)
    .filter((item) => !!item.targetField)
    .map((item) => {
      let output = item.targetField;
      if (item.mappedToLookup && item.targetLookupField) {
        output = `${item.relationshipName}.${item.targetLookupField}`;
      }
      return output;
    });
}

export function transformData({ data, fieldMapping, sObject, insertNulls, dateFormat, apiMode }: PrepareDataPayload): any[] {
  return data.map((row) => {
    return Object.keys(fieldMapping)
      .filter((key) => !!fieldMapping[key].targetField)
      .reduce((output: any, field, i) => {
        if (apiMode === 'BATCH' && i === 0) {
          output.attributes = { type: sObject };
        }
        let skipField = false;
        const fieldMappingItem = fieldMapping[field];
        // SFDC handles automatic type conversion with both bulk and batch apis (if possible, otherwise the record errors)
        let value = row[field];

        if (isNil(value) || (isString(value) && !value)) {
          if (apiMode === 'BULK' && insertNulls) {
            value = SFDC_BULK_API_NULL_VALUE;
          } else if (apiMode === 'BATCH' && insertNulls) {
            value = null;
          } else if (apiMode === 'BATCH') {
            // batch api will always clear the value in SFDC if a null is passed, so we must ensure it is not included at all
            skipField = true;
          }
        } else if (fieldMappingItem.fieldMetadata.type === 'boolean') {
          if (isString(value) || isNumber(value)) {
            // any string that starts with "t" or number that starts with "1" is set to true
            // all other values to false (case-insensitive)
            value = REGEX.BOOLEAN_STR_TRUE.test(`${value}`);
          }
        } else if (fieldMappingItem.fieldMetadata.type === 'date') {
          value = transformDate(value, dateFormat);
        } else if (fieldMappingItem.fieldMetadata.type === 'datetime') {
          value = transformDateTime(value, dateFormat);
        } else if (fieldMappingItem.fieldMetadata.type === 'time') {
          // time format is specific
          // TODO: detect if times should be corrected
          // 10 PM
          // 10:10 PM
          // 10:10:00 PM
          // 10:10
          // -->expected
          // 13:15:00.000Z
        }
        // should we automatically do this? should we give the user an option?
        // else if(isString(value)) {
        // value = value.trim();
        // }

        if (!skipField) {
          if (apiMode === 'BATCH' && fieldMappingItem.mappedToLookup && fieldMappingItem.targetLookupField) {
            output[fieldMappingItem.relationshipName] = { [fieldMappingItem.targetLookupField]: value };
          } else if (fieldMappingItem.mappedToLookup && fieldMappingItem.targetLookupField) {
            output[`${fieldMappingItem.relationshipName}.${fieldMappingItem.targetLookupField}`] = value;
          } else {
            output[fieldMappingItem.targetField] = value;
          }
        }

        return output;
      }, {});
  });
}

function transformDate(value: any, dateFormat: string): string | null {
  if (!value) {
    return null;
  }
  if (value instanceof Date) {
    if (!isNaN(value.getTime())) {
      try {
        return formatISODate(value, { representation: 'date' });
      } catch (ex) {
        throw new Error(DATE_ERR_MESSAGE);
      }
    } else {
      // date is invalid
      return null;
    }
  } else if (isString(value)) {
    if (REGEX.ISO_DATE.test(value)) {
      try {
        return formatISODate(parseISODate(value), { representation: 'date' });
      } catch (ex) {
        throw new Error(DATE_ERR_MESSAGE);
      }
    }
    try {
      return buildDateFromString(value, dateFormat, 'date');
    } catch (ex) {
      throw new Error(DATE_ERR_MESSAGE);
    }
  }
  return null;
}

function buildDateFromString(value: string, dateFormat: string, representation: 'date' | 'complete') {
  const refDate = startOfDayDate(new Date());
  const tempValue = value.replace(REGEX.NOT_NUMERIC, '-'); // FIXME: some date formats are 'd. m. yyyy' like 'sk-SK'
  const [first, middle, end] = tempValue.split('-');
  if (!first || !middle || !end) {
    return null;
  }
  switch (dateFormat) {
    case DATE_FORMATS.MM_DD_YYYY: {
      first.padStart(2, '0');
      middle.padStart(2, '0');
      end.padStart(4, '19');
      return formatISODate(parseDate(`${first}-${middle}-${end}`, 'MM-dd-yyyy', refDate), { representation });
    }
    case DATE_FORMATS.DD_MM_YYYY: {
      first.padStart(2, '0');
      middle.padStart(2, '0');
      end.padStart(4, '19');
      return formatISODate(parseDate(`${first}-${middle}-${end}`, 'dd-MM-yyyy', refDate), { representation });
    }
    case DATE_FORMATS.YYYY_MM_DD: {
      end.padStart(2, '0');
      first.padStart(2, '0');
      middle.padStart(4, '19');
      return formatISODate(parseDate(`${first}-${middle}-${end}`, 'yyyy-MM-dd', refDate), { representation });
    }
    default:
      break;
  }
}

function transformDateTime(value: string | null | Date, dateFormat: string): string | null {
  if (!value) {
    return null;
  }
  if (value instanceof Date) {
    if (!isNaN(value.getTime())) {
      return formatISODate(value, { representation: 'complete' });
    } else {
      // date is invalid
      return null;
    }
  } else if (isString(value)) {
    if (REGEX.ISO_DATE.test(value)) {
      return formatISODate(parseISODate(value), { representation: 'complete' });
    }

    value = value.replace('T', ' ');
    const [date, time] = value.split(' ', 2);
    if (!time) {
      return buildDateFromString(date.trim(), dateFormat, 'complete');
    }

    // TODO:
    // based on locale, we need to parse the date and the time
    // could be 12 hour time, or 24 hour time
    // date will vary depending on locale
    return null; // FIXME:
  }
  return null;
}
