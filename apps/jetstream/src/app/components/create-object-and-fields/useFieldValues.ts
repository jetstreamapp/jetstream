import { useCallback, useReducer } from 'react';
import { FieldDefinitionType, FieldValue, FieldValues } from './create-fields-types';
import { calculateFieldValidity, getInitialValues } from './create-fields-utils';

type Action =
  | { type: 'ADD_ROW' }
  | { type: 'REMOVE_ROW'; payload: { rowKey: number } }
  | { type: 'CLONE_ROW'; payload: { rowKey: number } }
  | { type: 'CHANGE_ROW'; payload?: { rowKey: number; field: FieldDefinitionType; value: FieldValue } }
  | { type: 'TOUCH_ROW_FIELD'; payload?: { rowKey: number; field: FieldDefinitionType } }
  | { type: 'PICKLIST_OPTION_CHANGED'; payload?: { rowKey: number; value: boolean } };

interface State {
  currRowKey: number;
  rows: FieldValues[];
  allValid: boolean;
}

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'ADD_ROW': {
      return {
        ...state,
        rows: [...state.rows, getInitialValues(state.currRowKey + 1)],
        currRowKey: state.currRowKey + 1,
        allValid: false,
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
      let currRowKey = state.currRowKey;
      if (rowIdx >= 0) {
        _rows.push({
          ...JSON.parse(JSON.stringify(_rows[rowIdx])),
          _key: currRowKey + 1,
        });
        currRowKey += 1;
      }
      const { rows, allValid } = calculateFieldValidity(_rows);
      return { ...state, rows, currRowKey, allValid };
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
      // TODO: do I need this?
      const { rows, allValid } = calculateFieldValidity(_rows);
      return { ...state, rows, allValid };
    }
    default:
      throw new Error('Invalid action');
  }
}

export function useFieldValues() {
  const [{ allValid, rows }, dispatch] = useReducer(reducer, {
    currRowKey: 0,
    rows: [getInitialValues(0)],
    allValid: false,
  });

  const addRow = useCallback(() => {
    dispatch({ type: 'ADD_ROW' });
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

  return {
    allValid,
    rows,
    addRow,
    cloneRow,
    removeRow,
    changeRow,
    touchRow,
    picklistOptionChanged,
  };
}
