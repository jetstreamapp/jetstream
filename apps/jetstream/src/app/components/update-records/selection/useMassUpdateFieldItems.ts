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
import { DescribeSObjectResult, Field, ListItem, Maybe, SalesforceOrgUi } from '@jetstream/types';
import {
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
  | { type: 'OBJECTS_SELECTED'; payload: { sobjects: string[] } }
  | { type: 'OBJECTS_REMOVED'; payload: { sobjects: string[] } }
  | { type: 'FIELD_SELECTION_CHANGED'; payload: { sobject: string; selectedField: string } }
  | { type: 'COMMON_FIELD_SELECTED'; payload: { selectedField: string } }
  | { type: 'COMMON_OPTION_SELECTED'; payload: { option: TransformationOption; staticValue?: string } }
  | { type: 'COMMON_CRITERIA_SELECTED'; payload: { criteria: TransformationCriteria; whereClause?: string } }
  | { type: 'TRANSFORMATION_OPTION_CHANGED'; payload: { sobject: string; transformationOptions: TransformationOptions } }
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
          transformationOptions: {
            option: 'staticValue',
            staticValue: '',
            criteria: 'all',
            alternateField: null,
            whereClause: '',
          },
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
      const { sobject, selectedField } = action.payload;
      const rowsMap = new Map(state.rowsMap);
      const row = { ...state.rowsMap.get(sobject), selectedField } as MetadataRow;
      row.isValid = isValidRow(row);
      row.transformationOptions = { ...row.transformationOptions, staticValue: '' };
      rowsMap.set(sobject, row);
      return { ...state, rowsMap, allRowsValid: Array.from(rowsMap.values()).every((row) => row.isValid) };
    }
    case 'COMMON_FIELD_SELECTED': {
      const { selectedField } = action.payload;
      const rowsMap = new Map(state.rowsMap);
      rowsMap.forEach((_row, key) => {
        const row = { ..._row, selectedField, validationResults: null };
        row.isValid = isValidRow(row);
        rowsMap.set(key, row);
      });
      return { ...state, rowsMap, allRowsValid: Array.from(rowsMap.values()).every((row) => row.isValid) };
    }
    case 'COMMON_OPTION_SELECTED': {
      const { option, staticValue } = action.payload;
      const rowsMap = new Map(state.rowsMap);
      rowsMap.forEach((_row, key) => {
        const _staticValue = option === 'staticValue' && staticValue ? staticValue : _row.transformationOptions.staticValue;
        const row = { ..._row, transformationOptions: { ..._row.transformationOptions, option, staticValue: _staticValue } };
        row.isValid = isValidRow(row);
        rowsMap.set(key, row);
      });
      return { ...state, rowsMap, allRowsValid: Array.from(rowsMap.values()).every((row) => row.isValid) };
    }
    case 'COMMON_CRITERIA_SELECTED': {
      const { criteria, whereClause } = action.payload;
      const rowsMap = new Map(state.rowsMap);
      rowsMap.forEach((_row, key) => {
        const row = { ..._row, transformationOptions: { ..._row.transformationOptions, criteria }, validationResults: null };
        if (criteria === 'custom' && whereClause) {
          row.transformationOptions.whereClause = whereClause;
        }
        row.isValid = isValidRow(row);
        rowsMap.set(key, row);
      });
      return { ...state, rowsMap, allRowsValid: Array.from(rowsMap.values()).every((row) => row.isValid) };
    }
    case 'TRANSFORMATION_OPTION_CHANGED': {
      const { sobject, transformationOptions } = action.payload;
      const rowsMap = new Map(state.rowsMap);
      const row = { ...state.rowsMap.get(sobject), transformationOptions, validationResults: null } as MetadataRow;
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
          rollbar.error('Error fetching metadata for update records', { message: ex.message, stack: ex.stack });
          logger.warn('Could not fetch metadata for object', ex);
          if (isMounted.current) {
            dispatch({ type: 'METADATA_ERROR', payload: { sobject, error: ex.message } });
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
        const results = await query(org, soql);
        if (isMounted.current) {
          dispatch({ type: 'FINISH_VALIDATION', payload: { sobject, impactedRecords: results.queryResults.totalSize, error: null } });
        }
      } catch (ex) {
        logger.warn('Could not fetch record count', ex);
        if (isMounted.current) {
          dispatch({ type: 'FINISH_VALIDATION', payload: { sobject, impactedRecords: null, error: ex.message } });
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
        const results = await query(org, soql);
        if (isMounted.current) {
          dispatch({ type: 'FINISH_VALIDATION', payload: { sobject, impactedRecords: results.queryResults.totalSize, error: null } });
        }
      } catch (ex) {
        logger.warn('Could not fetch record count', ex);
        if (isMounted.current) {
          dispatch({ type: 'FINISH_VALIDATION', payload: { sobject, impactedRecords: null, error: ex.message } });
        }
      }
    }
    trackEvent(ANALYTICS_KEYS.mass_update_ApplyAll, { numObjects: rows.length, type: 'VALIDATION' });
  }, [org, rows, trackEvent]);

  const onFieldSelected = useCallback((sobject: string, selectedField: string) => {
    dispatch({ type: 'FIELD_SELECTION_CHANGED', payload: { sobject, selectedField } });
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

  function applyCommonField(selectedField: string) {
    dispatch({ type: 'COMMON_FIELD_SELECTED', payload: { selectedField } });
    trackEvent(ANALYTICS_KEYS.mass_update_ApplyAll, { numObjects: rows.length, type: 'COMMON_FIELD_SELECTED' });
  }

  function applyCommonOption(option: TransformationOption, staticValue?: string) {
    dispatch({ type: 'COMMON_OPTION_SELECTED', payload: { option, staticValue } });
    trackEvent(ANALYTICS_KEYS.mass_update_ApplyAll, { numObjects: rows.length, type: 'COMMON_OPTION_SELECTED', option });
  }

  function applyCommonCriteria(criteria: TransformationCriteria, whereClause?: string) {
    dispatch({ type: 'COMMON_CRITERIA_SELECTED', payload: { criteria, whereClause } });
    trackEvent(ANALYTICS_KEYS.mass_update_ApplyAll, { numObjects: rows.length, type: 'COMMON_CRITERIA_SELECTED', criteria });
  }

  function handleOptionChange(sobject: string, transformationOptions: TransformationOptions) {
    dispatch({ type: 'TRANSFORMATION_OPTION_CHANGED', payload: { sobject, transformationOptions } });
  }

  return {
    reset,
    rows,
    allRowsValid,
    onFieldSelected,
    onLoadChildFields,
    applyCommonField,
    applyCommonOption,
    applyCommonCriteria,
    handleOptionChange,
    validateAllRowRecords,
    validateRowRecords,
  };
}
