import { logger } from '@jetstream/shared/client-logger';
import { SFDC_BULK_API_NULL_VALUE } from '@jetstream/shared/constants';
import { queryAll, queryWithCache } from '@jetstream/shared/data';
import { describeSObjectWithExtendedTypes, formatNumber, isRelationshipField } from '@jetstream/shared/ui-utils';
import { REGEX, delay, groupByFlat, sanitizeForXml, transformRecordForDataLoad } from '@jetstream/shared/utils';
import type {
  ApiMode,
  FieldMapping,
  FieldMappingItem,
  FieldMappingItemCsv,
  FieldMappingItemStatic,
  FieldRelatedEntity,
  FieldWithRelatedEntities,
  MapOfCustomMetadataRecord,
  NonExtIdLookupOption,
  PrepareDataPayload,
  PrepareDataResponse,
} from '@jetstream/types';
import { EntityParticleRecord, FieldWithExtendedType, InsertUpdateUpsertDelete, Maybe, SalesforceOrgUi } from '@jetstream/types';
import { Query, WhereClauseWithRightCondition, WhereClauseWithoutOperator, composeQuery, getField } from '@jetstreamapp/soql-parser-js';
import JSZip from 'jszip';
import groupBy from 'lodash/groupBy';
import isNil from 'lodash/isNil';
import isString from 'lodash/isString';
import uniqueId from 'lodash/uniqueId';

// Duplicated here to avoid circular dependency
export interface SavedFieldMapping {
  [field: string]: Omit<FieldMappingItem, 'fieldMetadata'>;
}
// Duplicated here to avoid circular dependency
export interface LoadSavedMappingItem {
  key: string; // object:createdDate
  name: string;
  sobject: string;
  csvFields: string[];
  sobjectFields: string[];
  mapping: SavedFieldMapping;
  createdDate: Date;
}

export const SELF_LOOKUP_KEY = '~SELF_LOOKUP~';
export const STATIC_MAPPING_PREFIX = '~STATIC~MAPPING~';
export const BATCH_RECOMMENDED_THRESHOLD = 2000;
export const MAX_API_CALLS = 250;
export const MAX_BULK = 10000;
export const MAX_BATCH = 200;
const DEFAULT_NON_EXT_ID_MAPPING_OPT: NonExtIdLookupOption = 'ERROR_IF_MULTIPLE';
const DEFAULT_NULL_IF_NO_MATCH_MAPPING_OPT = false;

export class LoadRecordsBatchError extends Error {
  additionalErrors: Error[];
  constructor(message: string, additionalErrors?: Error[]) {
    super(`${message}. ${additionalErrors ? additionalErrors.map((ex) => ex.message).join(', ') : ''}`.trim());
    this.additionalErrors = additionalErrors || [];
  }
}

export const getFieldMetadataFilter = (field: FieldWithExtendedType) => field.createable || field.updateable || field.name === 'Id';
// Custom metadata shows all fields as read-only, but we want to be able to update them
export const getFieldMetadataCustomMetadataFilter = (field: FieldWithExtendedType) =>
  field.custom || field.name === 'DeveloperName' || field.name === 'Label';

export async function getFieldMetadata(org: SalesforceOrgUi, sobject: string): Promise<FieldWithRelatedEntities[]> {
  const fields = (await describeSObjectWithExtendedTypes(org, sobject)).fields
    .filter(sobject.endsWith('__mdt') ? getFieldMetadataCustomMetadataFilter : getFieldMetadataFilter)
    .map((field): FieldWithRelatedEntities => {
      let referenceTo =
        (isRelationshipField(field) && field.referenceTo?.slice(0, 5 /** Limit number of related object to limit query */)) || undefined;
      // if only two polymorphic fields exist and the second is user, reverse the order so that User is first as it is most commonly used
      if (Array.isArray(referenceTo) && referenceTo.length === 2 && referenceTo[1] === 'User') {
        referenceTo = referenceTo.reverse();
      }

      let relationshipName = field.relationshipName || undefined;

      // Fake lookup field for self-relationship (e.x. use Email as Id for base record)
      if (field.name === 'Id') {
        referenceTo = [sobject];
        relationshipName = SELF_LOOKUP_KEY;
      }

      return {
        label: field.label,
        name: field.name,
        type: field.type,
        soapType: field.soapType,
        externalId: field.externalId,
        typeLabel: field.typeLabel,
        referenceTo,
        relationshipName,
        field,
      };
    });

  // fetch all related fields
  const fieldsWithRelationships = fields.filter((field) => Array.isArray(field.referenceTo) && field.referenceTo.length);
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  const relatedObjects = new Set(fieldsWithRelationships.flatMap((field) => field.referenceTo!));
  // related records
  if (relatedObjects.size > 0) {
    const relatedEntities = (
      await queryWithCache<EntityParticleRecord>(org, getExternalIdFieldsForSobjectsQuery(Array.from(relatedObjects)))
    ).data;
    const relatedEntitiesByObj = groupBy(relatedEntities.queryResults.records, 'EntityDefinition.QualifiedApiName');
    fieldsWithRelationships.forEach((field) => {
      if (Array.isArray(field.referenceTo)) {
        field.referenceTo.forEach((referenceTo) => {
          const relatedFields = relatedEntitiesByObj[referenceTo];
          if (relatedFields) {
            field.relatedFields = field.relatedFields || {};
            field.relatedFields[referenceTo] = relatedFields.map(
              (particle): FieldRelatedEntity => ({
                name: particle.Name,
                label: particle.Label,
                type: particle.DataType,
                isExternalId: particle.IsIdLookup,
              })
            );
          }
        });
      }
    });
  }
  return fields;
}

export function getRecommendedApiMode(numRecords: number, hasBinaryAttachment: boolean): ApiMode {
  return !hasBinaryAttachment && numRecords > BATCH_RECOMMENDED_THRESHOLD ? 'BULK' : 'BATCH';
}

export function getLabelWithOptionalRecommended(label: string, recommended: boolean, required: boolean): string | JSX.Element {
  if (!recommended && !required) {
    return label;
  }
  if (required) {
    return (
      <span>
        {label} <span className="slds-text-body_small slds-text-color_weak">(Required based on the load configuration)</span>
      </span>
    );
  }
  return (
    <span>
      {label} <span className="slds-text-body_small slds-text-color_weak">(Recommended based on the number of impacted records)</span>
    </span>
  );
}

export function getMaxBatchSize(apiMode: ApiMode): number {
  if (apiMode === 'BATCH') {
    return MAX_BATCH;
  } else {
    return MAX_BULK;
  }
}

/**
 * Attempt to auto-match CSV fields to object fields
 * 1. exact API name match
 * 2. lowercase match
 * 3. match without any special characters
 *
 * If field has a "." then an auto-match against the related fields are attempted using steps 1 and 2 from above
 *
 * @param inputHeader
 * @param fields
 */
export function autoMapFields(
  inputHeader: string[],
  fields: FieldWithRelatedEntities[],
  binaryBodyField: Maybe<string>,
  loadType: InsertUpdateUpsertDelete,
  externalId?: Maybe<string>
): FieldMapping {
  const output: FieldMapping = {};
  const fieldVariations: Record<string, FieldWithRelatedEntities> = {};
  const fieldLabelVariations: Record<string, FieldWithRelatedEntities> = {};

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

    // label takes second priority to api name
    fieldLabelVariations[field.label] = field;
    const lowercaseLabel = field.label.toLowerCase();
    fieldLabelVariations[lowercaseLabel] = field;
    fieldLabelVariations[lowercaseLabel.replace(REGEX.NOT_ALPHANUMERIC, '')] = field;
  });

  inputHeader.forEach((field) => {
    const [baseFieldOrRelationship, relatedField] = field.split('.');
    const lowercaseFieldOrRelationship = baseFieldOrRelationship.toLowerCase();
    const matchedField =
      /** Match Against Api name or full path with api name */
      fieldVariations[baseFieldOrRelationship] ||
      fieldVariations[lowercaseFieldOrRelationship] ||
      fieldVariations[lowercaseFieldOrRelationship.replace(REGEX.NOT_ALPHANUMERIC, '')] ||
      /** Match Against Label (relationship fields are not considered) */
      fieldLabelVariations[baseFieldOrRelationship] ||
      fieldLabelVariations[lowercaseFieldOrRelationship] ||
      fieldLabelVariations[lowercaseFieldOrRelationship.replace(REGEX.NOT_ALPHANUMERIC, '')];

    output[field] = {
      type: 'CSV',
      csvField: field,
      targetField: matchedField?.name || null,
      mappedToLookup: false,
      fieldMetadata: matchedField,
      lookupOptionUseFirstMatch: DEFAULT_NON_EXT_ID_MAPPING_OPT,
      lookupOptionNullIfNoMatch: DEFAULT_NULL_IF_NO_MATCH_MAPPING_OPT,
      isBinaryBodyField: !!binaryBodyField && matchedField?.name === binaryBodyField,
    };

    if (relatedField && matchedField && matchedField.relatedFields) {
      // search all related object fields to see if related field matches
      const { relatedObject, matchedRelatedField } = Object.keys(matchedField.relatedFields).reduce(
        (output: { relatedObject: string | undefined; matchedRelatedField: FieldRelatedEntity | undefined }, key) => {
          // if we found a prior match, stop checking
          if (output.matchedRelatedField) {
            return output;
          }
          // find if current related object has field by same related name
          const matchedRelatedField = matchedField.relatedFields?.[key].find(
            (relatedEntityField) =>
              relatedField === relatedEntityField.name || relatedField.toLowerCase() === relatedEntityField.name.toLowerCase()
          );
          if (matchedRelatedField) {
            output = { relatedObject: key, matchedRelatedField };
          }
          return output;
        },
        { relatedObject: undefined, matchedRelatedField: undefined }
      );

      if (matchedRelatedField) {
        output[field].mappedToLookup = true;
        output[field].targetLookupField = matchedRelatedField.name;
        output[field].relationshipName = matchedField.relationshipName;
        output[field].fieldMetadata = matchedField;
        output[field].relatedFieldMetadata = matchedRelatedField;
        output[field].selectedReferenceTo = relatedObject;
      } else {
        output[field].targetField = null;
        output[field].fieldMetadata = undefined;
      }
    }
  });

  return checkFieldsForMappingError(output, loadType, externalId);
}

export function resetFieldMapping(inputHeader: string[]): FieldMapping {
  return inputHeader.reduce((output: FieldMapping, field) => {
    output[field] = {
      type: 'CSV',
      csvField: field,
      targetField: null,
      mappedToLookup: false,
      fieldMetadata: undefined,
      selectedReferenceTo: undefined,
      lookupOptionUseFirstMatch: DEFAULT_NON_EXT_ID_MAPPING_OPT,
      lookupOptionNullIfNoMatch: DEFAULT_NULL_IF_NO_MATCH_MAPPING_OPT,
      isBinaryBodyField: false,
    };
    return output;
  }, {});
}

export function initStaticFieldMappingItem(): FieldMappingItemStatic {
  const csvValuePlaceholder = uniqueId(STATIC_MAPPING_PREFIX);
  return {
    type: 'STATIC',
    csvField: csvValuePlaceholder,
    staticValue: '',
    targetField: null,
    mappedToLookup: false,
    fieldMetadata: undefined,
    selectedReferenceTo: undefined,
    lookupOptionUseFirstMatch: DEFAULT_NON_EXT_ID_MAPPING_OPT,
    lookupOptionNullIfNoMatch: DEFAULT_NULL_IF_NO_MATCH_MAPPING_OPT,
    isBinaryBodyField: false,
  };
}

export function loadFieldMappingFromSavedMapping(
  savedMapping: LoadSavedMappingItem,
  inputHeader: string[],
  fields: FieldWithRelatedEntities[],
  binaryBodyField: Maybe<string>
): FieldMapping {
  const fieldMetadataByName = groupByFlat(fields, 'name');
  const newMapping = inputHeader.reduce((output: FieldMapping, field) => {
    const matchedMapping = savedMapping.mapping[field];
    if (matchedMapping && matchedMapping.targetField && fieldMetadataByName[matchedMapping.targetField]) {
      output[field] = {
        ...savedMapping.mapping[field],
        fieldMetadata: {
          ...fieldMetadataByName[matchedMapping.targetField],
        },
        isBinaryBodyField: !!binaryBodyField && matchedMapping.targetField === binaryBodyField,
      } as FieldMappingItemCsv;
    } else {
      output[field] = {
        type: 'CSV',
        csvField: field,
        targetField: null,
        mappedToLookup: false,
        fieldMetadata: undefined,
        selectedReferenceTo: undefined,
        lookupOptionUseFirstMatch: DEFAULT_NON_EXT_ID_MAPPING_OPT,
        lookupOptionNullIfNoMatch: DEFAULT_NULL_IF_NO_MATCH_MAPPING_OPT,
        isBinaryBodyField: false,
      };
    }
    return output;
  }, {});

  Object.keys(savedMapping.mapping)
    .filter((key) => key.startsWith(STATIC_MAPPING_PREFIX))
    .forEach((field) => {
      const mapping = savedMapping.mapping[field];
      if (mapping.targetField) {
        newMapping[field] = {
          ...mapping,
          type: 'STATIC',
          fieldMetadata: {
            ...fieldMetadataByName[mapping.targetField],
          },
          isBinaryBodyField: false,
        } as FieldMappingItemStatic;
      }
    });

  return newMapping;
}

export function checkFieldsForMappingError(
  fieldMapping: FieldMapping,
  loadType: InsertUpdateUpsertDelete,
  externalId?: Maybe<string>
): FieldMapping {
  fieldMapping = checkForDuplicateFieldMappings(fieldMapping);
  fieldMapping = checkForExternalIdFieldMappingsError(fieldMapping, loadType, externalId);
  return fieldMapping;
}

export function checkForDuplicateFieldMappings(fieldMapping: FieldMapping): FieldMapping {
  fieldMapping = { ...fieldMapping };
  const mappedFieldFrequency = Object.values(fieldMapping)
    .filter((field) => !!field.targetField)
    .reduce((output: Record<string, number>, field) => {
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      output[field.targetField!] = output[field.targetField!] || 0;
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      output[field.targetField!] += 1;
      return output;
    }, {});
  Object.keys(fieldMapping).forEach((key) => {
    if (fieldMapping[key].targetField) {
      const isDuplicateMappedField = (mappedFieldFrequency[fieldMapping[key].targetField || ''] || 0) > 1;
      fieldMapping[key] = {
        ...fieldMapping[key],
        isDuplicateMappedField,
        fieldErrorMsg: isDuplicateMappedField ? 'Each Salesforce field should only be mapped once' : undefined,
      };
    } else {
      fieldMapping[key] = { ...fieldMapping[key], isDuplicateMappedField: false };
    }
  });
  return fieldMapping;
}

export function checkForExternalIdFieldMappingsError(
  fieldMapping: FieldMapping,
  loadType: InsertUpdateUpsertDelete,
  externalId?: Maybe<string>
): FieldMapping {
  if (loadType !== 'UPSERT' || !externalId || externalId === 'Id') {
    return fieldMapping;
  }
  fieldMapping = { ...fieldMapping };
  Object.keys(fieldMapping).forEach((key) => {
    if (fieldMapping[key].targetField === 'Id' && !fieldMapping[key].fieldErrorMsg) {
      fieldMapping[key] = {
        ...fieldMapping[key],
        fieldErrorMsg: 'Including a Record Id in an upsert will cause the load to fail',
      };
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
          field: 'QualifiedApiName',
          operator: '!=',
          value: 'Id',
          literalType: 'STRING',
        },
        operator: 'AND',
        right: {
          left: {
            field: 'DataType',
            operator: 'IN',
            value: ['string', 'phone', 'url', 'email'],
            literalType: 'STRING',
          },
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

export function getFieldHeaderFromMapping(fieldMapping: FieldMapping): string[] {
  return Object.values(fieldMapping)
    .filter((item) => !!item.targetField)
    .map((item) => {
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      let output = item.targetField!;
      if (
        item.mappedToLookup &&
        item.targetLookupField &&
        item.relatedFieldMetadata?.isExternalId &&
        item.relationshipName !== SELF_LOOKUP_KEY
      ) {
        output = `${item.relationshipName}.${item.targetLookupField}`;
      }
      return output;
    });
}

export async function transformData({ data, fieldMapping, sObject, insertNulls, dateFormat, apiMode }: PrepareDataPayload): Promise<any[]> {
  const output: any[] = [];
  let counter = 0;

  for (const row of data) {
    counter++;
    /**
     * Let other work get done every 1K records to avoid blocking the UI
     */
    if (counter % 1000 === 0) {
      await delay(0);
    }
    const processedRow = Object.keys(fieldMapping)
      .filter((key) => !!fieldMapping[key].targetField)
      .reduce((output: any, field, i) => {
        if (apiMode === 'BATCH' && i === 0) {
          output.attributes = { type: sObject };
        }
        let skipField = false;
        const fieldMappingItem = fieldMapping[field];
        const isCheckbox = fieldMappingItem.fieldMetadata?.type === 'boolean';
        // SFDC handles automatic type conversion with both bulk and batch apis (if possible, otherwise the record errors)
        let value = fieldMappingItem.type === 'STATIC' ? fieldMappingItem.staticValue : row[field];

        if (isNil(value) || (isString(value) && !value)) {
          if (apiMode === 'BULK' && insertNulls) {
            value = isCheckbox ? false : SFDC_BULK_API_NULL_VALUE;
          } else if (apiMode === 'BATCH' && insertNulls) {
            value = isCheckbox ? false : null;
          } else if (apiMode === 'BATCH') {
            // batch api will always clear the value in SFDC if a null is passed, so we must ensure it is not included at all
            skipField = true;
          }
        } else if (fieldMappingItem.fieldMetadata) {
          value = transformRecordForDataLoad(value, fieldMappingItem.fieldMetadata.type, dateFormat);
        }

        if (!skipField) {
          // Handle external Id related fields
          // Non-external Id lookups are handled separately in `fetchMappedRelatedRecords()` and are mapped normally to the target field initially
          if (
            apiMode === 'BATCH' &&
            fieldMappingItem.mappedToLookup &&
            fieldMappingItem.relatedFieldMetadata?.isExternalId &&
            fieldMappingItem.relationshipName !== SELF_LOOKUP_KEY &&
            fieldMappingItem.relationshipName &&
            fieldMappingItem.targetLookupField
          ) {
            output[fieldMappingItem.relationshipName] = { [fieldMappingItem.targetLookupField]: value };
            // if polymorphic field, then add type attribute
            if ((fieldMappingItem.fieldMetadata?.referenceTo?.length || 0) > 1) {
              output[fieldMappingItem.relationshipName] = {
                attributes: { type: fieldMappingItem.selectedReferenceTo },
                ...output[fieldMappingItem.relationshipName],
              };
            }
          } else if (
            fieldMappingItem.mappedToLookup &&
            fieldMappingItem.relatedFieldMetadata?.isExternalId &&
            fieldMappingItem.relationshipName !== SELF_LOOKUP_KEY &&
            fieldMappingItem.targetLookupField
          ) {
            if ((fieldMappingItem.fieldMetadata?.referenceTo?.length || 0) > 1) {
              // add in polymorphic field type
              // https://developer.salesforce.com/docs/atlas.en-us.api_asynch.meta/api_asynch/datafiles_csv_rel_field_header_row.htm?search_text=Polymorphic
              output[`${fieldMappingItem.selectedReferenceTo}:${fieldMappingItem.relationshipName}.${fieldMappingItem.targetLookupField}`] =
                value;
            } else {
              output[`${fieldMappingItem.relationshipName}.${fieldMappingItem.targetLookupField}`] = value;
            }
          } else if (fieldMappingItem.targetField) {
            output[fieldMappingItem.targetField] = value;
          }
        }

        return output;
      }, {});

    output.push(processedRow);
  }
  return output;
}

/**
 * For any lookup fields that are not mapped to an external Id, fetch related records and populate related record Id for each field
 * The fieldMapping option contains the options the user selected on how to handle cases where 0 or multiple related records are found for a given value
 *
 * @param data records
 * @param param1
 * @returns
 */
export async function fetchMappedRelatedRecords(
  data: any,
  { org, sObject, fieldMapping, apiMode }: PrepareDataPayload,
  onProgress: (progress: number) => void
): Promise<PrepareDataResponse> {
  const nonExternalIdFieldMappings = Object.values(fieldMapping).filter(
    (item) =>
      item.mappedToLookup &&
      item.relatedFieldMetadata &&
      (!item.relatedFieldMetadata.isExternalId || item.relationshipName === SELF_LOOKUP_KEY)
  );

  const queryErrors: string[] = [];
  const errorsByRowIndex = new Map<number, { row: number; record: any; errors: string[] }>();
  const addError = addErrors(errorsByRowIndex);

  if (nonExternalIdFieldMappings.length) {
    // progress indicator
    let current = 0;
    const step = 100 / nonExternalIdFieldMappings.length;
    const total = 100;

    // increment progress between current and next step - lots of incremental records queried
    const emitQueryProgress = (currentQuery: number, total: number) => {
      const progressIncrement = (currentQuery / total) * step;
      // ensure we don't exceed beyond the current step
      onProgress(Math.min(current + progressIncrement, current + step));
    };

    for (const {
      lookupOptionNullIfNoMatch,
      lookupOptionUseFirstMatch,
      relationshipName,
      selectedReferenceTo,
      targetField,
      targetLookupField,
    } of nonExternalIdFieldMappings) {
      onProgress(Math.min(current / total, 100));
      // only used for error messaging
      let fieldRelationshipName = `${relationshipName}.${targetLookupField}`;
      if (relationshipName === SELF_LOOKUP_KEY) {
        // Don't show user ~SELF_LOOKUP~
        fieldRelationshipName = `${targetLookupField}`;
      }
      // remove any falsy values, related fields cannot be booleans or numbers, so this should not cause issues
      const relatedValues = new Set<string>(data.map((row) => row[targetField || '']).filter((value) => !!value && isString(value)));

      if (relatedValues.size && selectedReferenceTo && targetLookupField) {
        const relatedRecordsByRelatedField: Record<string, string[]> = {};
        // Get as many queries as required based on the size of the related fields
        const queries = getRelatedFieldsQueries(sObject, selectedReferenceTo, targetLookupField, Array.from(relatedValues));
        let currentQuery = 1;
        for (const query of queries) {
          try {
            emitQueryProgress(currentQuery, queries.length);
            currentQuery++;
            (await queryAll(org, query)).queryResults.records.forEach((record) => {
              relatedRecordsByRelatedField[record[targetLookupField]] = relatedRecordsByRelatedField[record[targetLookupField]] || [];
              relatedRecordsByRelatedField[record[targetLookupField]].push(record.Id);
            });
          } catch (ex) {
            queryErrors.push(ex.message);
          }
        }

        data.forEach((record, i) => {
          if (!targetField || isNil(record[targetField]) || record[targetField] === '') {
            return;
          }
          const relatedRecords = relatedRecordsByRelatedField[record[targetField]];
          /** NO RELATED RECORD FOUND */
          if (!relatedRecords) {
            if (lookupOptionNullIfNoMatch) {
              record[targetField] = apiMode === 'BATCH' ? null : SFDC_BULK_API_NULL_VALUE;
            } else {
              // No match, and not mark as null
              addError(
                i,
                record,
                `Related record not found for relationship "${fieldRelationshipName}" with a value of "${record[targetField]}".`
              );
            }
          } else if (relatedRecords.length > 1 && lookupOptionUseFirstMatch !== 'FIRST') {
            addError(
              i,
              record,
              `Found ${formatNumber(relatedRecords.length)} related records for relationship "${fieldRelationshipName}" with a value of "${
                record[targetField]
              }".`
            );
          } else {
            /** FOUND 1 MATCH, OR OPTION TO USE FIRST MATCH */
            record[targetField] = relatedRecords[0];
          }
        });
      }
      current++;
    }
    onProgress(100);
  }
  // remove failed records from dataset
  data = data.filter((_, i: number) => !errorsByRowIndex.has(i));

  return { data, errors: Array.from(errorsByRowIndex.values()), queryErrors };
}

function addErrors(errorsByRowIndex: Map<number, { row: number; record: any; errors: string[] }>) {
  return function addError(row: number, record: any, error: string) {
    if (!errorsByRowIndex.has(row)) {
      errorsByRowIndex.set(row, { row, record, errors: [] });
    }
    errorsByRowIndex.get(row)?.errors.push(error);
  };
}

/**
 * Get as many queries as required to fetch all the related values based on the length of the query
 *
 * @param baseObject Parent object, not the one being queried - used for additional filter special cases (e.x. RecordType)
 * @param relatedObject
 * @param relatedField
 * @param relatedValues
 * @returns
 */
function getRelatedFieldsQueries(baseObject: string, relatedObject: string, relatedField: string, relatedValues: string[]): string[] {
  let extraWhereClause = '';

  const baseQuery: Query = {
    sObject: relatedObject,
    fields: Array.from(new Set([getField('Id'), getField(relatedField)])),
  };

  let extraWhereClauseNew: WhereClauseWithoutOperator | WhereClauseWithRightCondition | undefined = undefined;
  const whereClause: WhereClauseWithoutOperator = {
    left: {
      field: relatedField,
      operator: 'IN',
      value: [],
      literalType: 'STRING',
    },
  };

  /** SPECIAL CASES */
  if (relatedObject.toLowerCase() === 'recordtype') {
    extraWhereClause = `SobjectType = '${baseObject}' AND `;
    extraWhereClauseNew = {
      left: {
        field: 'SobjectType',
        operator: '=',
        value: baseObject,
        literalType: 'STRING',
      },
    };
  }
  const QUERY_ITEM_BUFFER_LENGTH = 250;
  const BASE_QUERY_LENGTH =
    `SELECT Id, ${relatedField} FROM ${relatedObject} WHERE ${extraWhereClause}${relatedField} IN ('`.length + QUERY_ITEM_BUFFER_LENGTH;
  const MAX_QUERY_LENGTH = 9500; // somewhere just over 10K was giving an error

  const queries: string[] = [];
  let tempRelatedValues: string[] = [];
  let currLength = BASE_QUERY_LENGTH;
  relatedValues.forEach((value) => {
    tempRelatedValues.push(value.replaceAll(`'`, `\\'`).replaceAll(`\\n`, `\\\\n`));
    currLength += value.length + QUERY_ITEM_BUFFER_LENGTH;
    if (currLength >= MAX_QUERY_LENGTH) {
      const tempQuery = { ...baseQuery };
      if (extraWhereClauseNew) {
        tempQuery.where = {
          ...extraWhereClauseNew,
          operator: 'AND',
          right: { ...whereClause, left: { ...whereClause.left, value: tempRelatedValues } },
        };
      } else {
        tempQuery.where = { ...whereClause, left: { ...whereClause.left, value: tempRelatedValues } };
      }
      queries.push(composeQuery(tempQuery));
      tempRelatedValues = [];
      currLength = BASE_QUERY_LENGTH;
    }
  });
  if (tempRelatedValues.length) {
    const tempQuery = { ...baseQuery };
    if (extraWhereClauseNew) {
      tempQuery.where = {
        ...extraWhereClauseNew,
        operator: 'AND',
        right: { ...whereClause, left: { ...whereClause.left, value: tempRelatedValues } },
      };
    } else {
      tempQuery.where = { ...whereClause, left: { ...whereClause.left, value: tempRelatedValues } };
    }
    queries.push(composeQuery(tempQuery));
  }
  return queries;
}

/**
 * Used for loading custom metadata records
 */
export function convertCsvToCustomMetadata(
  selectedSObject: string,
  inputFileData: any[],
  fields: FieldWithRelatedEntities[],
  fieldMapping: FieldMapping,
  dateFormat?: string
): MapOfCustomMetadataRecord {
  const metadataByFullName: MapOfCustomMetadataRecord = {};

  selectedSObject = selectedSObject.replace('__mdt', '');
  const fieldMappingByTargetField: Record<string, FieldMappingItem> = Object.values(fieldMapping)
    .filter((field) => !!field.targetField)
    .reduce((output, field) => {
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      output[field.targetField!] = field;
      return output;
    }, {});

  inputFileData.forEach((row) => {
    if (!fieldMappingByTargetField.DeveloperName.csvField || !fieldMappingByTargetField.Label.csvField) {
      return;
    }

    let developerName: string | null = null;
    if (fieldMappingByTargetField.Label) {
      developerName =
        fieldMappingByTargetField.DeveloperName.type === 'STATIC'
          ? fieldMappingByTargetField.DeveloperName.staticValue
          : row[fieldMappingByTargetField.DeveloperName.csvField];
    }

    let label: string | null = null;
    if (fieldMappingByTargetField.Label) {
      label =
        fieldMappingByTargetField.Label.type === 'STATIC'
          ? fieldMappingByTargetField.Label.staticValue
          : row[fieldMappingByTargetField.Label.csvField];
    }

    const fullName = `${selectedSObject}.${developerName}`;
    const record: any = {
      DeveloperName: fullName,
      Label: label,
    };
    let metadata = `<?xml version="1.0" encoding="UTF-8"?>\n`;
    metadata += `<CustomMetadata xmlns="http://soap.sforce.com/2006/04/metadata" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema">\n`;
    if (label) {
      metadata += `\t<label>${sanitizeForXml(label)}</label>\n`;
    }
    metadata += `\t<protected>false</protected>\n`;
    fields
      .filter((field) => field.name.endsWith('__c'))
      .forEach((field) => {
        const fieldMappingItem = fieldMappingByTargetField[field.name];

        let fieldValue: string | null | boolean = null;

        if (fieldMappingItem && fieldMappingItem.type === 'STATIC') {
          fieldValue = fieldMappingItem.staticValue;
        } else if (fieldMappingItem) {
          fieldValue = row[fieldMappingItem.csvField];
        }

        // ensure field is in correct data type (mostly for dates)
        fieldValue = transformRecordForDataLoad(fieldValue, field.type, dateFormat);

        if (isString(fieldValue)) {
          fieldValue = sanitizeForXml(fieldValue);
        }
        // Custom metadata lookups always use name to relate records
        const soapType = field.soapType === 'tns:ID' ? 'xsd:string' : field.soapType;
        if (fieldMappingItem && !isNil(fieldValue) && fieldValue !== '') {
          metadata += `\t<values>\n`;
          metadata += `\t\t<field>${field.name}</field>\n`;
          metadata += `\t\t<value xsi:type="${soapType}">${fieldValue}</value>\n`;
          metadata += `\t</values>\n`;
          record[field.name] = fieldValue;
        } else {
          metadata += `\t<values>\n`;
          metadata += `\t\t<field>${field.name}</field>\n`;
          metadata += `\t\t<value xsi:nil="true"/>\n`;
          metadata += `\t</values>\n`;
          record[field.name] = null;
        }
      });
    metadata += `</CustomMetadata>`;

    metadataByFullName[fullName] = {
      record,
      fullName,
      metadata,
    };
  });
  logger.log({ metadataByFullName });
  return metadataByFullName;
}

export function prepareCustomMetadata(apiVersion, metadata: MapOfCustomMetadataRecord): Promise<ArrayBuffer> {
  const zip = new JSZip();
  zip.file(
    'package.xml',
    [
      `<?xml version="1.0" encoding="UTF-8"?>`,
      `<Package xmlns="http://soap.sforce.com/2006/04/metadata">`,
      `\t<types>`,
      ...Object.keys(metadata).map((fullName) => `\t\t<members>${fullName}</members>`),
      `\t\t<name>CustomMetadata</name>`,
      `\t</types>`,
      `\t<version>${apiVersion.replace('v', '')}</version>`,
      `</Package>`,
    ].join('\n')
  );
  Object.keys(metadata).forEach((fullName) => {
    zip.file(`customMetadata/${fullName}.md`, metadata[fullName].metadata);
  });
  return zip.generateAsync({ type: 'arraybuffer' });
}

export function checkForDuplicateRecords(
  fieldMapping: FieldMapping,
  inputFileData: any[],
  loadType: InsertUpdateUpsertDelete,
  isCustomMetadata = false,
  externalId?: string
): {
  duplicateKey: string;
  duplicateRecords: [string, any[]][];
} | null {
  let mappingItem: FieldMappingItem | undefined;
  if (isCustomMetadata) {
    mappingItem = Object.values(fieldMapping).find(({ targetField }) => targetField === 'DeveloperName');
  } else if (loadType === 'UPDATE' || loadType === 'DELETE') {
    mappingItem = Object.values(fieldMapping).find(({ targetField }) => targetField === 'Id');
  } else if (loadType === 'UPSERT' && externalId) {
    mappingItem = Object.values(fieldMapping).find(({ targetField }) => targetField === externalId);
  }

  if (mappingItem && mappingItem.targetField) {
    const rowsByMappedKeyField = groupBy(inputFileData, mappingItem.csvField || 'static');
    return {
      duplicateKey:
        mappingItem.csvField === mappingItem.targetField ? mappingItem.csvField : `${mappingItem.csvField} -> ${mappingItem.targetField}`,
      duplicateRecords: Object.entries(rowsByMappedKeyField).filter(([key, values]) => values.length > 1),
    };
  }
  return null;
}
