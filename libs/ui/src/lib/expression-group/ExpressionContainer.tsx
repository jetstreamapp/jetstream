import { logger } from '@jetstream/shared/client-logger';
import { useNonInitialEffect } from '@jetstream/shared/ui-utils';
import {
  AndOr,
  ExpressionConditionRowSelectedItems,
  ExpressionConditionType,
  ExpressionGetResourceTypeFns,
  ExpressionGroupType,
  ExpressionType,
  ListItem,
  QueryFilterOperator,
} from '@jetstream/types';
import { FunctionComponent, memo, useCallback, useEffect, useReducer, useState } from 'react';
import DropDown from '../form/dropdown/DropDown';
import Expression from './Expression';
import { DraggableRow } from './expression-types';
import { isExpressionConditionType, isExpressionGroupType } from './expression-utils';
import ExpressionConditionRow from './ExpressionConditionRow';
import ExpressionGroup from './ExpressionGroup';

const DISPLAY_OPT_ROW = 'expression-ancillary-row';
const DISPLAY_OPT_WRAP = 'expression-ancillary-wrap';

export interface ExpressionContainerProps {
  title?: string;
  actionLabel: string;
  actionHelpText?: string;
  resourceLabel?: string;
  resourceHelpText?: string;
  functionsLabel?: string;
  functionsHelpText?: string;
  operatorLabel?: string;
  operatorHelpText?: string;
  valueLabel?: string;
  valueLabelHelpText?: string;
  resources: ListItem[];
  resourceListHeader?: string;
  resourceDrillInOnLoad?: (item: ListItem) => Promise<ListItem[]>;
  functions?: ListItem<string, QueryFilterOperator>[];
  operators: ListItem[];
  expressionInitValue?: ExpressionType;
  // used to optionally change input type of value based on the selected resource
  // if declared, these are called any time the resource changes
  getResourceTypeFns?: ExpressionGetResourceTypeFns;
  disableValueForOperators?: QueryFilterOperator[];
  onChange: (expression: ExpressionType) => void;
}

type Action =
  | { type: 'RESOURCE_FILTERS'; payload: { getResourceTypeFns?: ExpressionGetResourceTypeFns } }
  | { type: 'ACTION_CHANGED'; payload: { action: AndOr } }
  | { type: 'GROUP_ACTION_CHANGED'; payload: { action: AndOr; group: ExpressionGroupType } }
  | { type: 'ADD_CONDITION'; payload: { group?: ExpressionGroupType } }
  | { type: 'ADD_GROUP' }
  | {
      type: 'ROW_CHANGED';
      payload: {
        selected: ExpressionConditionRowSelectedItems;
        row: ExpressionConditionType;
        group?: ExpressionGroupType;
      };
    }
  | {
      type: 'ROW_MOVED';
      payload: { row: DraggableRow; targetGroupKey?: number };
    }
  | { type: 'DELETE_ROW'; payload: { row: ExpressionConditionType; group?: ExpressionGroupType } };

interface State {
  getResourceTypeFns?: ExpressionGetResourceTypeFns;
  expression: ExpressionType;
  nextConditionNumber: number;
  showDragHandles: boolean;
}

// if at least one resource and at least one group is visible, allow dragging
function shouldShowDragHandles(expression: ExpressionType) {
  return expression.rows.some(isExpressionGroupType);
}

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'RESOURCE_FILTERS': {
      return {
        ...state,
        getResourceTypeFns: action.payload.getResourceTypeFns,
      };
    }
    case 'ACTION_CHANGED': {
      return {
        ...state,
        expression: { ...state.expression, action: action.payload.action },
      };
    }
    case 'GROUP_ACTION_CHANGED': {
      const expression = { ...state.expression };
      const groupIdx = expression.rows.findIndex((item) => item.key === action.payload.group.key);
      if (groupIdx >= 0) {
        expression.rows = [...expression.rows];
        expression.rows[groupIdx] = { ...expression.rows[groupIdx], action: action.payload.action };
      }
      return {
        ...state,
        expression: expression,
      };
    }
    case 'ADD_CONDITION': {
      const { group } = action.payload;
      const expression = { ...state.expression };
      if (group) {
        const groupIdx = expression.rows.findIndex((item) => item.key === group.key);
        if (groupIdx >= 0) {
          expression.rows = [...expression.rows];
          const currRow = { ...expression.rows[groupIdx] } as ExpressionGroupType;
          currRow.rows = [...currRow.rows];
          currRow.rows = currRow.rows.concat(initRow(state.nextConditionNumber));
          expression.rows[groupIdx] = currRow;
        }
      } else {
        expression.rows = [...expression.rows];
        expression.rows = expression.rows.concat(initRow(state.nextConditionNumber));
      }
      return {
        ...state,
        nextConditionNumber: state.nextConditionNumber + 1,
        expression,
        showDragHandles: shouldShowDragHandles(expression),
      };
    }
    case 'ADD_GROUP': {
      const expression = { ...state.expression };
      expression.rows = expression.rows.concat(initGroup(state.nextConditionNumber, state.nextConditionNumber + 1));
      return {
        ...state,
        nextConditionNumber: state.nextConditionNumber + 2,
        expression,
        showDragHandles: shouldShowDragHandles(expression),
      };
    }

    case 'ROW_CHANGED': {
      const getResourceTypeFns = state.getResourceTypeFns;
      const { selected, row, group } = action.payload;
      const expression = { ...state.expression };
      if (group) {
        const groupIdx = expression.rows.findIndex((item) => item.key === group.key);
        if (groupIdx >= 0) {
          const rowIdx = (expression.rows[groupIdx] as ExpressionGroupType).rows.findIndex((item) => item.key === row.key);
          if (rowIdx >= 0) {
            expression.rows = [...expression.rows];
            expression.rows[groupIdx] = { ...expression.rows[groupIdx] };
            const currRow = expression.rows[groupIdx] as ExpressionGroupType;
            currRow.rows = [...currRow.rows];

            const resourceChanged =
              currRow.rows[rowIdx].selected.resource !== selected.resource ||
              currRow.rows[rowIdx].selected.operator !== selected.operator ||
              currRow.rows[rowIdx].selected.resourceType !== selected.resourceType;

            currRow.rows[rowIdx] = { ...currRow.rows[rowIdx], selected };

            if (resourceChanged && getResourceTypeFns) {
              updateResourcesOnRow(currRow.rows[rowIdx], selected, getResourceTypeFns);
            }
          }
        }
      } else {
        const rowIdx = expression.rows.findIndex((item) => item.key === row.key);
        if (rowIdx >= 0) {
          const currRow = expression.rows[rowIdx] as ExpressionConditionType;
          const resourceChanged =
            currRow.selected.resource !== selected.resource ||
            currRow.selected.operator !== selected.operator ||
            currRow.selected.resourceType !== selected.resourceType;

          expression.rows = [...expression.rows];
          expression.rows[rowIdx] = { ...expression.rows[rowIdx], selected };

          if (resourceChanged && getResourceTypeFns) {
            updateResourcesOnRow(expression.rows[rowIdx] as ExpressionConditionType, selected, getResourceTypeFns);
          }
        }
      }
      return {
        ...state,
        expression,
      };
    }
    case 'ROW_MOVED': {
      const { targetGroupKey } = action.payload;
      const { rowKey, groupKey } = action.payload.row;
      const expression = { ...state.expression };

      let rowToMove: ExpressionConditionType | undefined;

      expression.rows = [...expression.rows];

      /** remove item from group or base set of items if not in group */
      if (groupKey) {
        const groupIdx = expression.rows.findIndex((item) => item.key === groupKey);
        if (groupIdx >= 0) {
          rowToMove = (expression.rows[groupIdx] as ExpressionGroupType).rows.find((item) => item.key === rowKey);

          // clone all items that are modified
          expression.rows[groupIdx] = { ...expression.rows[groupIdx] };
          const currRow = expression.rows[groupIdx] as ExpressionGroupType;

          // remove item from group
          currRow.rows = (expression.rows[groupIdx] as ExpressionGroupType).rows.filter((item) => item.key !== rowKey);
          // remove empty group
          if (!currRow.rows.length) {
            expression.rows = expression.rows.filter((item) => item.key !== groupKey);
          }
        }
      } else {
        rowToMove = expression.rows.find((item) => item.key === rowKey) as ExpressionConditionType;
        // remove row
        expression.rows = expression.rows.filter((item) => item.key !== rowKey);
      }

      /** Add item to group */
      if (rowToMove) {
        if (targetGroupKey) {
          const groupIdx = expression.rows.findIndex((item) => item.key === targetGroupKey);
          if (groupIdx >= 0) {
            expression.rows[groupIdx] = { ...expression.rows[groupIdx] };
            const currRow = expression.rows[groupIdx] as ExpressionGroupType;
            currRow.rows = currRow.rows.concat(rowToMove);
          }
        } else {
          // add item to base
          const firstGroupIdx = expression.rows.findIndex((row) => isExpressionGroupType(row));
          if (firstGroupIdx < 0) {
            // concat to end
            expression.rows.push(rowToMove);
          } else if (firstGroupIdx === 0) {
            // unshift
            expression.rows.unshift(rowToMove);
          } else {
            // insert item at index that first group is located at
            expression.rows.splice(firstGroupIdx, 0, rowToMove);
          }
        }
      }

      return {
        ...state,
        expression,
        showDragHandles: shouldShowDragHandles(expression),
      };
    }
    case 'DELETE_ROW': {
      const { row, group } = action.payload;
      const expression = { ...state.expression };
      let nextConditionNumber = state.nextConditionNumber;
      if (group) {
        const groupIdx = expression.rows.findIndex((item) => item.key === group.key);
        if (groupIdx >= 0) {
          expression.rows = [...expression.rows];
          expression.rows[groupIdx] = { ...expression.rows[groupIdx] };
          const currRow = expression.rows[groupIdx] as ExpressionGroupType;
          currRow.rows = currRow.rows.filter((item) => item.key !== row.key);
          // remove group if all rows are deleted
          if (currRow.rows.length === 0) {
            expression.rows.splice(groupIdx, 1);
          }
        }
      } else {
        expression.rows = [...expression.rows];
        expression.rows = expression.rows.filter((item) => item.key !== row.key);
        if (expression.rows.length === 0) {
          // ensure at least one row exists
          expression.rows = [initRow(state.nextConditionNumber)];
          nextConditionNumber++;
        }
      }
      return {
        ...state,
        nextConditionNumber,
        expression,
        showDragHandles: shouldShowDragHandles(expression),
      };
    }
    default:
      throw new Error('Invalid action');
  }
}

function initExpression(expression?: ExpressionType): ExpressionType {
  if (!expression || !expression?.rows?.length) {
    return {
      action: 'AND',
      rows: [initRow(0)],
    };
  }
  return expression;
}

function initRow(key: number): ExpressionConditionType {
  return {
    key,
    resourceType: 'TEXT',
    selected: {
      resource: null,
      resourceGroup: null,
      function: null,
      operator: 'eq',
      value: '',
    },
  };
}

function initGroup(key: number, rowKey: number): ExpressionGroupType {
  return {
    key,
    action: 'AND',
    rows: [initRow(rowKey)],
  };
}

function updateResourcesOnRow(
  expressionRow: ExpressionConditionType,
  selected: ExpressionConditionRowSelectedItems,
  getResourceTypeFns: ExpressionGetResourceTypeFns
) {
  if (getResourceTypeFns) {
    try {
      expressionRow.resourceTypes = getResourceTypeFns.getTypes ? getResourceTypeFns.getTypes(selected) : undefined;
      expressionRow.resourceType = getResourceTypeFns.getType(selected);
      expressionRow.resourceSelectItems = getResourceTypeFns.getSelectItems(selected);
      expressionRow.helpText = getResourceTypeFns?.getHelpText?.(selected);
      expressionRow.selected = getResourceTypeFns?.checkSelected?.(selected) || selected;
    } catch (ex) {
      logger.warn('Error setting resource type or selected items', ex);
    }
  }
}

function initConditionNumber(expression?: ExpressionType) {
  let nextConditionNumber = 1;
  if (expression) {
    nextConditionNumber = expression.rows.reduce((max, row) => {
      if (isExpressionGroupType(row)) {
        return Math.max(max, row.key, ...row.rows.map((groupRow) => groupRow.key));
      }
      return Math.max(max, row.key);
    }, 0);
    nextConditionNumber++;
  }
  return nextConditionNumber;
}

function getInitialState(initialState: ExpressionType) {
  const expression = initExpression(initialState);
  return {
    expression,
    nextConditionNumber: initConditionNumber(initialState),
    showDragHandles: shouldShowDragHandles(expression),
  };
}

export const ExpressionContainer: FunctionComponent<ExpressionContainerProps> = memo(
  ({
    title,
    actionLabel,
    actionHelpText,
    resourceLabel,
    resourceHelpText,
    functionsLabel,
    functionsHelpText,
    operatorLabel,
    operatorHelpText,
    valueLabel,
    valueLabelHelpText,
    resources,
    resourceListHeader,
    resourceDrillInOnLoad,
    functions,
    operators,
    expressionInitValue,
    getResourceTypeFns,
    disableValueForOperators,
    onChange,
  }) => {
    const [displayOption, setDisplayOption] = useState(DISPLAY_OPT_WRAP);
    const [{ expression, showDragHandles }, dispatch] = useReducer(reducer, expressionInitValue, getInitialState);

    useEffect(() => {
      dispatch({ type: 'RESOURCE_FILTERS', payload: { getResourceTypeFns } });
    }, [getResourceTypeFns]);

    useNonInitialEffect(() => {
      if (expression) {
        onChange(expression);
      }
    }, [expression, onChange]);

    const moveRowToGroup = useCallback((row: DraggableRow, targetGroupKey?: number) => {
      dispatch({ type: 'ROW_MOVED', payload: { row, targetGroupKey } });
    }, []);

    function handleExpressionActionChange(action: AndOr) {
      dispatch({ type: 'ACTION_CHANGED', payload: { action } });
    }

    function handleGroupActionChange(action: AndOr, group: ExpressionGroupType) {
      dispatch({ type: 'GROUP_ACTION_CHANGED', payload: { action, group } });
    }

    function handleAddCondition(group?: ExpressionGroupType) {
      dispatch({ type: 'ADD_CONDITION', payload: { group } });
    }

    function handleAddGroup() {
      dispatch({ type: 'ADD_GROUP' });
    }

    function handleRowChange(selected: ExpressionConditionRowSelectedItems, row: ExpressionConditionType, group?: ExpressionGroupType) {
      dispatch({
        type: 'ROW_CHANGED',
        payload: {
          selected,
          row,
          group,
        },
      });
    }

    function handleDeleteRow(row: ExpressionConditionType, group?: ExpressionGroupType) {
      dispatch({ type: 'DELETE_ROW', payload: { row, group } });
    }

    return (
      <Expression
        actionLabel={actionLabel}
        title={title}
        value={expression.action}
        ancillaryOptions={
          <div className="slds-m-top_large slds-m-left_xx-small">
            <DropDown
              position="left"
              description="Display options"
              initialSelectedId={displayOption}
              items={[
                { id: DISPLAY_OPT_ROW, value: 'Display filters on one row' },
                { id: DISPLAY_OPT_WRAP, value: 'Wrap filters if limited space' },
              ]}
              onSelected={(id) => setDisplayOption(id)}
            />
          </div>
        }
        onActionChange={handleExpressionActionChange}
        onAddCondition={handleAddCondition}
        onAddGroup={handleAddGroup}
        moveRowToGroup={moveRowToGroup}
      >
        {expression.rows.map((row, i) => {
          if (isExpressionConditionType(row)) {
            return (
              <ExpressionConditionRow
                key={row.key}
                rowKey={row.key}
                row={i + 1}
                AndOr={expression.action}
                showDragHandles={showDragHandles}
                wrap={displayOption === DISPLAY_OPT_WRAP}
                resourceTypes={row.resourceTypes}
                resourceType={row.resourceType}
                resourceSelectItems={row.resourceSelectItems}
                resourceLabel={resourceLabel}
                functionsLabel={functionsLabel}
                functionsHelpText={functionsHelpText}
                resourceHelpText={resourceHelpText}
                operatorLabel={operatorLabel}
                operatorHelpText={operatorHelpText}
                valueLabel={valueLabel}
                valueLabelHelpText={valueLabelHelpText}
                rowHelpText={row.helpText}
                resources={resources}
                resourceListHeader={resourceListHeader}
                resourceDrillInOnLoad={resourceDrillInOnLoad}
                functions={functions}
                operators={operators}
                selected={row.selected}
                disableValueForOperators={disableValueForOperators}
                onChange={(selected) => handleRowChange(selected, row)}
                onDelete={() => handleDeleteRow(row)}
              ></ExpressionConditionRow>
            );
          } else {
            return (
              <ExpressionGroup
                key={row.key}
                groupKey={row.key}
                group={i + 1}
                parentAction={expression.action}
                rowAction={row.action}
                onActionChange={(andOr) => handleGroupActionChange(andOr, row)}
                onAddCondition={() => handleAddCondition(row)}
                moveRowToGroup={moveRowToGroup}
              >
                {row.rows.map((childRow: ExpressionConditionType, k) => (
                  <ExpressionConditionRow
                    key={childRow.key}
                    rowKey={childRow.key}
                    groupKey={row.key}
                    group={i + 1}
                    row={k + 1}
                    AndOr={row.action}
                    showDragHandles={showDragHandles}
                    wrap={displayOption === DISPLAY_OPT_WRAP}
                    resourceTypes={childRow.resourceTypes}
                    resourceType={childRow.resourceType}
                    resourceSelectItems={childRow.resourceSelectItems}
                    resourceLabel={resourceLabel}
                    functionsLabel={functionsLabel}
                    functionsHelpText={functionsHelpText}
                    resourceHelpText={resourceHelpText}
                    operatorLabel={operatorLabel}
                    operatorHelpText={operatorHelpText}
                    valueLabel={valueLabel}
                    valueLabelHelpText={valueLabelHelpText}
                    rowHelpText={childRow.helpText}
                    resources={resources}
                    resourceListHeader={resourceListHeader}
                    functions={functions}
                    operators={operators}
                    selected={childRow.selected}
                    disableValueForOperators={disableValueForOperators}
                    onChange={(selected) => handleRowChange(selected, childRow, row)}
                    onDelete={() => handleDeleteRow(childRow, row)}
                  ></ExpressionConditionRow>
                ))}
              </ExpressionGroup>
            );
          }
        })}
      </Expression>
    );
  }
);

export default ExpressionContainer;
