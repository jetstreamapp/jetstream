import { describeGlobal, queryAll, queryWithCache } from '@jetstream/shared/data';
import { ListItem } from '@jetstream/types';
import isNil from 'lodash/isNil';
import {
  FieldDefinitions,
  FieldDefinitionType,
  FieldValueDependencies,
  FieldValues,
  GlobalPicklistRecord,
  SalesforceFieldType,
} from './create-fields-types';

export const fieldDefinitions: FieldDefinitions = {
  type: {
    label: 'Type',
    type: 'picklist',
    values: [
      { id: 'autoNumber', value: 'autoNumber', label: 'Auto-Number' },
      { id: 'checkbox', value: 'checkbox', label: 'Checkbox' },
      { id: 'currency', value: 'currency', label: 'Currency' },
      { id: 'date', value: 'date', label: 'Date' },
      { id: 'dateTime', value: 'dateTime', label: 'Date Time' },
      { id: 'email', value: 'email', label: 'Email' },
      { id: 'formula', value: 'formula', label: 'Formula' },
      { id: 'longTextArea', value: 'longTextArea', label: 'Text Area (Long)' },
      { id: 'lookup', value: 'lookup', label: 'Lookup' },
      { id: 'masterDetail', value: 'masterDetail', label: 'Master-Detail' },
      { id: 'multiselectPicklist', value: 'multiselectPicklist', label: 'Multi-select Picklist' },
      { id: 'number', value: 'number', label: 'Number' },
      { id: 'percent', value: 'percent', label: 'Percent' },
      { id: 'phone', value: 'phone', label: 'Phone' },
      { id: 'picklist', value: 'picklist', label: 'Picklist' },
      { id: 'text', value: 'text', label: 'Text' },
      { id: 'textArea', value: 'textArea', label: 'Text Area' },
      { id: 'time', value: 'time', label: 'Time' },
      { id: 'url', value: 'url', label: 'Url' },
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
    // TODO: pattern for max length
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
    type: 'text',
  },
  referenceTo: {
    label: 'Reference To',
    type: 'picklist',
    values: async (org) => {
      return (await describeGlobal(org)).data.sobjects
        .filter((obj) => !(obj as any).associateEntityType && obj.triggerable && obj.queryable)
        .map(({ name, label }) => ({ id: name, value: name, label: label, secondaryLabel: name }));
    },
    required: true,
  },
  deleteConstraint: {
    label: 'Delete Constraint',
    type: 'radio',
    values: [{ id: 'autoNumber', value: 'autoNumber', label: 'Auto-Number' }],
  },
  length: {
    label: 'Length',
    type: 'text', // number
    validate: (value: string) => {
      if (!value || !/^[0-9]+$/.test(value)) {
        return false;
      }
      const numValue = Number(value);
      return isFinite(numValue) && numValue > 0 && numValue <= 255;
    },
    required: true,
  },
  scale: {
    label: 'Scale', // TODO:
    type: 'text',
    validate: (value: string) => {
      if (!value || !/^[0-9]+$/.test(value)) {
        return false;
      }
      const numValue = Number(value);
      return isFinite(numValue) && numValue >= 0 && numValue <= 255;
    },
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
    values: async (org) => {
      const results = await queryWithCache<GlobalPicklistRecord>(
        org,
        `SELECT Id, DeveloperName, ManageableState, MasterLabel FROM GlobalValueSet WHERE ManageableState = 'unmanaged' ORDER BY DeveloperName ASC`,
        true
      );
      return results.data.queryResults.records.map((record) => ({
        id: record.DeveloperName,
        value: record.DeveloperName,
        label: record.MasterLabel,
        meta: record,
      }));
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
    validate: (value: string) => {
      if (!value || !/^[0-9]+$/.test(value)) {
        return false;
      }
      const numValue = Number(value);
      return isFinite(numValue) && numValue >= 0 && numValue <= 10;
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
    required: true,
  },
  displayFormat: {
    label: 'Display Format',
    type: 'text',
    required: true,
  },
  populateExistingRows: {
    label: 'Populate Existing Rows', // ?
    type: 'checkbox',
  },
  formula: {
    label: 'Formula',
    type: 'textarea',
    required: true,
    // TODO: would be cool to have syntax highlighting
  },
  formulaTreatBlanksAs: {
    label: 'Treat Blanks As',
    type: 'picklist',
    values: [
      { id: 'blanks', value: 'blanks', label: 'Blanks' },
      { id: 'zeros', value: 'zeros', label: 'Zeros' },
    ],
  },
  secondaryType: {
    label: 'Formula Type',
    type: 'picklist',
    values: [
      { id: 'checkbox', value: 'checkbox', label: 'Checkbox' },
      { id: 'currency', value: 'currency', label: 'Currency' },
      { id: 'date', value: 'date', label: 'Date' },
      { id: 'dateTime', value: 'dateTime', label: 'DateTime' },
      { id: 'number', value: 'number', label: 'Number' },
      { id: 'percent', value: 'percent', label: 'Percent' },
      { id: 'text', value: 'text', label: 'Text' },
      { id: 'time', value: 'time', label: 'Time' },
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
};

export const baseFields: FieldDefinitionType[] = ['type', 'label', 'fullName', 'inlineHelpText', 'description'];

// The thought here is to know which fields to show when
export const fieldTypeDependencies: FieldValueDependencies = {
  autoNumber: ['displayFormat', 'startingNumber'],
  formula: [
    'formula',
    'formulaTreatBlanksAs', // zeros | blanks
    // Checkbox, Currency, Date, DateTime, Number, Percent, Text, Time
    'secondaryType',
  ],
  checkbox: [
    'defaultValue', // checked / unchecked
  ],
  currency: [
    'defaultValue',
    'length',
    'scale', // AKA decimal places, precision
    'required',
  ],
  date: ['defaultValue', 'required'],
  dateTime: ['defaultValue', 'required'],
  time: [
    'defaultValue', // as time values
    'required',
  ],
  number: [
    'defaultValue',
    'length',
    'scale', // AKA decimal places, precision
    'required',
    'unique',
    'externalId',
  ],
  percent: [
    'defaultValue',
    'length',
    'scale', // AKA decimal places, precision
    'required',
  ],
  phone: ['defaultValue', 'required'],
  email: ['defaultValue', 'required', 'unique', 'externalId'],
  masterDetail: ['referenceTo', 'writeRequiresMasterRead', 'reparentableMasterDetail'],
  lookup: ['referenceTo', 'required'],
  picklist: [
    'defaultValue',
    // 'globalValueSet', // or valueSet
    // 'valueSet', // or globalValueSet
    'required',
    'firstAsDefault',
    'restricted',
  ],
  multiselectPicklist: [
    'defaultValue',
    // 'globalValueSet', // or valueSet
    // 'valueSet', // or globalValueSet
    'required',
    'firstAsDefault',
    'restricted',
    'visibleLines',
  ],
  url: ['defaultValue', 'required'],
  text: ['defaultValue', 'length', 'required', 'unique', 'externalId'],
  textArea: ['required'],
  longTextArea: ['length', 'visibleLines'],
};

export function getInitialValues(key: number): FieldValues {
  return {
    _key: key,
    _allValid: false,
    _picklistGlobalValueSet: true,
    type: {
      value: 'text',
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
      value: '',
      touched: false,
      isValid: true,
      errorMessage: null,
    },
    length: {
      value: 255,
      touched: false,
      isValid: true,
      errorMessage: null,
    },
    scale: {
      value: 0,
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
      value: 3,
      touched: false,
      isValid: true,
      errorMessage: null,
    },
    startingNumber: {
      value: 0,
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
      value: '', // TODO,
      touched: false,
      isValid: true,
      errorMessage: null,
    },
    secondaryType: {
      value: '',
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
  };
}

export function calculateFieldValidity(rows: FieldValues[]): { rows: FieldValues[]; allValid: boolean } {
  let allValid = true;
  const allOutputFieldValues: FieldValues[] = [];
  rows.forEach((fieldValues) => {
    let allRowValid = true;
    const outputFieldValues: FieldValues = { ...fieldValues };
    allOutputFieldValues.push(outputFieldValues);
    [...baseFields, ...fieldTypeDependencies[fieldValues.type.value as FieldDefinitionType]].forEach((fieldName: FieldDefinitionType) => {
      const currField = fieldValues[fieldName];
      const { isValid, value } = currField;
      const { validate, required } = fieldDefinitions[fieldName];
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
      } else if (!isNil(value) && typeof validate === 'function' && !validate(value)) {
        if (isValid) {
          outputFieldValues[fieldName] = {
            ...currField,
            isValid: false,
            errorMessage: 'Invalid format',
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
    if (fieldValues.type.value === 'picklist' || fieldValues.type.value === 'multiselectPicklist') {
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

export function preparePayload(sobjects: string[], rows: FieldValues[]) {
  return sobjects.map((sobject) => rows.map((row) => prepareFieldPayload(sobject, row)));
}

function prepareFieldPayload(sobject: string, fieldValues: FieldValues) {
  const fieldMetadata = [...baseFields, ...fieldTypeDependencies[fieldValues.type.value as FieldDefinitionType]].reduce(
    (output, field: FieldDefinitionType) => {
      if (!isNil(fieldValues[field].value) && fieldValues[field].value !== '') {
        output[field] = fieldValues[field].value;
      }
      return output;
    },
    {}
  );
  // prefix with object
  fieldMetadata.fullName = `${sobject}.${fieldMetadata.fullName}`;

  if (fieldValues.type.value === 'picklist' || fieldValues.type.value === 'multiselectPicklist') {
    // TODO:
    // restricted, firstAsDefault, sorted, data structure for valueSet (if exists)
    fieldMetadata.restricted = undefined;
    fieldMetadata.firstAsDefault = undefined;
    // fieldMetadata.sorted = undefined; // TODO:
    if (fieldValues._picklistGlobalValueSet) {
      fieldMetadata.globalValueSet = fieldValues.globalValueSet.value;
    } else {
      fieldMetadata.valueSet = {
        restricted: fieldValues.restricted.value,
        valueSetDefinition: {
          sorted: false, // TODO: need to add field for this
          // sorted: fieldValues.sorted.value,
          value: (fieldValues.valueSet.value as string).split('\n').map((value, i) => ({
            fullName: value,
            label: value,
            default: fieldValues.firstAsDefault.value && i === 0,
          })),
        },
      };
    }
  }
  return fieldMetadata;
}
