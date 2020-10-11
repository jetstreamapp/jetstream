import { query } from '@jetstream/shared/data';
import { MapOf, SalesforceOrgUi } from '@jetstream/types';
import { composeQuery, getField } from 'soql-parser-js';
import { logger } from '@jetstream/shared/client-logger';
import { EntityParticleRecord } from '@jetstream/types';
import { REGEX } from '@jetstream/shared/utils';
import { ApiMode, EntityParticleRecordWithRelatedExtIds, FieldMapping, PrepareDataPayload } from '../load-records-types';
import groupBy from 'lodash/groupBy';
import isString from 'lodash/isString';
import { DATE_FORMATS, SFDC_BULK_API_NULL_VALUE } from '@jetstream/shared/constants';
import { parse as parseDate, parseISO as parseISODate, formatISO as formatISODate, startOfDay as startOfDayDate } from 'date-fns';
import isNil from 'lodash/isNil';

/**
 * Fetch all fields and related fields, which are added to attributes.relatedRecords
 * @param selectedOrg
 * @param sobject
 */
export async function getFieldMetadata(
  selectedOrg: SalesforceOrgUi,
  sobject: string
): Promise<{
  sobject: string;
  fields: EntityParticleRecordWithRelatedExtIds[];
}> {
  const initialFields = await query<EntityParticleRecordWithRelatedExtIds>(selectedOrg, getInitialEntityDefinitionQuery(sobject), true);
  const fields = initialFields.queryResults.records.filter((record) => record.IsCreatable || record.IsUpdatable || record.IsIdLookup);
  const fieldsWithRelationships = fields.filter((record) => !!record.RelationshipName && Array.isArray(record.ReferenceTo.referenceTo));
  const relatedObjects = new Set(fieldsWithRelationships.map((record) => record.ReferenceTo.referenceTo[0]));
  if (relatedObjects.size > 0) {
    const relatedEntities = await query<EntityParticleRecord>(
      selectedOrg,
      getRelatedEntityDefinitionQuery(Array.from(relatedObjects)),
      true
    );
    const relatedEntitiesByObj = groupBy(relatedEntities.queryResults.records, 'EntityDefinitionId');
    fieldsWithRelationships.forEach((record) => {
      record.attributes.relatedRecords = relatedEntitiesByObj[record.ReferenceTo.referenceTo[0]] || [];
    });
  }
  return { sobject, fields };
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
export function autoMapFields(inputHeader: string[], fields: EntityParticleRecordWithRelatedExtIds[]): FieldMapping {
  const output: FieldMapping = {};
  const fieldVariations: MapOf<EntityParticleRecordWithRelatedExtIds> = {};

  // create versions of field that can be used to match back to original field
  fields.forEach((field) => {
    fieldVariations[field.QualifiedApiName] = field;
    const lowercase = field.QualifiedApiName.toLowerCase();
    fieldVariations[lowercase] = field;
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
      targetField: matchedField?.QualifiedApiName || null,
      mappedToLookup: false,
      fieldMetadata: matchedField,
    };

    if (relatedField && matchedField && Array.isArray(matchedField.attributes.relatedRecords)) {
      const matchedRelatedField = matchedField.attributes.relatedRecords.find(
        (relatedEntityField) =>
          relatedField === relatedEntityField.QualifiedApiName ||
          relatedField.toLowerCase() === relatedEntityField.QualifiedApiName.toLowerCase()
      );
      if (matchedRelatedField) {
        output[field].mappedToLookup = true;
        output[field].targetLookupField = matchedRelatedField.QualifiedApiName;
        output[field].relationshipName = matchedField.RelationshipName;
        output[field].fieldMetadata = matchedRelatedField;
      }
    }
  });

  return output;
}

function getInitialEntityDefinitionQuery(sobject: string) {
  const soql = composeQuery({
    fields: [
      getField('Id'),
      getField('Name'),
      getField('EntityDefinitionId'),
      getField('IsIdLookup'),
      getField('DataType'),
      getField('ValueTypeId'),
      getField('ReferenceTo'),
      getField('EntityDefinition.DeveloperName'),
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
        field: 'EntityDefinitionId',
        operator: '=',
        value: sobject,
        literalType: 'STRING',
      },
      // operator: 'AND',
      // right: {
      //   left: {
      //     field: 'IsCreatable',
      //     operator: '=',
      //     value: 'true',
      //     literalType: 'BOOLEAN',
      //   },
      // },
    },
    orderBy: {
      field: 'Label',
    },
  });
  logger.info('getWorkflowRuleQuery()', { soql });
  return soql;
}

function getRelatedEntityDefinitionQuery(sobjects: string[]) {
  const soql = composeQuery({
    fields: [
      getField('Id'),
      getField('Name'),
      getField('EntityDefinitionId'),
      getField('EntityDefinition.DeveloperName'),
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
        field: 'EntityDefinition.DeveloperName',
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
  logger.info('getWorkflowRuleQuery()', { soql });
  return soql;
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
        } else if (fieldMappingItem.fieldMetadata.DataType === 'date') {
          value = transformDate(value, dateFormat);
        } else if (fieldMappingItem.fieldMetadata.DataType === 'datetime') {
          value = transformDateTime(value, dateFormat);
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
      return formatISODate(value, { representation: 'date' });
    } else {
      // date is invalid
      return null;
    }
  } else if (isString(value)) {
    if (REGEX.ISO_DATE.test(value)) {
      return formatISODate(parseISODate(value), { representation: 'date' });
    }
    return buildDateFromString(value, dateFormat, 'date');
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
      return formatISODate(parseDate(`${first}-${middle}-${end}`, DATE_FORMATS.MM_DD_YYYY, refDate), { representation });
    }
    case DATE_FORMATS.DD_MM_YYYY: {
      first.padStart(2, '0');
      middle.padStart(2, '0');
      end.padStart(4, '19');
      return formatISODate(parseDate(`${first}-${middle}-${end}`, DATE_FORMATS.DD_MM_YYYY, refDate), { representation });
    }
    case DATE_FORMATS.YYYY_MM_DD: {
      end.padStart(2, '0');
      first.padStart(2, '0');
      middle.padStart(4, '19');
      return formatISODate(parseDate(`${first}-${middle}-${end}`, DATE_FORMATS.YYYY_MM_DD, refDate), { representation });
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
    // based on locase, we need to parse the date and the time
    // could be 12 hour time, or 24 hour time
    // date will vary depending on locale
    return null; // FIXME:
  }
  return null;
}
