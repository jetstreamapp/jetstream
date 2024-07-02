/* eslint-disable @typescript-eslint/no-explicit-any */
import { logger } from '@jetstream/shared/client-logger';
import { describeGlobal, genericRequest, queryAllFromList, queryWithCache } from '@jetstream/shared/data';
import { REGEX, ensureBoolean, splitArrayToMaxSize } from '@jetstream/shared/utils';
import {
  CompositeResponse,
  DescribeGlobalSObjectResult,
  GlobalValueSetRequest,
  Maybe,
  PermissionSetNoProfileRecord,
  PermissionSetWithProfileRecord,
  SalesforceOrgUi,
  ToolingApiResponse,
} from '@jetstream/types';
import { composeQuery, getField } from '@jetstreamapp/soql-parser-js';
import isBoolean from 'lodash/isBoolean';
import isNil from 'lodash/isNil';
import isString from 'lodash/isString';
import {
  EntityParticleRecord,
  FieldDefinitionMetadata,
  FieldDefinitionType,
  FieldDefinitions,
  FieldPermissionRecord,
  FieldValueDependencies,
  FieldValues,
  GlobalPicklistRecord,
  LayoutRecord,
  LayoutResult,
  SalesforceFieldType,
} from './create-fields-types';
import { CreateFieldsResults } from './useCreateFields';

const READ_ONLY_TYPES = new Set<SalesforceFieldType>(['AutoNumber', 'Formula']);
const NUMBER_TYPES = new Set<SalesforceFieldType>(['Number', 'Currency', 'Percent']);
const MAX_OBJ_IN_QUERY = 100;

export function filterCreateFieldsSobjects(sobject: DescribeGlobalSObjectResult | null) {
  return (
    !!sobject &&
    sobject.createable &&
    sobject.updateable &&
    !sobject.name.endsWith('__History') &&
    !sobject.name.endsWith('__Tag') &&
    !sobject.name.endsWith('__Share')
  );
}

export function ensureValidType(type: string): SalesforceFieldType {
  if (fieldTypeDependencies[type]) {
    return type as SalesforceFieldType;
  }
  return (
    (type && (Object.keys(fieldTypeDependencies).find((key) => type?.toLowerCase() === key?.toLowerCase()) as SalesforceFieldType)) ||
    'Text'
  );
}

export function ensureValidSecondaryType(type: string): string {
  const validOptions = new Set(['Checkbox', 'Currency', 'Date', 'DateTime', 'Number', 'Percent', 'Text', 'Time']);
  if (validOptions.has(type)) {
    return type as SalesforceFieldType;
  }
  return 'Text';
}

export const fieldDefinitions: FieldDefinitions = {
  type: {
    label: 'Type',
    type: 'picklist',
    values: [
      { id: 'AutoNumber', value: 'AutoNumber', label: 'Auto-Number' },
      { id: 'Checkbox', value: 'Checkbox', label: 'Checkbox' },
      { id: 'Currency', value: 'Currency', label: 'Currency' },
      { id: 'Date', value: 'Date', label: 'Date' },
      { id: 'DateTime', value: 'DateTime', label: 'Date Time' },
      { id: 'Email', value: 'Email', label: 'Email' },
      { id: 'Formula', value: 'Formula', label: 'Formula' },
      { id: 'Lookup', value: 'Lookup', label: 'Lookup' },
      { id: 'MasterDetail', value: 'MasterDetail', label: 'Master-Detail' },
      { id: 'MultiselectPicklist', value: 'MultiselectPicklist', label: 'Multi-select Picklist' },
      { id: 'Number', value: 'Number', label: 'Number' },
      { id: 'Percent', value: 'Percent', label: 'Percent' },
      { id: 'Phone', value: 'Phone', label: 'Phone' },
      { id: 'Picklist', value: 'Picklist', label: 'Picklist' },
      { id: 'Text', value: 'Text', label: 'Text' },
      { id: 'TextArea', value: 'TextArea', label: 'Text Area' },
      { id: 'LongTextArea', value: 'LongTextArea', label: 'Text Area (Long)' },
      { id: 'Html', value: 'Html', label: 'Text Area (Rich)' },
      { id: 'Time', value: 'Time', label: 'Time' },
      { id: 'Url', value: 'Url', label: 'Url' },
    ],
    required: true,
  },
  label: {
    label: 'Label',
    type: 'text',
    required: true,
  },
  fullName: {
    label: 'Name',
    type: 'text',
    required: true,
    labelHelp: 'API name of field, cannot include more than one underscore. Do not add __c at the end.',
    validate: (value: string) => {
      if (!value || !/(^[a-zA-Z]+$)|(^[a-zA-Z]+[0-9a-zA-Z_]*[0-9a-zA-Z]$)/.test(value) || value.includes('__') || value.length > 40) {
        return false;
      }
      return true;
    },
    invalidErrorMessage: 'Must be a valid API name',
  },
  inlineHelpText: {
    label: 'Help Text',
    type: 'text',
  },
  description: {
    label: 'Description',
    type: 'textarea',
  },
  defaultValue: {
    label: 'Default Value',
    type: (type: SalesforceFieldType) => (type === 'Checkbox' ? 'checkbox' : 'text'),
  },
  referenceTo: {
    label: 'Reference To',
    type: 'picklist',
    allowRefreshValues: true,
    values: async (org, skipRequestCache) => {
      return (await describeGlobal(org, false, skipRequestCache)).data.sobjects
        .filter((obj) => !(obj as any).associateEntityType && obj.triggerable && obj.queryable)
        .map(({ name, label }) => ({ id: name, value: name, label: label, secondaryLabel: name, secondaryLabelOnNewLine: true }));
    },
    required: true,
  },
  deleteConstraint: {
    label: 'Related Record Deletion',
    type: 'picklist',
    values: [
      { id: 'SetNull', value: 'SetNull', label: 'Clear Value' },
      { id: 'Restrict', value: 'Restrict', label: 'Prevent Deletion' },
      { id: 'Cascade', value: 'Cascade', label: 'Delete Lookup Record' },
    ],
    validate: (value: string, fieldValues: FieldValues) => {
      const required = Boolean(fieldValues.required.value);
      if (required && value === 'SetNull') {
        return false;
      }
      return true;
    },
    invalidErrorMessage: 'Clear Value is not a valid option for required fields',
    required: true,
  },
  length: {
    label: 'Length',
    type: 'text', // number
    helpText: (type: SalesforceFieldType) => {
      if (type === 'LongTextArea' || type === 'Html') {
        return 'Max value 131072';
      }
    },
    validate: (value: string, fieldValues: FieldValues) => {
      if (!value || !/^[0-9]+$/.test(value)) {
        return false;
      }
      const numValue = Number(value);
      const type = fieldValues.type.value;
      if (type === 'LongTextArea' || type === 'Html') {
        return isFinite(numValue) && numValue > 255 && numValue <= 131072;
      }
      return isFinite(numValue) && numValue > 0 && numValue <= 255;
    },
    invalidErrorMessage: (type) => {
      if (type === 'LongTextArea') {
        return 'Must be between 255 and 131,072';
      }
      return 'Must be between 0 and 255';
    },
    required: true,
  },
  precision: {
    label: 'Length',
    type: 'text', // number
    labelHelp: 'Number of digits to the left of the decimal point',
    validate: (value: string) => {
      if (!value || !/^[0-9]+$/.test(value)) {
        return false;
      }
      const numValue = Number(value);
      return isFinite(numValue) && numValue >= 1 && numValue <= 18;
    },
    invalidErrorMessage: 'Must be between 0 and 18',
    required: true,
  },
  scale: {
    label: 'Decimal Places',
    type: 'text',
    labelHelp: 'Number of digits to the right of the decimal point',
    validate: (value: string) => {
      if (!value || !/^[0-9]+$/.test(value)) {
        return false;
      }
      const numValue = Number(value);
      return isFinite(numValue) && numValue >= 0 && numValue <= 17;
    },
    invalidErrorMessage: 'Must be between 0 and 17',
    required: true,
  },
  required: {
    label: 'Required',
    type: 'checkbox',
  },
  unique: {
    label: 'Unique',
    type: 'checkbox',
  },
  externalId: {
    label: 'External Id',
    type: 'checkbox',
  },
  valueSet: {
    label: 'Picklist Values',
    type: 'textarea',
    required: true,
  },
  globalValueSet: {
    label: 'Global Picklist',
    type: 'picklist',
    required: true,
    allowRefreshValues: true,
    values: async (org, skipRequestCache) => {
      const results = await queryWithCache<GlobalPicklistRecord>(
        org,
        `SELECT Id, DeveloperName, NamespacePrefix, MasterLabel FROM GlobalValueSet ORDER BY DeveloperName ASC`,
        true,
        skipRequestCache || false
      );
      return results.data.queryResults.records.map((record) => {
        const value = `${record.NamespacePrefix ? `${record.NamespacePrefix}__` : ''}${record.DeveloperName}`;
        return {
          id: value,
          value,
          label: `${record.MasterLabel}${record.NamespacePrefix ? ` (${record.NamespacePrefix})` : ''}`,
          meta: record,
        };
      });
    },
  },
  firstAsDefault: {
    label: 'First is Default',
    type: 'checkbox',
    disabled: (fieldValues: FieldValues) => fieldValues._picklistGlobalValueSet,
  },
  restricted: {
    label: 'Restricted',
    type: 'checkbox',
    disabled: (fieldValues: FieldValues) => fieldValues._picklistGlobalValueSet,
  },
  visibleLines: {
    label: 'Visible Lines',
    type: 'text',
    required: true,
    helpText: (type: SalesforceFieldType) => {
      if (type === 'LongTextArea') {
        return '2 through 50';
      } else if (type === 'Html') {
        return '10 through 50';
      }
    },
    validate: (value: string, fieldValues: FieldValues) => {
      if (!value || !/^[0-9]+$/.test(value)) {
        return false;
      }
      const numValue = Number(value);
      const type = fieldValues.type.value;
      if (type === 'LongTextArea') {
        return isFinite(numValue) && numValue >= 2 && numValue <= 50;
      } else if (type === 'Html') {
        return isFinite(numValue) && numValue >= 10 && numValue <= 50;
      }
      return isFinite(numValue) && numValue >= 0 && numValue <= 10;
    },
    invalidErrorMessage: (type) => {
      if (type === 'LongTextArea') {
        return 'Must be between 2 and 50';
      } else if (type === 'Html') {
        return 'Must be between 10 and 50';
      }
      return 'Must be between 0 and 10';
    },
  },
  startingNumber: {
    label: 'Starting Number',
    type: 'text',
    validate: (value: string) => {
      if (!value || !/^[0-9]+$/.test(value)) {
        return false;
      }
      const numValue = Number(value);
      return isFinite(numValue) && numValue >= 0;
    },
    invalidErrorMessage: 'Must be greater than 0',
    required: true,
  },
  displayFormat: {
    label: 'Display Format',
    type: 'text',
    required: true,
  },
  populateExistingRows: {
    label: 'Generate for existing records',
    type: 'checkbox',
  },
  formula: {
    label: 'Formula',
    type: 'textarea-with-formula',
    required: true,
  },
  formulaTreatBlanksAs: {
    label: 'Treat Blanks As',
    type: 'picklist',
    values: [
      { id: 'Blanks', value: 'Blanks', label: 'Blanks' },
      { id: 'BlankAsZero', value: 'BlankAsZero', label: 'Zeros' },
    ],
  },
  secondaryType: {
    label: 'Formula Type',
    type: 'picklist',
    values: [
      { id: 'Checkbox', value: 'Checkbox', label: 'Checkbox' },
      { id: 'Currency', value: 'Currency', label: 'Currency' },
      { id: 'Date', value: 'Date', label: 'Date' },
      { id: 'DateTime', value: 'DateTime', label: 'DateTime' },
      { id: 'Number', value: 'Number', label: 'Number' },
      { id: 'Percent', value: 'Percent', label: 'Percent' },
      { id: 'Text', value: 'Text', label: 'Text' },
      { id: 'Time', value: 'Time', label: 'Time' },
    ],
    required: true,
  },
  writeRequiresMasterRead: {
    label: 'Sharing Settings',
    type: 'picklist',
    values: [
      { id: 'true', value: 'true', label: 'Read Only' },
      { id: 'false', value: 'false', label: 'Read/Write' },
    ],
    labelHelp: 'This determines the default permissions given to child records',
  },
  reparentableMasterDetail: {
    label: 'Allow Reparenting',
    type: 'checkbox',
  },
  relationshipName: {
    label: 'Child Relationship Name',
    type: 'text',
    labelHelp: 'This is relationship name for subqueries.',
    required: true,
    validate: (value: string) => {
      if (!value || !/(^[a-zA-Z]+$)|(^[a-zA-Z]+[0-9a-zA-Z_]*[0-9a-zA-Z]$)/.test(value) || value.includes('__') || value.length > 40) {
        return false;
      }
      return true;
    },
    invalidErrorMessage: 'Must be a valid API name',
  },
};

export const baseFields: FieldDefinitionType[] = ['type', 'label', 'fullName', 'inlineHelpText', 'description'];
export const allFields: FieldDefinitionType[] = [
  'type',
  'label',
  'fullName',
  'inlineHelpText',
  'description',
  'length',
  'defaultValue',
  'precision',
  'scale',
  'required',
  'unique',
  'externalId',
  'formula',
  'formulaTreatBlanksAs',
  'secondaryType',
  'displayFormat',
  'populateExistingRows',
  'startingNumber',
  'valueSet',
  'globalValueSet',
  'referenceTo',
  'deleteConstraint',
  'writeRequiresMasterRead',
  'reparentableMasterDetail',
  'firstAsDefault',
  'restricted',
  'visibleLines',
  'relationshipName',
];

// The thought here is to know which fields to show when
export const fieldTypeDependencies: FieldValueDependencies = {
  AutoNumber: ['displayFormat', 'startingNumber', 'populateExistingRows'],
  Formula: [
    'formula',
    'formulaTreatBlanksAs', // zeros | blanks
    // Checkbox, Currency, Date, DateTime, Number, Percent, Text, Time
    'secondaryType',
  ],
  Checkbox: [
    'defaultValue', // checked / unchecked
  ],
  Currency: [
    'precision',
    'scale', // AKA decimal places, precision
    'defaultValue',
    'required',
  ],
  Date: ['defaultValue', 'required'],
  DateTime: ['defaultValue', 'required'],
  Time: [
    'defaultValue', // as time values
    'required',
  ],
  Number: [
    'precision',
    'scale', // AKA decimal places, precision
    'defaultValue',
    'required',
    'unique',
    'externalId',
  ],
  Percent: [
    'precision',
    'scale', // AKA decimal places, precision
    'defaultValue',
    'required',
  ],
  Phone: ['defaultValue', 'required'],
  Email: ['defaultValue', 'required', 'unique', 'externalId'],
  MasterDetail: ['referenceTo', 'relationshipName', 'writeRequiresMasterRead', 'reparentableMasterDetail'],
  Lookup: ['referenceTo', 'relationshipName', 'deleteConstraint', 'required'],
  Picklist: ['defaultValue', 'required', 'firstAsDefault', 'restricted'],
  MultiselectPicklist: ['defaultValue', 'required', 'firstAsDefault', 'restricted', 'visibleLines'],
  Url: ['defaultValue', 'required'],
  Text: ['defaultValue', 'length', 'required', 'unique', 'externalId'],
  TextArea: ['required'],
  LongTextArea: ['length', 'visibleLines'],
  Html: ['length', 'visibleLines'],
};

export function getAdditionalFieldDependencies(fieldValues: FieldValues): FieldDefinitionType[] {
  if (fieldValues.type.value === 'Formula' && NUMBER_TYPES.has(fieldValues.secondaryType?.value as SalesforceFieldType)) {
    return ['precision', 'scale'];
  }
  return [];
}

// Some dependencies are missing in normal array but are required for exporting
export const fieldTypeDependenciesExport: FieldValueDependencies = {
  ...fieldTypeDependencies,
  Picklist: [...fieldTypeDependencies.Picklist, 'valueSet', 'globalValueSet'],
  MultiselectPicklist: [...fieldTypeDependencies.MultiselectPicklist, 'valueSet', 'globalValueSet'],
};

export function getInitialValues(key: number): FieldValues {
  return {
    _key: key,
    _allValid: false,
    _picklistGlobalValueSet: true,
    type: {
      value: 'Text',
      touched: false,
      isValid: true,
      errorMessage: null,
    },
    label: {
      value: '',
      touched: false,
      isValid: true,
      errorMessage: null,
    },
    fullName: {
      value: '',
      touched: false,
      isValid: true,
      errorMessage: null,
    },
    inlineHelpText: {
      value: '',
      touched: false,
      isValid: true,
      errorMessage: null,
    },
    description: {
      value: '',
      touched: false,
      isValid: true,
      errorMessage: null,
    },
    defaultValue: {
      value: '',
      touched: false,
      isValid: true,
      errorMessage: null,
    },
    referenceTo: {
      value: '',
      touched: false,
      isValid: true,
      errorMessage: null,
    },
    deleteConstraint: {
      value: 'SetNull',
      touched: false,
      isValid: true,
      errorMessage: null,
    },
    length: {
      value: '255',
      touched: false,
      isValid: true,
      errorMessage: null,
    },
    precision: {
      value: '18',
      touched: false,
      isValid: true,
      errorMessage: null,
    },
    scale: {
      value: '0',
      touched: false,
      isValid: true,
      errorMessage: null,
    },
    required: {
      value: false,
      touched: false,
      isValid: true,
      errorMessage: null,
    },
    unique: {
      value: false,
      touched: false,
      isValid: true,
      errorMessage: null,
    },
    externalId: {
      value: false,
      touched: false,
      isValid: true,
      errorMessage: null,
    },
    valueSet: {
      value: '',
      touched: false,
      isValid: true,
      errorMessage: null,
    },
    globalValueSet: {
      value: '',
      touched: false,
      isValid: true,
      errorMessage: null,
    },
    firstAsDefault: {
      value: false,
      touched: false,
      isValid: true,
      errorMessage: null,
    },
    restricted: {
      value: false,
      touched: false,
      isValid: true,
      errorMessage: null,
    },
    visibleLines: {
      value: '3',
      touched: false,
      isValid: true,
      errorMessage: null,
    },
    startingNumber: {
      value: '0',
      touched: false,
      isValid: true,
      errorMessage: null,
    },
    displayFormat: {
      value: '',
      touched: false,
      isValid: true,
      errorMessage: null,
    },
    populateExistingRows: {
      value: false,
      touched: false,
      isValid: true,
      errorMessage: null,
    },
    formula: {
      value: '',
      touched: false,
      isValid: true,
      errorMessage: null,
    },
    formulaTreatBlanksAs: {
      value: 'Blanks',
      touched: false,
      isValid: true,
      errorMessage: null,
    },
    secondaryType: {
      value: 'Text',
      touched: false,
      isValid: true,
      errorMessage: null,
    },
    writeRequiresMasterRead: {
      value: 'true',
      touched: false,
      isValid: true,
      errorMessage: null,
    },
    reparentableMasterDetail: {
      value: false,
      touched: false,
      isValid: true,
      errorMessage: null,
    },
    relationshipName: {
      value: '',
      touched: false,
      isValid: true,
      errorMessage: null,
    },
  };
}

export function calculateFieldValidity(rows: FieldValues[]): { rows: FieldValues[]; allValid: boolean } {
  let allValid = true;
  const allOutputFieldValues: FieldValues[] = [];
  rows.forEach((fieldValues) => {
    let allRowValid = true;
    const outputFieldValues: FieldValues = { ...fieldValues };
    allOutputFieldValues.push(outputFieldValues);

    // ensure that default value is set correctly based on type of field
    if (fieldValues.type.value === 'Checkbox' && isString(fieldValues.defaultValue.value)) {
      outputFieldValues.defaultValue = {
        ...outputFieldValues.defaultValue,
        value: ensureBoolean(fieldValues.defaultValue.value),
      };
    } else if (fieldValues.type.value !== 'Checkbox' && isBoolean(fieldValues.defaultValue.value)) {
      outputFieldValues.defaultValue = {
        ...outputFieldValues.defaultValue,
        value: '',
      };
    }
    [
      ...baseFields,
      ...fieldTypeDependencies[fieldValues.type.value as FieldDefinitionType],
      ...getAdditionalFieldDependencies(fieldValues),
    ].forEach((fieldName: FieldDefinitionType) => {
      const currField = fieldValues[fieldName];
      if (!currField) {
        return;
      }
      const { isValid, value } = currField;
      const { validate, invalidErrorMessage, required } = fieldDefinitions[fieldName];

      if ((isNil(value) || value === '') && required) {
        if (isValid) {
          outputFieldValues[fieldName] = {
            ...currField,
            isValid: false,
            errorMessage: 'This field is required',
          };
        } else {
          outputFieldValues[fieldName] = currField;
        }
      } else if (!isNil(value) && typeof validate === 'function' && !validate(value, fieldValues)) {
        if (isValid) {
          const errorMessage =
            typeof invalidErrorMessage === 'function'
              ? invalidErrorMessage(fieldValues.type.value as SalesforceFieldType)
              : invalidErrorMessage;

          outputFieldValues[fieldName] = {
            ...currField,
            isValid: false,
            errorMessage: errorMessage || 'Invalid format',
          };
        } else {
          outputFieldValues[fieldName] = currField;
        }
      } else if (!isValid) {
        outputFieldValues[fieldName] = {
          ...currField,
          isValid: true,
          errorMessage: null,
        };
      } else {
        outputFieldValues[fieldName] = currField;
      }
      if (!outputFieldValues[fieldName].isValid) {
        allRowValid = false;
        allValid = false;
      }
    });

    // Number validation
    if (
      (NUMBER_TYPES.has(fieldValues.type.value as SalesforceFieldType) ||
        (fieldValues.type.value === 'Formula' && NUMBER_TYPES.has(fieldValues.secondaryType.value as SalesforceFieldType))) &&
      outputFieldValues.precision.isValid &&
      outputFieldValues.scale.isValid &&
      Number(fieldValues.precision.value) + Number(fieldValues.scale.value) > 18
    ) {
      outputFieldValues.precision = {
        ...outputFieldValues.precision,
        isValid: false,
        touched: true,
        errorMessage: 'The sum of length and decimal places must not exceed 18.',
      };
      outputFieldValues.scale = {
        ...outputFieldValues.scale,
        isValid: false,
        touched: true,
        errorMessage: 'The sum of length and decimal places must not exceed 18.',
      };
      allRowValid = false;
      allValid = false;
    }
    // Picklist validation
    if (fieldValues.type.value === 'Picklist' || fieldValues.type.value === 'MultiselectPicklist') {
      const isValid = validatePicklist(fieldValues, outputFieldValues);
      if (!isValid) {
        allRowValid = false;
        allValid = false;
      }
    }
    outputFieldValues._allValid = allRowValid;
  });
  return { rows: allOutputFieldValues, allValid };
}

export function generateApiNameFromLabel(value: string) {
  let fullNameValue = value;
  if (fullNameValue) {
    fullNameValue = fullNameValue
      .replace(REGEX.NOT_ALPHANUMERIC_OR_UNDERSCORE, '_')
      .replace(REGEX.STARTS_WITH_UNDERSCORE, '')
      .replace(REGEX.CONSECUTIVE_UNDERSCORES, '_')
      .replace(REGEX.ENDS_WITH_NON_ALPHANUMERIC, '');
    if (REGEX.STARTS_WITH_NUMBER.test(fullNameValue)) {
      fullNameValue = `X${fullNameValue}`;
    }
    if (fullNameValue.length > 40) {
      fullNameValue = fullNameValue.substring(0, 40);
    }
  }
  return fullNameValue;
}

/**
 * Picklists have dependencies on either global or standard picklists
 * so this is an edge case handled separately
 *
 * @param fieldValues
 * @param outputFieldValues
 * @returns
 */
function validatePicklist(fieldValues: FieldValues, outputFieldValues: FieldValues): boolean {
  let allValid = true;
  if (fieldValues._picklistGlobalValueSet) {
    const isValid = !!fieldValues.globalValueSet.value;
    outputFieldValues.globalValueSet = {
      ...fieldValues.globalValueSet,
      isValid,
      errorMessage: isValid ? null : 'This field is required',
    };
    outputFieldValues.valueSet = {
      ...fieldValues.valueSet,
      value: '',
      isValid: true,
      errorMessage: null,
    };
    allValid = isValid;
  } else {
    const isValid = !!fieldValues.valueSet.value;
    outputFieldValues.globalValueSet = {
      ...fieldValues.globalValueSet,
      isValid: true,
      errorMessage: null,
    };
    outputFieldValues.valueSet = {
      ...fieldValues.valueSet,
      isValid,
      errorMessage: isValid ? null : 'This field is required',
    };
    allValid = isValid;
  }
  return allValid;
}

export function isFieldValues(input: FieldValues | FieldDefinitionMetadata): input is FieldValues {
  return !isNil((input as any)?._key);
}

export function preparePayload(sobjects: string[], rows: FieldValues[], orgNamespace?: Maybe<string>): FieldDefinitionMetadata[] {
  return rows.flatMap((row) => sobjects.map((sobject) => prepareFieldPayload(sobject, row, orgNamespace)));
}

function prepareFieldPayload(sobject: string, fieldValues: FieldValues, orgNamespace?: Maybe<string>): FieldDefinitionMetadata {
  const fieldMetadata: FieldDefinitionMetadata = [
    ...baseFields,
    ...fieldTypeDependencies[fieldValues.type.value as FieldDefinitionType],
    ...getAdditionalFieldDependencies(fieldValues),
  ].reduce((output: FieldDefinitionMetadata, field: FieldDefinitionType) => {
    if (!isNil(fieldValues[field].value) && fieldValues[field].value !== '') {
      output[field] = fieldValues[field].value;
    }
    return output;
  }, {});
  // prefix with object
  const fieldApiName = orgNamespace ? `${orgNamespace}__${fieldMetadata.fullName}__c` : `${fieldMetadata.fullName}__c`;
  fieldMetadata.fullName = `${sobject}.${fieldApiName}`;

  if (fieldMetadata.scale && fieldMetadata.precision) {
    const scale = Number(fieldMetadata.scale);
    const precision = Number(fieldMetadata.precision);
    if (!Number.isNaN(scale) && !Number.isNaN(precision)) {
      fieldMetadata.scale = scale;
      fieldMetadata.precision = scale + precision;
    }
  }

  if (fieldValues.type.value === 'Formula') {
    fieldMetadata.type = fieldValues.secondaryType.value;
    fieldMetadata.secondaryType = undefined;

    if (fieldValues.formulaTreatBlanksAs.value === 'Blanks') {
      fieldMetadata.formulaTreatBlanksAs = undefined;
    }
  }

  if (fieldValues.type.value === 'Checkbox') {
    fieldMetadata.defaultValue = fieldMetadata.defaultValue ?? false;
  }

  if (fieldValues.type.value === 'Picklist' || fieldValues.type.value === 'MultiselectPicklist') {
    // restricted, firstAsDefault, sorted, data structure for valueSet (if exists)
    fieldMetadata.restricted = undefined;
    fieldMetadata.firstAsDefault = undefined;
    // fieldMetadata.sorted = undefined; // TODO: do we need to set this one?
    if (fieldValues._picklistGlobalValueSet) {
      fieldMetadata.valueSet = {
        valueSetName: fieldValues.globalValueSet.value,
      };
    } else {
      fieldMetadata.valueSet = {
        restricted: fieldValues.restricted.value,
        valueSetDefinition: {
          sorted: false,
          // sorted: fieldValues.sorted.value,
          value:
            (fieldValues.valueSet.value as string)?.split('\n').map((value, i) => ({
              fullName: value,
              label: value,
              default: fieldValues.firstAsDefault.value && i === 0,
            })) || [],
        },
      };
    }
  }

  return fieldMetadata;
}

export async function createGlobalPicklist(org: SalesforceOrgUi, globalValueSet: GlobalValueSetRequest, apiVersion: string) {
  const response = await genericRequest<ToolingApiResponse>(org, {
    isTooling: true,
    method: 'POST',
    url: `/services/data/${apiVersion}/tooling/sobjects/GlobalValueSet`,
    body: globalValueSet,
  });
  return response;
}

/**
 * Get composite requests for fields
 * Existing field definitions are queried to determine if any fields exist, in which case will be upserted
 *
 * @param org
 * @param sobjects
 * @param apiVersion
 * @param allFields
 * @returns
 */
export async function prepareCreateFieldsCompositeRequests(
  org: SalesforceOrgUi,
  sobjects: string[],
  apiVersion: string,
  allFields: CreateFieldsResults[]
) {
  const existingFields = await queryAllFromList<EntityParticleRecord>(org, getQueriesForAllCustomFieldsForObjects(sobjects), true);

  const existingFieldsByFullName = existingFields.queryResults.records.reduce((output: Record<string, string>, record) => {
    const [_, fieldId] = record.DurableId.split('.');
    output[`${record.EntityDefinition.QualifiedApiName}.${record.QualifiedApiName}`.toLowerCase()] = fieldId;
    return output;
  }, {});

  const createFieldsPayloads = splitArrayToMaxSize(allFields, 25).map((fields) => ({
    allOrNone: false,
    compositeRequest: fields.map(({ field, key, deployResult }) => {
      let url = `/services/data/${apiVersion}/tooling/sobjects/CustomField`;
      let method = 'POST';
      // Perform upsert if field was previously deployed or already exists
      if (isString(deployResult) && deployResult.length === 18) {
        url += `/${deployResult}`;
        method = 'PATCH';
      } else if (existingFieldsByFullName[field.fullName.toLowerCase()]) {
        url += `/${existingFieldsByFullName[field.fullName.toLowerCase()]}`;
        method = 'PATCH';
      }
      return {
        method,
        url,
        body: {
          FullName: field.fullName,
          Metadata: { ...field, fullName: undefined },
        },
        referenceId: key,
      };
    }),
  }));

  return createFieldsPayloads;
}

export function getFieldPermissionRecords(fullName: string, type: SalesforceFieldType, profiles: string[], permissionSets: string[]) {
  const [SobjectType] = fullName.split('.');
  return [...profiles, ...permissionSets].map((ParentId) => ({
    attributes: {
      type: 'FieldPermissions',
    },
    Field: fullName,
    ParentId,
    PermissionsEdit: READ_ONLY_TYPES.has(type) ? false : true,
    PermissionsRead: true,
    SobjectType,
  }));
}

export function addFieldToLayout(fields: FieldDefinitionMetadata[], layout: LayoutRecord): boolean {
  // need to see if field should be readonly on the layout
  const fieldsByApiName = fields.reduce((output, field) => {
    const fieldApiName = field.fullName.split('.')[1];
    if (fieldApiName && !output[fieldApiName]) {
      output[fieldApiName] = field;
    }
    return output;
  }, {});

  const layoutSectionsJson = JSON.stringify(layout.Metadata.layoutSections);
  // ensure field does not already exist on layout
  const fieldsToAdd = Object.keys(fieldsByApiName).filter((field) => !layoutSectionsJson.includes(`"field":"${field}"`));
  fieldsToAdd.forEach((field) => {
    let behavior: 'Edit' | 'Readonly' | 'Required' = 'Edit';
    if (READ_ONLY_TYPES.has(fieldsByApiName[field].type) || fieldsByApiName[field].formula) {
      behavior = 'Readonly';
    } else if (fieldsByApiName[field].required) {
      behavior = 'Required';
    }
    layout.Metadata.layoutSections[0].layoutColumns[0].layoutItems.push({
      field,
      behavior,
      analyticsCloudComponent: null,
      canvas: null,
      component: null,
      customLink: null,
      emptySpace: null,
      height: null,
      page: null,
      reportChartComponent: null,
      scontrol: null,
      showLabel: null,
      showScrollbars: null,
      width: null,
    });
    // Random SFDC error for this ENUM
    // Cannot deserialize instance of complexvalue from VALUE_STRING value Record or request may be missing a required field at [line:1, column:35066]
    if (isString(layout.Metadata?.platformActionList?.actionListContext)) {
      layout.Metadata.platformActionList = undefined;
    }
    // Cannot deserialize instance of complexvalue from VALUE_STRING value DEFAULT or request may be missing a required field at [line:843, column:31]
    if (isString(layout.Metadata?.summaryLayout?.summaryLayoutStyle)) {
      layout.Metadata.summaryLayout = undefined;
    }
    // Mass quick actions don’t support Activity. Use a valid entity.
    // Activity related lists throw an error if quick actions are provided, even though the provided array is empty
    if (Array.isArray(layout.Metadata?.relatedLists)) {
      layout.Metadata.relatedLists.forEach((relatedList) => {
        if (Array.isArray(relatedList.quickActions) && relatedList.quickActions.length === 0) {
          relatedList.quickActions = null;
        }
      });
    }
  });
  return fieldsToAdd.length > 0;
}

export async function deployLayouts(
  apiVersion: string,
  selectedOrg: SalesforceOrgUi,
  layoutIds: string[],
  fields: FieldDefinitionMetadata[]
) {
  /** FETCH LAYOUTS */
  const layoutsWithFullMetadata = splitArrayToMaxSize(Object.values(layoutIds), 25).map((_layoutIds) => ({
    allOrNone: false,
    compositeRequest: _layoutIds.map((layoutId) => ({
      method: 'GET',
      url: `/services/data/${apiVersion}/tooling/sobjects/Layout/${layoutId}?fields=Id,FullName,Metadata`,
      referenceId: layoutId,
    })),
  }));

  const layoutsToUpdate: LayoutRecord[] = [];
  const updatedLayouts: Record<string, LayoutResult> = {};
  const errors: string[] = [];
  layoutIds.forEach((id) => {
    updatedLayouts[id] = { id, deployed: false };
  });

  // Fetch full layout metadata
  for (const compositeRequest of layoutsWithFullMetadata) {
    const response = await genericRequest<CompositeResponse<LayoutRecord | { errorCode: string; message: string }[]>>(selectedOrg, {
      isTooling: true,
      method: 'POST',
      url: `/services/data/${apiVersion}/tooling/composite`,
      body: compositeRequest,
    });

    response.compositeResponse.forEach(({ body, httpStatusCode, referenceId }) => {
      const layout = updatedLayouts[referenceId];
      if (httpStatusCode < 200 || httpStatusCode > 299) {
        layout && (layout.error = 'Unable to obtain layout metadata');
        if (Array.isArray(body)) {
          // ERROR getting full layout metadata
          if (Array.isArray(body)) {
            const error = body.map(({ message }) => message).join(' ');
            errors.push(error);
            layout && (layout.error = error);
          }
        }
      } else {
        layout && (layout.metadata = body as LayoutRecord);
        const didAddFields = addFieldToLayout(fields, body as LayoutRecord);
        if (didAddFields) {
          layoutsToUpdate.push(body as LayoutRecord);
        }
      }
    });
  }

  /** UPDATE LAYOUTS */
  const layoutsToUpdateWithFullMetadata = splitArrayToMaxSize(layoutsToUpdate, 25).map((_layoutsToUpdate) => ({
    allOrNone: false,
    compositeRequest: _layoutsToUpdate.map((layout) => ({
      method: 'PATCH',
      url: `/services/data/${apiVersion}/tooling/sobjects/Layout/${layout.Id}`,
      referenceId: layout.Id,
      body: { ...layout, Id: null },
    })),
  }));

  for (const compositeRequest of layoutsToUpdateWithFullMetadata) {
    const response = await genericRequest<CompositeResponse<null | { errorCode: string; message: string }[]>>(selectedOrg, {
      isTooling: true,
      method: 'POST',
      url: `/services/data/${apiVersion}/tooling/composite`,
      body: compositeRequest,
    });
    response.compositeResponse.forEach(({ body, httpStatusCode, referenceId }) => {
      const layout = updatedLayouts[referenceId];
      if (httpStatusCode < 200 || httpStatusCode > 299) {
        layout && (layout.error = 'Unknown error updating layout');
        if (Array.isArray(body)) {
          const error = body.map(({ message }) => message).join(' ');
          errors.push(error);
          layout && (layout.error = error);
        }
      } else {
        layout && (layout.deployed = true);
      }
    });
  }

  return {
    updatedLayouts: Object.values(updatedLayouts),
    errors,
  };
}

export function getRowsForExport(fieldValues: FieldValues[]) {
  const BASE_FIELDS = new Set(baseFields);
  return fieldValues.map((row) =>
    allFields.reduce((output, field) => {
      if (BASE_FIELDS.has(field) || fieldTypeDependenciesExport[row.type.value as SalesforceFieldType].includes(field)) {
        if (field === 'globalValueSet' && row._picklistGlobalValueSet) {
          output[field] = row[field].value;
        } else if (field === 'valueSet' && !row._picklistGlobalValueSet) {
          output[field] = row[field].value;
        } else if (field !== 'globalValueSet' && field !== 'valueSet') {
          output[field] = row[field].value;
        }
      }
      return output;
    }, {})
  );
}

export function prepareDownloadResultsFile(
  fieldResults: CreateFieldsResults[],
  fieldValues: FieldValues[],
  profilesAndPermSetsById: Record<string, PermissionSetWithProfileRecord | PermissionSetNoProfileRecord>
) {
  let permissionRecords: FieldPermissionRecord[] = [];
  const resultsWorksheet = fieldResults.map(
    ({ label, state, deployResult, flsResult, flsErrors, flsRecords, layoutErrors, updatedLayouts }) => {
      permissionRecords = permissionRecords.concat(flsRecords || []);
      let _flsResult = 'N/A';
      if (flsResult && flsResult.length) {
        _flsResult = flsResult?.every?.((result) => result.success) ? 'SUCCESS' : 'PARTIAL SUCCESS';
      }
      return {
        Field: label,
        'Field Status': state,
        'Field Id': isString(deployResult) ? deployResult : '',
        'FLS Result': _flsResult,
        'FLS Errors': flsErrors?.join?.('\n') || '',
        'Page Layouts Updated':
          updatedLayouts
            ?.map((layout) => (layout.metadata ? `${decodeURIComponent(layout.metadata.FullName)} (${layout.id})` : layout.id))
            ?.join('\n') || '',
        'Page Layouts Errors': layoutErrors?.join('\n') || '',
      };
    }
  );
  return {
    worksheetData: {
      Results: resultsWorksheet,
      'Import Template': getRowsForExport(fieldValues),
      'Permission Records': permissionRecords.filter(Boolean).map((record) => {
        const profileOrPermSet = profilesAndPermSetsById[record.ParentId];
        if (profileOrPermSet) {
          const Name = profileOrPermSet.IsOwnedByProfile ? profileOrPermSet.Profile.Name : profileOrPermSet.Name;
          return {
            ...record,
            Name,
          };
        }
        return record;
      }),
    },
    headerData: {
      Results: ['Field', 'Field Status', 'Field Id', 'FLS Result', 'FLS Errors', 'Page Layouts Updated', 'Page Layouts Errors'],
      'Import Template': allFields,
      'Permission Records': ['Success', 'Id', 'Errors', 'SobjectType', 'Field', 'Name', 'ParentId', 'PermissionsEdit', 'PermissionsRead'],
    },
  };
}

export function getQueriesForAllCustomFieldsForObjects(allSobjects: string[]): string[] {
  const queries = splitArrayToMaxSize(allSobjects, MAX_OBJ_IN_QUERY).map((sobjects) => {
    return composeQuery({
      fields: [getField('EntityDefinition.QualifiedApiName'), getField('DurableId'), getField('QualifiedApiName')],
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
            operator: 'LIKE',
            value: '%__c',
            literalType: 'STRING',
          },
        },
      },
      orderBy: [
        {
          // EntityDefinition.QualifiedApiName is not supported in order by
          field: 'EntityDefinitionId',
          order: 'ASC',
        },
        {
          field: 'QualifiedApiName',
          order: 'ASC',
        },
      ],
    });
  });
  logger.log('getQueriesForAllCustomFieldsForObjects()', queries);
  return queries;
}

export function getSecondaryTypeFromType(value: string) {
  // TODO:
  // Checkbox
  // Currency
  // Date
  // DateTime
  // Number
  // Percent
  // Text
  // Time
  switch (value) {
    case 'boolean':
      return 'Checkbox';
    case 'string':
    default:
      return 'Text';
  }
}
