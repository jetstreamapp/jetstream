import { logger } from '@jetstream/shared/client-logger';
import { ANALYTICS_KEYS } from '@jetstream/shared/constants';
import { describeSObject, query } from '@jetstream/shared/data';
import {
  getFlattenedListItemsById,
  getListItemsFromFieldWithRelatedItems,
  sortQueryFields,
  unFlattenedListItemsById,
  useNonInitialEffect,
  useRollbar,
} from '@jetstream/shared/ui-utils';
import { getErrorMessage, getErrorMessageAndStackObj } from '@jetstream/shared/utils';
import { DescribeSObjectResult, Field, ListItem, Maybe, SalesforceOrgUi } from '@jetstream/types';
import {
  DEFAULT_FIELD_CONFIGURATION,
  MetadataRow,
  TransformationCriteria,
  TransformationOption,
  TransformationOptions,
  getValidationSoqlQuery,
  isValidRow,
  useAmplitude,
} from '@jetstream/ui-core';
import { useCallback, useEffect, useReducer, useRef } from 'react';
import { useRecoilState, useRecoilValue } from 'recoil';
import * as fromMassUpdateState from '../mass-update-records.state';

type Action =
  | { type: 'RESET' }
  | { type: 'CLEAR_DEPLOYMENT_RESULTS' }
  | { type: 'OBJECTS_SELECTED'; payload: { sobjects: string[] } }
  | { type: 'OBJECTS_REMOVED'; payload: { sobjects: string[] } }
  | { type: 'FIELD_SELECTION_CHANGED'; payload: { sobject: string; selectedField: string; configIndex: number } }
  | { type: 'COMMON_FIELD_SELECTED'; payload: { selectedField: string; configIndex: number } }
  | { type: 'COMMON_OPTION_SELECTED'; payload: { option: TransformationOption; staticValue?: string; configIndex: number } }
  | { type: 'COMMON_CRITERIA_SELECTED'; payload: { criteria: TransformationCriteria; whereClause?: string; configIndex: number } }
  | {
      type: 'TRANSFORMATION_OPTION_CHANGED';
      payload: { sobject: string; transformationOptions: TransformationOptions; configIndex: number };
    }
  | { type: 'ADD_FIELD'; payload: { sobject: string } }
  | { type: 'REMOVE_FIELD'; payload: { sobject: string; configIndex: number } }
  | { type: 'METADATA_LOADED'; payload: { sobject: string; metadata: DescribeSObjectResult } }
  | { type: 'CHILD_FIELDS_LOADED'; payload: { sobject: string; parentId: string; childFields: ListItem[] } }
  | { type: 'METADATA_ERROR'; payload: { sobject: string; error: string } }
  | { type: 'START_VALIDATION'; payload: { sobject: string } }
  | { type: 'FINISH_VALIDATION'; payload: { sobject: string; impactedRecords: Maybe<number>; error: Maybe<string> } };

interface State {
  rowsMap: Map<string, MetadataRow>;
  allRowsValid: boolean;
  loading: boolean;
}

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'RESET': {
      return {
        rowsMap: new Map(),
        allRowsValid: false,
        loading: false,
      };
    }
    case 'CLEAR_DEPLOYMENT_RESULTS': {
      const rowsMap = new Map(state.rowsMap);
      rowsMap.forEach((row) => {
        rowsMap.set(row.sobject, {
          ...row,
          deployResults: {
            status: 'Not Started',
            done: false,
            processingErrors: [],
            records: [],
            batchIdToIndex: {},
          },
        });
      });
      return { ...state, rowsMap };
    }
    case 'OBJECTS_SELECTED': {
      const { sobjects } = action.payload;
      const rowsMap = new Map(state.rowsMap);
      sobjects.forEach((sobject) => {
        rowsMap.set(sobject, {
          isValid: false,
          sobject,
          loading: true,
          fields: [],
          valueFields: [],
          deployResults: {
            status: 'Not Started',
            done: false,
            processingErrors: [],
            records: [],
            batchIdToIndex: {},
          },
          configuration: [{ ...DEFAULT_FIELD_CONFIGURATION }],
        });
      });
      return { ...state, rowsMap, allRowsValid: Array.from(rowsMap.values()).every((row) => row.isValid) };
    }
    case 'OBJECTS_REMOVED': {
      const { sobjects } = action.payload;
      const rowsMap = new Map(state.rowsMap);
      sobjects.forEach((sobject) => {
        rowsMap.delete(sobject);
      });
      return {
        ...state,
        rowsMap,
        allRowsValid: Array.from(rowsMap.values()).every((row) => row.isValid),
      };
    }
    case 'FIELD_SELECTION_CHANGED': {
      const { sobject, selectedField, configIndex } = action.payload;
      const rowsMap = new Map(state.rowsMap);
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      const prevRow = state.rowsMap.get(sobject)!;
      const row: MetadataRow = { ...prevRow, configuration: [...prevRow.configuration] };
      row.configuration[configIndex] = {
        ...row.configuration[configIndex],
        selectedField,
        transformationOptions: { ...row.configuration[configIndex].transformationOptions, staticValue: '' },
      };
      row.isValid = isValidRow(row);
      rowsMap.set(sobject, row);
      return { ...state, rowsMap, allRowsValid: Array.from(rowsMap.values()).every((row) => row.isValid) };
    }
    case 'COMMON_FIELD_SELECTED': {
      const { selectedField, configIndex } = action.payload;
      const rowsMap = new Map(state.rowsMap);
      rowsMap.forEach((prevRow, key) => {
        const row: MetadataRow = { ...prevRow, configuration: [...prevRow.configuration] };
        row.configuration[configIndex] = { ...row.configuration[configIndex], selectedField };
        row.isValid = isValidRow(row);
        rowsMap.set(key, row);
      });
      return { ...state, rowsMap, allRowsValid: Array.from(rowsMap.values()).every((row) => row.isValid) };
    }
    case 'COMMON_OPTION_SELECTED': {
      const { option, staticValue, configIndex } = action.payload;
      const rowsMap = new Map(state.rowsMap);
      rowsMap.forEach((prevRow, key) => {
        const row: MetadataRow = { ...prevRow, configuration: [...prevRow.configuration] };
        row.configuration[configIndex] = {
          ...row.configuration[configIndex],
          transformationOptions: {
            ...row.configuration[configIndex].transformationOptions,
            option,
            staticValue:
              option === 'staticValue' && staticValue ? staticValue : prevRow.configuration[configIndex].transformationOptions.staticValue,
          },
        };
        row.isValid = isValidRow(row);
        rowsMap.set(key, row);
      });
      return { ...state, rowsMap, allRowsValid: Array.from(rowsMap.values()).every((row) => row.isValid) };
    }
    case 'COMMON_CRITERIA_SELECTED': {
      const { criteria, whereClause, configIndex } = action.payload;
      const rowsMap = new Map(state.rowsMap);
      rowsMap.forEach((prevRow, key) => {
        const row: MetadataRow = { ...prevRow, configuration: [...prevRow.configuration], validationResults: null };
        row.configuration[configIndex] = {
          ...row.configuration[configIndex],
          transformationOptions: {
            ...row.configuration[configIndex].transformationOptions,
            criteria,
          },
        };
        if (criteria === 'custom' && whereClause) {
          row.configuration[configIndex].transformationOptions.whereClause = whereClause;
        }
        row.isValid = isValidRow(row);
        rowsMap.set(key, row);
      });
      return { ...state, rowsMap, allRowsValid: Array.from(rowsMap.values()).every((row) => row.isValid) };
    }
    case 'TRANSFORMATION_OPTION_CHANGED': {
      const { sobject, transformationOptions, configIndex } = action.payload;
      const rowsMap = new Map(state.rowsMap);
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      const prevRow = state.rowsMap.get(sobject)!;
      const row: MetadataRow = { ...prevRow, validationResults: null, configuration: [...prevRow.configuration] };
      row.configuration[configIndex] = { ...row.configuration[configIndex], transformationOptions };
      row.isValid = isValidRow(row);
      rowsMap.set(sobject, row);
      return { ...state, rowsMap, allRowsValid: Array.from(rowsMap.values()).every((row) => row.isValid) };
    }
    case 'ADD_FIELD': {
      const { sobject } = action.payload;
      const rowsMap = new Map(state.rowsMap);
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      const prevRow = state.rowsMap.get(sobject)!;
      const row: MetadataRow = { ...prevRow, configuration: [...prevRow.configuration] };
      row.configuration.push({ ...DEFAULT_FIELD_CONFIGURATION });
      row.isValid = false;
      rowsMap.set(sobject, row);
      return { ...state, rowsMap, allRowsValid: false };
    }
    case 'REMOVE_FIELD': {
      const { sobject, configIndex } = action.payload;
      const rowsMap = new Map(state.rowsMap);
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      const prevRow = state.rowsMap.get(sobject)!;
      const row: MetadataRow = { ...prevRow, configuration: [...prevRow.configuration] };
      row.configuration.splice(configIndex, 1);
      row.isValid = isValidRow(row);
      rowsMap.set(sobject, row);
      return { ...state, rowsMap, allRowsValid: Array.from(rowsMap.values()).every((row) => row.isValid) };
    }
    case 'METADATA_LOADED': {
      const { sobject, metadata } = action.payload;
      const rowsMap = new Map(state.rowsMap);
      const allFieldMetadata = sortQueryFields(metadata.fields);
      const existingRow = state.rowsMap.get(sobject);
      // the item could have been removed during the fetch process
      if (!existingRow) {
        return state;
      }
      rowsMap.set(sobject, {
        ...existingRow,
        loading: false,
        metadata,
        fields: allFieldMetadata
          .filter((field) => field.updateable)
          .map((field) => ({
            id: field.name,
            value: field.name,
            label: field.label,
            secondaryLabel: field.name,
            secondaryLabelOnNewLine: true,
            tertiaryLabel: field.type,
            meta: field,
          })),
        valueFields: getListItemsFromFieldWithRelatedItems(allFieldMetadata),
      });
      return {
        ...state,
        rowsMap,
        allRowsValid: Array.from(rowsMap.values()).every((row) => row.isValid),
      };
    }
    case 'CHILD_FIELDS_LOADED': {
      const { sobject, parentId, childFields } = action.payload;
      const rowsMap = new Map(state.rowsMap);
      const existingRow = state.rowsMap.get(sobject);
      if (!existingRow) {
        return state;
      }

      // Add child items to the parent
      let allItems = getFlattenedListItemsById(existingRow.valueFields);
      allItems = { ...allItems, [parentId]: { ...allItems[parentId], childItems: childFields } };
      const valueFields = unFlattenedListItemsById(allItems);

      rowsMap.set(sobject, {
        ...existingRow,
        valueFields,
      });

      return { ...state, rowsMap, allRowsValid: Array.from(rowsMap.values()).every((row) => row.isValid) };
    }
    case 'START_VALIDATION': {
      const { sobject } = action.payload;
      const rowsMap = new Map(state.rowsMap);
      rowsMap.set(sobject, {
        ...state.rowsMap.get(sobject),
        loading: true,
        validationResults: { error: null, isValid: false },
      } as MetadataRow);
      return { ...state, rowsMap, allRowsValid: Array.from(rowsMap.values()).every((row) => row.isValid) };
    }
    case 'FINISH_VALIDATION': {
      const { sobject, impactedRecords, error } = action.payload;
      const rowsMap = new Map(state.rowsMap);
      const row = {
        ...state.rowsMap.get(sobject),
        loading: false,
        validationResults: { impactedRecords, error: error, isValid: !error },
      } as MetadataRow;
      row.isValid = isValidRow(row);
      rowsMap.set(sobject, row);
      return { ...state, rowsMap, allRowsValid: Array.from(rowsMap.values()).every((row) => row.isValid) };
    }
    case 'METADATA_ERROR': {
      const { sobject, error } = action.payload;
      const rowsMap = new Map(state.rowsMap);
      rowsMap.set(sobject, { ...state.rowsMap.get(sobject), loadError: error } as MetadataRow);
      return { ...state, rowsMap, allRowsValid: Array.from(rowsMap.values()).every((row) => row.isValid) };
    }
  }
}

export function useMassUpdateFieldItems(org: SalesforceOrgUi, selectedSObjects: string[]) {
  const isMounted = useRef(true);
  const { trackEvent } = useAmplitude();
  const rollbar = useRollbar();
  const currentSelectedObjects = useRef(new Set<string>());

  const rows = useRecoilValue(fromMassUpdateState.rowsState);
  const [_rowsMap, setRowsMap] = useRecoilState(fromMassUpdateState.rowsMapState);

  const [{ allRowsValid, rowsMap }, dispatch] = useReducer(reducer, {
    rowsMap: _rowsMap,
    allRowsValid: Array.from(_rowsMap.values()).every((row) => row.isValid),
    loading: false,
  });

  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);

  useEffect(() => {
    setRowsMap(rowsMap);
  }, [rowsMap, setRowsMap]);

  useNonInitialEffect(() => {
    dispatch({ type: 'RESET' });
  }, [org]);

  const reset = useCallback(() => {
    dispatch({ type: 'RESET' });
  }, []);

  const clearResults = useCallback(() => {
    dispatch({ type: 'CLEAR_DEPLOYMENT_RESULTS' });
  }, []);

  /**
   * Fetch metadata for all selected objects
   * If the user changes selection while this is running, then the results will be ignored
   * or skipped depending on the timing of the change
   */
  const getObjectsMetadata = useCallback(
    async (sobjects: string[]) => {
      dispatch({ type: 'OBJECTS_SELECTED', payload: { sobjects } });

      for (const sobject of sobjects) {
        if (!isMounted.current) {
          break;
        } else if (!currentSelectedObjects.current.has(sobject)) {
          logger.log(`Skipping metadata fetch for ${sobject}, no longer selected.`);
          break;
        }
        try {
          const metadata = await describeSObject(org, sobject);
          if (isMounted.current && currentSelectedObjects.current.has(sobject)) {
            dispatch({ type: 'METADATA_LOADED', payload: { sobject, metadata: metadata.data } });
          }
        } catch (ex) {
          rollbar.error('Error fetching metadata for update records', getErrorMessageAndStackObj(ex));
          logger.warn('Could not fetch metadata for object', ex);
          if (isMounted.current) {
            dispatch({ type: 'METADATA_ERROR', payload: { sobject, error: getErrorMessage(ex) } });
          }
        }
      }
    },
    [org, rollbar]
  );

  const validateRowRecords = useCallback(
    async (sobject: string) => {
      try {
        const row = rowsMap.get(sobject);
        if (!row) {
          return;
        }
        dispatch({ type: 'START_VALIDATION', payload: { sobject } });
        const soql = getValidationSoqlQuery(row);
        if (!soql) {
          return;
        }
        const results = await query(org, soql);
        if (isMounted.current) {
          dispatch({ type: 'FINISH_VALIDATION', payload: { sobject, impactedRecords: results.queryResults.totalSize, error: null } });
        }
      } catch (ex) {
        logger.warn('Could not fetch record count', ex);
        if (isMounted.current) {
          dispatch({ type: 'FINISH_VALIDATION', payload: { sobject, impactedRecords: null, error: getErrorMessage(ex) } });
        }
      }
    },
    [org, rowsMap]
  );

  const validateAllRowRecords = useCallback(async () => {
    rows.forEach(({ sobject }) => dispatch({ type: 'START_VALIDATION', payload: { sobject } }));
    for (const row of rows) {
      if (!isMounted.current) {
        break;
      }
      const { sobject } = row;
      try {
        const soql = getValidationSoqlQuery(row);
        if (!soql) {
          return;
        }
        const results = await query(org, soql);
        if (isMounted.current) {
          dispatch({ type: 'FINISH_VALIDATION', payload: { sobject, impactedRecords: results.queryResults.totalSize, error: null } });
        }
      } catch (ex) {
        logger.warn('Could not fetch record count', ex);
        if (isMounted.current) {
          dispatch({ type: 'FINISH_VALIDATION', payload: { sobject, impactedRecords: null, error: getErrorMessage(ex) } });
        }
      }
    }
    trackEvent(ANALYTICS_KEYS.mass_update_ApplyAll, { numObjects: rows.length, type: 'VALIDATION' });
  }, [org, rows, trackEvent]);

  const onFieldSelected = useCallback((configIndex: number, sobject: string, selectedField: string) => {
    dispatch({ type: 'FIELD_SELECTION_CHANGED', payload: { sobject, selectedField, configIndex } });
  }, []);

  const onLoadChildFields = useCallback(
    async (sobject: string, item: ListItem): Promise<ListItem[]> => {
      const field = item.meta as Field;
      if (!Array.isArray(field.referenceTo) || field.referenceTo.length <= 0) {
        return [];
      }
      const { data } = await describeSObject(org, field.referenceTo?.[0] || '');
      const allFieldMetadata = sortQueryFields(data.fields);
      const childFields = getListItemsFromFieldWithRelatedItems(allFieldMetadata, item.id);

      dispatch({ type: 'CHILD_FIELDS_LOADED', payload: { sobject, parentId: item.id, childFields } });
      return childFields;
    },
    [org]
  );

  /** Handle added / removed sobjects */
  useEffect(() => {
    currentSelectedObjects.current = new Set(selectedSObjects || []);
    if (selectedSObjects) {
      const selectedSObjectsSet = new Set(selectedSObjects);
      const existingItemsSet = new Set(rows.map((row) => row.sobject));
      const newObjects: string[] = [];
      const removedObjects: string[] = [];
      // add new items
      selectedSObjects.forEach((sobject) => {
        if (!existingItemsSet.has(sobject)) {
          newObjects.push(sobject);
        }
      });
      // remove old items
      rows.forEach(({ sobject }) => {
        if (!selectedSObjectsSet.has(sobject)) {
          removedObjects.push(sobject);
        }
      });
      if (newObjects.length) {
        getObjectsMetadata(newObjects);
      }
      if (removedObjects.length) {
        dispatch({ type: 'OBJECTS_REMOVED', payload: { sobjects: removedObjects } });
      }
    }
  }, [getObjectsMetadata, rows, selectedSObjects]);

  function applyCommonField(configIndex: number, selectedField: string) {
    dispatch({ type: 'COMMON_FIELD_SELECTED', payload: { selectedField, configIndex } });
    trackEvent(ANALYTICS_KEYS.mass_update_ApplyAll, { numObjects: rows.length, type: 'COMMON_FIELD_SELECTED' });
  }

  function applyCommonOption(configIndex: number, option: TransformationOption, staticValue?: string) {
    dispatch({ type: 'COMMON_OPTION_SELECTED', payload: { option, staticValue, configIndex } });
    trackEvent(ANALYTICS_KEYS.mass_update_ApplyAll, { numObjects: rows.length, type: 'COMMON_OPTION_SELECTED', option });
  }

  function applyCommonCriteria(configIndex: number, criteria: TransformationCriteria, whereClause?: string) {
    dispatch({ type: 'COMMON_CRITERIA_SELECTED', payload: { criteria, whereClause, configIndex } });
    trackEvent(ANALYTICS_KEYS.mass_update_ApplyAll, { numObjects: rows.length, type: 'COMMON_CRITERIA_SELECTED', criteria });
  }

  function handleOptionChange(configIndex: number, sobject: string, transformationOptions: TransformationOptions) {
    dispatch({ type: 'TRANSFORMATION_OPTION_CHANGED', payload: { sobject, transformationOptions, configIndex } });
  }

  function handleAddField(sobject: string) {
    dispatch({ type: 'ADD_FIELD', payload: { sobject } });
  }

  function handleRemoveField(sobject: string, configIndex: number) {
    dispatch({ type: 'REMOVE_FIELD', payload: { sobject, configIndex } });
  }

  return {
    reset,
    clearResults,
    rows,
    allRowsValid,
    onFieldSelected,
    onLoadChildFields,
    applyCommonField,
    applyCommonOption,
    applyCommonCriteria,
    handleOptionChange,
    handleAddField,
    handleRemoveField,
    validateAllRowRecords,
    validateRowRecords,
  };
}
