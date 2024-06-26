import { useNonInitialEffect } from '@jetstream/shared/ui-utils';
import { ConfirmationModalPromise } from '@jetstream/ui';
import {
  FieldDefinitionType,
  FieldValue,
  FieldValues,
  allFields,
  calculateFieldValidity,
  generateApiNameFromLabel,
  getInitialValues,
} from '@jetstream/ui-core';
import { useCallback, useEffect, useReducer } from 'react';
import { useRecoilState } from 'recoil';
import * as fromCreateFieldsState from './create-fields.state';

type Action =
  | { type: 'VALIDATE' }
  | { type: 'ADD_ROW' }
  | { type: 'IMPORT_ROWS'; payload: { rows: FieldValues[] } }
  | { type: 'REMOVE_ROW'; payload: { rowKey: number } }
  | { type: 'CLONE_ROW'; payload: { rowKey: number } }
  | { type: 'CHANGE_ROW'; payload: { rowKey: number; field: FieldDefinitionType; value: FieldValue } }
  | { type: 'TOUCH_ROW_FIELD'; payload: { rowKey: number; field: FieldDefinitionType } }
  | { type: 'PICKLIST_OPTION_CHANGED'; payload: { rowKey: number; value: boolean } }
  | { type: 'RESET' };

interface State {
  rows: FieldValues[];
  allValid: boolean;
}

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'VALIDATE': {
      const { rows, allValid } = calculateFieldValidity(state.rows);
      return { ...state, rows, allValid };
    }
    case 'ADD_ROW': {
      const nextKey = fromCreateFieldsState.getNextKey();
      return {
        ...state,
        rows: [...state.rows, getInitialValues(nextKey)],
        allValid: false,
      };
    }
    case 'IMPORT_ROWS': {
      const newRows = [
        ...state.rows,
        ...action.payload.rows.map((row, i) => ({
          ...row,
          _key: fromCreateFieldsState.getNextKey(),
          _picklistGlobalValueSet: !!row.globalValueSet.value,
        })),
      ];
      const { rows, allValid } = calculateFieldValidity(newRows);
      return {
        ...state,
        rows,
        allValid,
      };
    }
    case 'REMOVE_ROW': {
      const { rowKey } = action.payload;
      const { rows, allValid } = calculateFieldValidity(state.rows.filter((row) => row._key !== rowKey));
      return {
        ...state,
        rows,
        allValid,
      };
    }
    case 'CLONE_ROW': {
      const { rowKey } = action.payload;
      const _rows = [...state.rows];
      const rowIdx = state.rows.findIndex((row) => row._key === rowKey);
      if (rowIdx >= 0) {
        const newRow: FieldValues = {
          ...JSON.parse(JSON.stringify(_rows[rowIdx])),
          _key: fromCreateFieldsState.getNextKey(),
        };

        if (newRow.label.value) {
          newRow.label = { ...newRow.label, value: `${newRow.label.value} copy` };
          newRow.fullName = { ...newRow.fullName, value: generateApiNameFromLabel(newRow.label.value as string) };
        }

        // ensure on clone all fields are marked as touched to show validation errors
        allFields.forEach((field) => {
          if (newRow[field]) {
            newRow[field].touched = true;
          }
        });

        _rows.push(newRow);
      }
      const { rows, allValid } = calculateFieldValidity(_rows);
      return { ...state, rows, allValid };
    }
    case 'CHANGE_ROW': {
      const { rowKey, field, value } = action.payload;
      const _rows = [...state.rows];
      const rowIdx = state.rows.findIndex((row) => row._key === rowKey);
      if (rowIdx >= 0) {
        _rows[rowIdx] = { ..._rows[rowIdx] };
        _rows[rowIdx][field] = { ..._rows[rowIdx][field], value, touched: true };
        if (field === 'globalValueSet') {
          _rows[rowIdx].restricted = { ..._rows[rowIdx].restricted, value: true };
          _rows[rowIdx].firstAsDefault = { ..._rows[rowIdx].restricted, value: false };
        }
      }
      const { rows, allValid } = calculateFieldValidity(_rows);
      return { ...state, rows, allValid };
    }
    case 'TOUCH_ROW_FIELD': {
      const { rowKey, field } = action.payload;
      const _rows = [...state.rows];
      const rowIdx = state.rows.findIndex((row) => row._key === rowKey);
      if (rowIdx >= 0) {
        _rows[rowIdx] = { ..._rows[rowIdx] };
        _rows[rowIdx][field] = { ..._rows[rowIdx][field], touched: true };

        if (field === 'label' && _rows[rowIdx][field].value) {
          const fullNameValue = generateApiNameFromLabel(_rows[rowIdx][field].value as string);
          _rows[rowIdx].fullName = { ..._rows[rowIdx].fullName, value: fullNameValue || _rows[rowIdx].fullName.value, touched: true };
        }
      }
      const { rows, allValid } = calculateFieldValidity(_rows);
      return { ...state, rows, allValid };
    }
    case 'PICKLIST_OPTION_CHANGED': {
      const { rowKey, value } = action.payload;
      const _rows = [...state.rows];
      const rowIdx = state.rows.findIndex((row) => row._key === rowKey);
      if (rowIdx >= 0) {
        _rows[rowIdx] = { ..._rows[rowIdx] };
        _rows[rowIdx]._picklistGlobalValueSet = value;
      }
      const { rows, allValid } = calculateFieldValidity(_rows);
      return { ...state, rows, allValid };
    }
    case 'RESET': {
      return { ...state, rows: [getInitialValues(fromCreateFieldsState.getNextKey())], allValid: false };
    }
    default:
      throw new Error('Invalid action');
  }
}

export function useFieldValues() {
  const [rowsState, setRowsState] = useRecoilState(fromCreateFieldsState.fieldRowsState);
  const [{ allValid, rows }, dispatch] = useReducer(reducer, {
    rows: rowsState,
    allValid: false,
  });

  useEffect(() => {
    dispatch({ type: 'VALIDATE' });
  }, []);

  useNonInitialEffect(() => {
    setRowsState(rows);
  }, [rows, setRowsState]);

  const addRow = useCallback(() => {
    dispatch({ type: 'ADD_ROW' });
  }, []);

  const importRows = useCallback((rows: FieldValues[]) => {
    dispatch({ type: 'IMPORT_ROWS', payload: { rows } });
  }, []);

  const cloneRow = useCallback((rowKey: number) => {
    dispatch({ type: 'CLONE_ROW', payload: { rowKey } });
  }, []);

  const removeRow = useCallback((rowKey: number) => {
    dispatch({ type: 'REMOVE_ROW', payload: { rowKey } });
  }, []);

  const changeRow = useCallback((rowKey: number, field: FieldDefinitionType, value: FieldValue) => {
    dispatch({ type: 'CHANGE_ROW', payload: { rowKey, field, value } });
  }, []);

  const touchRow = useCallback((rowKey: number, field: FieldDefinitionType) => {
    dispatch({ type: 'TOUCH_ROW_FIELD', payload: { rowKey, field } });
  }, []);

  const picklistOptionChanged = useCallback((rowKey: number, value: boolean) => {
    dispatch({ type: 'PICKLIST_OPTION_CHANGED', payload: { rowKey, value } });
  }, []);

  const resetRows = useCallback(async () => {
    if (
      await ConfirmationModalPromise({
        content: 'Are you sure you want to reset all fields?',
      })
    ) {
      dispatch({ type: 'RESET' });
    }
  }, []);

  return {
    allValid,
    rows,
    addRow,
    importRows,
    cloneRow,
    removeRow,
    changeRow,
    touchRow,
    resetRows,
    picklistOptionChanged,
  };
}
