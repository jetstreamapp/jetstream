import { query } from '@jetstream/shared/data';
import { MapOf, SalesforceOrgUi } from '@jetstream/types';
import { composeQuery, getField } from 'soql-parser-js';
import { logger } from '@jetstream/shared/client-logger';
import { EntityParticleRecord } from '@jetstream/types';
import { REGEX } from '@jetstream/shared/utils';
import { EntityParticleRecordWithRelatedExtIds, FieldMapping } from '../load-records-types';
import groupBy from 'lodash/groupBy';

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

  inputHeader.filter((field) => {
    const [baseFieldOrRelationship, relatedField] = field.split('.');
    const lowercaseFieldOrRelationship = baseFieldOrRelationship.toLowerCase();
    const matchedField =
      fieldVariations[baseFieldOrRelationship] ||
      fieldVariations[lowercaseFieldOrRelationship] ||
      fieldVariations[lowercaseFieldOrRelationship.replace(REGEX.NOT_ALPHANUMERIC, '')];

    output[field] = {
      targetField: matchedField?.QualifiedApiName || null,
      mappedToLookup: false,
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
