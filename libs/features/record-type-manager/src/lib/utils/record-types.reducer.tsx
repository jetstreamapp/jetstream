import { SFDC_BLANK_PICKLIST_VALUE } from '@jetstream/shared/constants';
import { Maybe } from '@jetstream/types';
import { RecordTypePicklistSummary, SobjectWithPicklistValues } from '../types/record-types.types';

type Action =
  | { type: 'INIT'; payload: Record<string, SobjectWithPicklistValues> }
  | { type: 'RESET' }
  | { type: 'CHANGE_FIELD'; payload: { sobjectName: string; fieldName: string; recordType: string; picklistValue: string; value: boolean } }
  | { type: 'TOGGLE_SELECT_ALL'; payload: { sobjectName: string; fieldName: string; recordType: string; value: boolean } }
  | { type: 'UPDATE_DEFAULT_VALUE'; payload: { sobjectName: string; fieldName: string; recordType: string; value: string } };

interface State {
  objectMetadata?: Record<string, SobjectWithPicklistValues>;
  allValues: RecordTypePicklistSummary[];
  modifiedValues: RecordTypePicklistSummary[];
  errorsByField?: Maybe<Record<string, Record<string, string[]>>>;
  errorsByRecordType?: Maybe<Record<string, Record<string, string[]>>>;
}

export type RecordTypeReducerFn = (state: State, action: Action) => State;

function updateObjectMetadataStateOnChange(
  objectMetadata: Record<string, SobjectWithPicklistValues>,
  action:
    | {
        payload: { sobjectName: string; fieldName: string; recordType: string; value: boolean };
        isSelectAll: true;
      }
    | {
        payload: { sobjectName: string; fieldName: string; recordType: string; picklistValue: string; value: boolean };
        isSelectAll: false;
      },
) {
  const { fieldName, recordType, sobjectName, value } = action.payload;
  const allPicklistValues = objectMetadata[sobjectName].picklistValues[fieldName].values.map((entry) => entry.value);
  const picklistValues = objectMetadata[sobjectName].recordTypeValues[recordType].picklistValues[fieldName];
  let currentValues = new Set<string>();
  const dirtyValues = new Set<string>();
  if (action.isSelectAll) {
    if (value) {
      currentValues = new Set(allPicklistValues);
    }
  } else {
    currentValues = new Set(picklistValues.currentValues);
    if (value) {
      currentValues.add(action.payload.picklistValue);
    } else {
      currentValues.delete(action.payload.picklistValue);
    }
  }
  allPicklistValues.forEach((value) => {
    if (
      (picklistValues.initialValues.has(value) && !currentValues.has(value)) ||
      (!picklistValues.initialValues.has(value) && currentValues.has(value))
    ) {
      dirtyValues.add(value);
    }
  });
  return {
    ...objectMetadata,
    [sobjectName]: {
      ...objectMetadata[sobjectName],
      recordTypeValues: {
        ...objectMetadata[sobjectName].recordTypeValues,
        [recordType]: {
          ...objectMetadata[sobjectName].recordTypeValues[recordType],
          picklistValues: {
            ...objectMetadata[sobjectName].recordTypeValues[recordType].picklistValues,
            [fieldName]: {
              ...picklistValues,
              currentValues,
              dirtyValues,
            },
          },
        },
      },
    },
  };
}

function addErrors(
  currentValues: Set<string>,
  modifiedValue: RecordTypePicklistSummary,
  sobjectName: string,
  fieldName: string,
  recordType: string,
  defaultValue: string,
  hasPriorError: boolean,
  errorsByField: Record<string, Record<string, string[]>>,
  errorsByRecordType: Record<string, Record<string, string[]>>,
) {
  let hasError = hasPriorError;
  if (currentValues.size === 0) {
    modifiedValue.isValid = false;
    modifiedValue.errorMessage = 'At least one value must be selected';
    errorsByField[sobjectName] = errorsByField[sobjectName] || {};
    errorsByField[sobjectName][fieldName] = errorsByField[sobjectName][fieldName] || [];
    errorsByField[sobjectName][fieldName].push(modifiedValue.errorMessage);

    errorsByRecordType[sobjectName] = errorsByRecordType[sobjectName] || {};
    errorsByRecordType[sobjectName][recordType] = errorsByRecordType[sobjectName][recordType] || [];
    errorsByRecordType[sobjectName][recordType].push(modifiedValue.errorMessage);

    hasError = true;
  }
  if (defaultValue !== SFDC_BLANK_PICKLIST_VALUE && !currentValues.has(defaultValue)) {
    modifiedValue.isValid = false;
    modifiedValue.errorMessage = `The default value must be selected`;
    errorsByField[sobjectName] = errorsByField[sobjectName] || {};
    errorsByField[sobjectName][fieldName] = errorsByField[sobjectName][fieldName] || [];
    errorsByField[sobjectName][fieldName].push(modifiedValue.errorMessage);

    errorsByRecordType[sobjectName] = errorsByRecordType[sobjectName] || {};
    errorsByRecordType[sobjectName][recordType] = errorsByRecordType[sobjectName][recordType] || [];
    errorsByRecordType[sobjectName][recordType].push(modifiedValue.errorMessage);
    hasError = true;
  }
  return hasError;
}

function getModifiedPickLists(objectMetadata: Record<string, SobjectWithPicklistValues>) {
  const modifiedValues: RecordTypePicklistSummary[] = [];
  const allValues: RecordTypePicklistSummary[] = [];
  const errorsByField: Maybe<Record<string, Record<string, string[]>>> = {};
  const errorsByRecordType: Maybe<Record<string, Record<string, string[]>>> = {};
  let hasError = false;
  Object.keys(objectMetadata).forEach((sobjectName) => {
    Object.keys(objectMetadata[sobjectName].recordTypeValues).forEach((recordType) => {
      Object.keys(objectMetadata[sobjectName].recordTypeValues[recordType].picklistValues).forEach((fieldName) => {
        const { currentValues, defaultValue, dirtyValues, initialDefaultValue } =
          objectMetadata[sobjectName].recordTypeValues[recordType].picklistValues[fieldName];
        const modifiedValue: RecordTypePicklistSummary = {
          sobject: sobjectName,
          sobjectLabel: objectMetadata[sobjectName].recordTypeValues[recordType].sobjectLabel,
          field: fieldName,
          recordType,
          recordTypeFullName: objectMetadata[sobjectName].recordTypeValues[recordType].fullName,
          recordTypeLabel: objectMetadata[sobjectName].recordTypeValues[recordType].recordTypeLabel,
          fieldLabel: objectMetadata[sobjectName].picklistValues[fieldName].fieldLabel,
          values: currentValues,
          defaultValue: defaultValue === SFDC_BLANK_PICKLIST_VALUE ? null : defaultValue,
          isValid: true,
          errorMessage: null,
        };
        allValues.push(modifiedValue);
        if (dirtyValues.size || defaultValue !== initialDefaultValue) {
          modifiedValues.push(modifiedValue);
          // Only calculate errors if the field is dirty - sometimes SFDC has invalid configuration to start with
          // and we don't want to show errors for that - missing fields in deployment are ignored
          hasError = addErrors(
            currentValues,
            modifiedValue,
            sobjectName,
            fieldName,
            recordType,
            defaultValue,
            hasError,
            errorsByField,
            errorsByRecordType,
          );
        }
      });
    });
  });
  if (hasError) {
    return { modifiedValues, allValues, errorsByField, errorsByRecordType };
  }
  return { modifiedValues, allValues, errorsByField: null, errorsByRecordType: null };
}

export function recordTypeReducer(state: State, action: Action): State {
  switch (action.type) {
    case 'INIT':
      return {
        ...state,
        objectMetadata: action.payload,
        modifiedValues: [],
      };
    case 'RESET':
      return {
        allValues: [],
        modifiedValues: [],
      };
    case 'CHANGE_FIELD': {
      const { fieldName, recordType, sobjectName, picklistValue, value } = action.payload;
      if (!state.objectMetadata) {
        return state;
      }
      const allPicklistValues = state.objectMetadata[sobjectName].picklistValues[fieldName].values.map((entry) => entry.value);
      const picklistValues = state.objectMetadata[sobjectName].recordTypeValues[recordType].picklistValues[fieldName];
      const currentValues = new Set(picklistValues.currentValues);
      const dirtyValues = new Set<string>();
      if (value) {
        currentValues.add(picklistValue);
      } else {
        currentValues.delete(picklistValue);
      }
      allPicklistValues.forEach((value) => {
        if (
          (picklistValues.initialValues.has(value) && !currentValues.has(value)) ||
          (!picklistValues.initialValues.has(value) && currentValues.has(value))
        ) {
          dirtyValues.add(value);
        }
      });
      const objectMetadata = updateObjectMetadataStateOnChange(state.objectMetadata, { payload: action.payload, isSelectAll: false });
      return {
        ...state,
        objectMetadata,
        ...getModifiedPickLists(objectMetadata),
      };
    }
    case 'TOGGLE_SELECT_ALL': {
      const { fieldName, recordType, sobjectName, value } = action.payload;
      if (!state.objectMetadata) {
        return state;
      }
      const allPicklistValues = state.objectMetadata[sobjectName].picklistValues[fieldName].values.map((entry) => entry.value);
      const picklistValues = state.objectMetadata[sobjectName].recordTypeValues[recordType].picklistValues[fieldName];
      let currentValues = new Set<string>();
      const dirtyValues = new Set<string>();
      if (value) {
        currentValues = new Set(allPicklistValues);
      }
      allPicklistValues.forEach((value) => {
        if (
          (picklistValues.initialValues.has(value) && !currentValues.has(value)) ||
          (!picklistValues.initialValues.has(value) && currentValues.has(value))
        ) {
          dirtyValues.add(value);
        }
      });
      const objectMetadata = updateObjectMetadataStateOnChange(state.objectMetadata, { payload: action.payload, isSelectAll: true });
      return {
        ...state,
        objectMetadata,
        ...getModifiedPickLists(objectMetadata),
      };
    }
    case 'UPDATE_DEFAULT_VALUE': {
      const { fieldName, recordType, sobjectName, value } = action.payload;
      if (!state.objectMetadata) {
        return state;
      }
      const objectMetadata = {
        ...state.objectMetadata,
        [sobjectName]: {
          ...state.objectMetadata[sobjectName],
          recordTypeValues: {
            ...state.objectMetadata[sobjectName].recordTypeValues,
            [recordType]: {
              ...state.objectMetadata[sobjectName].recordTypeValues[recordType],
              picklistValues: {
                ...state.objectMetadata[sobjectName].recordTypeValues[recordType].picklistValues,
                [fieldName]: {
                  ...state.objectMetadata[sobjectName].recordTypeValues[recordType].picklistValues[fieldName],
                  defaultValue: value,
                },
              },
            },
          },
        },
      };
      return {
        ...state,
        objectMetadata,
        ...getModifiedPickLists(objectMetadata),
      };
    }
    default:
      throw new Error('Invalid action');
  }
}
