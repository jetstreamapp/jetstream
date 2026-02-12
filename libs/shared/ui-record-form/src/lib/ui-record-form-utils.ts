import { logger } from '@jetstream/shared/client-logger';
import { SFDC_BLANK_PICKLIST_VALUE } from '@jetstream/shared/constants';
import { genericRequest } from '@jetstream/shared/data';
import { sortQueryFields } from '@jetstream/shared/ui-utils';
import {
  CloneEditView,
  DescribeSObjectResult,
  Field,
  FieldType,
  PicklistFieldValues,
  PicklistFieldValuesResponse,
  SalesforceOrgUi,
  SalesforceRecord,
} from '@jetstream/types';
import isString from 'lodash/isString';
import {
  EditableFieldCheckbox,
  EditableFieldDate,
  EditableFieldDateTime,
  EditableFieldInput,
  EditableFieldPicklist,
  EditableFieldReference,
  EditableFieldTextarea,
  EditableFields,
} from './ui-record-form-types';

const IGNORED_FIELD_TYPES = new Set<FieldType>(['address', 'location', 'complexvalue']);

const CHECKBOX_FIELD_TYPES = new Set<FieldType>(['boolean']);
const DATE_FIELD_TYPES = new Set<FieldType>(['date']);
const DATE_TIME_FIELD_TYPES = new Set<FieldType>(['datetime']);
const TIME_FIELD_TYPES = new Set<FieldType>(['time']);
const PICKLIST_FIELD_TYPES = new Set<FieldType>(['combobox', 'picklist', 'multipicklist']);
const TEXTAREA_FIELD_TYPES = new Set<FieldType>(['textarea']);
const NUMBER_TYPES = new Set<FieldType>(['int', 'double', 'currency', 'percent']);

export const OWNER_AND_AUDIT_FIELDS = new Set<string>(['OwnerId', 'CreatedById', 'CreatedDate', 'LastModifiedById', 'LastModifiedDate']);

export function isInput(value: EditableFields): value is EditableFieldInput {
  return value && value.type === 'input';
}

export function isReference(value: EditableFields): value is EditableFieldReference {
  return value && value.type === 'reference';
}

export function isCheckbox(value: EditableFields): value is EditableFieldCheckbox {
  return value && value.type === 'checkbox';
}

export function isTextarea(value: EditableFields): value is EditableFieldTextarea {
  return value && value.type === 'textarea';
}

export function isDate(value: EditableFields): value is EditableFieldDate {
  return value && value.type === 'date';
}

export function isDateTime(value: EditableFields): value is EditableFieldDateTime {
  return value && value.type === 'datetime';
}

export function isTime(value: EditableFields): value is EditableFieldDate {
  return value && value.type === 'time';
}

export function isPicklist(value: EditableFields): value is EditableFieldPicklist {
  return value && value.type === 'picklist';
}

export function convertMetadataToEditableFields(
  fields: Field[],
  picklistValues: PicklistFieldValues,
  action: CloneEditView,
  record: SalesforceRecord,
  isCustomMetadata = false,
): EditableFields[] {
  return sortQueryFields(fields.filter((field) => !IGNORED_FIELD_TYPES.has(field.type))).map((field): EditableFields => {
    let readOnly = action === 'view';
    if (!readOnly && !isCustomMetadata) {
      readOnly = action === 'edit' ? !field.updateable : !field.createable;
    } else if (!readOnly && isCustomMetadata) {
      readOnly = !field.custom && field.name !== 'DeveloperName' && field.name !== 'Label';
    }
    const output: Partial<EditableFields> = {
      label: `${field.label} (${field.name})`,
      name: field.name,
      labelHelpText: field.inlineHelpText,
      inputHelpText: `${field.name}`,
      required: !field.nillable && field.type !== 'boolean',
      readOnly,
      metadata: field,
    };
    if (CHECKBOX_FIELD_TYPES.has(field.type)) {
      output.type = 'checkbox';
      (output as EditableFieldTextarea).isRichTextarea = field.extraTypeInfo === 'richtextarea';
    } else if (DATE_FIELD_TYPES.has(field.type)) {
      output.type = 'date';
    } else if (DATE_TIME_FIELD_TYPES.has(field.type)) {
      output.type = 'datetime';
    } else if (TIME_FIELD_TYPES.has(field.type)) {
      output.type = 'time';
    } else if (TEXTAREA_FIELD_TYPES.has(field.type)) {
      output.type = 'textarea';
      (output as EditableFieldTextarea).maxLength = field.length || undefined;
    } else if (PICKLIST_FIELD_TYPES.has(field.type)) {
      output.type = 'picklist';
      (output as EditableFieldPicklist).defaultValue = null;
      (output as EditableFieldPicklist).values = [];
      if (picklistValues[field.name]) {
        const picklist = picklistValues[field.name];
        const picklistOutput = output as EditableFieldPicklist;
        picklistOutput.defaultValue = picklist.defaultValue;
        picklistOutput.values = [
          // Empty value to allow clearing picklist
          {
            id: '',
            label: SFDC_BLANK_PICKLIST_VALUE,
            value: '',
            meta: { attributes: null, validFor: null, label: SFDC_BLANK_PICKLIST_VALUE, value: '' },
          },
        ].concat(
          picklist.values.map((item) => ({
            id: item.value,
            label: item.label || item.value,
            value: item.value,
            secondaryLabel: item.label !== item.value ? item.value : null,
            secondaryLabelOnNewLine: item.label !== item.value,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            meta: item as any,
          })),
        );
        // if record has an inactive value, this will show the field as dirty - so instead we add the inactive value to the list
        if (isString(record[field.name]) && !picklistOutput.values.find((item) => item.value === record[field.name])) {
          picklistOutput.values.push({
            id: record[field.name],
            label: `${record[field.name]} (Inactive)`,
            value: record[field.name],
            meta: {
              attributes: null,
              validFor: null,
              label: `${record[field.name]} (Inactive)`,
              value: record[field.name],
            },
          });
        }
      }
    } else if (field.type === 'reference') {
      output.type = 'reference';
      (output as EditableFieldReference).referenceTo = field.referenceTo || [];
    } else {
      output.type = 'input';
      if (NUMBER_TYPES.has(field.type)) {
        (output as EditableFieldInput).maxLength = undefined;
        (output as EditableFieldInput).inputMode = 'decimal';
        (output as EditableFieldInput).step = 'any';
      } else {
        // this will ensure that 0 length will not get specified
        (output as EditableFieldInput).maxLength = field.length || undefined;
      }
    }
    return output as EditableFields;
  });
}

// UI API is not supported, artificially build picklist values
export function mockPicklistValuesFromSobjectDescribe(sobjectMetadata: DescribeSObjectResult): PicklistFieldValues {
  return sobjectMetadata.fields
    .filter((field) => field.type === 'picklist' || field.type === 'multipicklist')
    .reduce((output: PicklistFieldValues, field) => {
      output[field.name] = {
        eTag: '',
        url: '',
        controllerValues: {},
        defaultValue: field.defaultValue,
        values:
          field?.picklistValues?.map(({ label, value, validFor }) => ({
            attributes: null,
            label: label || value,
            value,
            validFor: [],
          })) || [],
      };
      return output;
    }, {});
}

export async function getPicklistValuesForRecordAndRecordType({
  org,
  sobjectName,
  record,
  recordTypeId,
  sobjectMetadata,
  apiVersion,
}: {
  org: SalesforceOrgUi;
  sobjectName: string;
  /**
   * Optional existing record where the record type will attempted to be obtained from
   */
  record?: SalesforceRecord;
  /**
   * If provided, this will be used as the record type id instead of attempting to obtain it from the record or sobjectMetadata
   * This is useful if the user selected a record type to use
   */
  recordTypeId?: string;
  sobjectMetadata: DescribeSObjectResult;
  apiVersion: string;
}) {
  let picklistValues: PicklistFieldValues = {};

  recordTypeId = recordTypeId || record?.RecordTypeId;
  if (!recordTypeId) {
    const recordTypeInfos = sobjectMetadata.recordTypeInfos;
    if (recordTypeInfos.length === 1) {
      recordTypeId = recordTypeInfos[0].recordTypeId;
    } else {
      const foundRecordType = recordTypeInfos.find((recordType) => recordType.master);
      if (foundRecordType) {
        recordTypeId = foundRecordType.recordTypeId;
      }
    }
  }

  if (recordTypeId) {
    try {
      const results = await genericRequest<PicklistFieldValuesResponse>(org, {
        method: 'GET',
        url: `/services/data/${apiVersion}/ui-api/object-info/${sobjectName}/picklist-values/${recordTypeId}`,
        isTooling: false,
      });
      picklistValues = results.picklistFieldValues;
    } catch (ex) {
      logger.warn('[RECORD-UI][ERROR]', ex);
      if (ex?.message?.endsWith('not supported in UI API')) {
        // UI API is not supported, artificially build picklist values
        picklistValues = mockPicklistValuesFromSobjectDescribe(sobjectMetadata);
      } else {
        throw ex;
      }
    }
  } else {
    // UI API is not supported because there is no record type id, artificially build picklist values
    picklistValues = mockPicklistValuesFromSobjectDescribe(sobjectMetadata);
  }

  return picklistValues;
}
