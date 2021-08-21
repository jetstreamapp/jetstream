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
  ListItemGroup,
  QueryFilterOperator,
} from '@jetstream/types';
import React, { FunctionComponent, useReducer, useState } from 'react';
import DropDown from '../form/dropdown/DropDown';
import Expression from './Expression';
import { isExpressionConditionType } from './expression-utils';
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
  operatorLabel?: string;
  operatorHelpText?: string;
  valueLabel?: string;
  valueLabelHelpText?: string;
  resources: ListItemGroup[];
  operators: ListItem[];
  expressionInitValue?: ExpressionType;
  // used to optionally change input type of value based on the selected resource
  // if declared, these are called any time the resource changes
  getResourceTypeFns?: ExpressionGetResourceTypeFns;
  disableValueForOperators?: QueryFilterOperator[];
  onChange: (expression: ExpressionType) => void;
}

type Action =
  | { type: 'ACTION_CHANGED'; payload: { action: AndOr } }
  | { type: 'GROUP_ACTION_CHANGED'; payload: { action: AndOr; group: ExpressionGroupType } }
  | { type: 'ADD_CONDITION'; payload: { group?: ExpressionGroupType } }
  | { type: 'ADD_GROUP' }
  | {
      type: 'ROW_CHANGED';
      payload: { selected: ExpressionConditionRowSelectedItems; row: ExpressionConditionType; group?: ExpressionGroupType };
    }
  | { type: 'DELETE_ROW'; payload: { row: ExpressionConditionType; group?: ExpressionGroupType } };

interface State {
  expression: ExpressionType;
  nextConditionNumber: number;
  getResourceTypeFns?: ExpressionGetResourceTypeFns;
}

function reducer(state: State, action: Action): State {
  switch (action.type) {
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
      };
    }
    case 'ADD_GROUP': {
      const expression = { ...state.expression };
      expression.rows = expression.rows.concat(initGroup(state.nextConditionNumber, state.nextConditionNumber + 1));
      return {
        ...state,
        nextConditionNumber: state.nextConditionNumber + 2,
        expression,
      };
    }

    case 'ROW_CHANGED': {
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

            if (resourceChanged && state.getResourceTypeFns) {
              updateResourcesOnRow(currRow.rows[rowIdx], selected, state.getResourceTypeFns);
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

          if (resourceChanged && state.getResourceTypeFns) {
            updateResourcesOnRow(expression.rows[rowIdx] as ExpressionConditionType, selected, state.getResourceTypeFns);
          }
        }
      }
      return {
        ...state,
        expression,
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
      expressionRow.helpText = getResourceTypeFns?.getHelpText(selected);
      expressionRow.selected = getResourceTypeFns?.checkSelected(selected) || selected;
    } catch (ex) {
      logger.warn('Error setting resource type or selected items', ex);
    }
  }
}

function initConditionNumber(expression?: ExpressionType) {
  let nextConditionNumber = 1;
  if (expression) {
    nextConditionNumber = Math.max(...expression.rows.map((row) => row.key));
    nextConditionNumber++;
  }
  return nextConditionNumber;
}

export const ExpressionContainer: FunctionComponent<ExpressionContainerProps> = React.memo(
  ({
    title,
    actionLabel,
    actionHelpText,
    resourceLabel,
    resourceHelpText,
    operatorLabel,
    operatorHelpText,
    valueLabel,
    valueLabelHelpText,
    resources,
    operators,
    expressionInitValue,
    getResourceTypeFns,
    disableValueForOperators,
    onChange,
  }) => {
    const [displayOption, setDisplayOption] = useState(DISPLAY_OPT_ROW);
    const [{ expression }, dispatch] = useReducer(reducer, {
      expression: initExpression(expressionInitValue),
      nextConditionNumber: initConditionNumber(),
      getResourceTypeFns,
    });

    useNonInitialEffect(() => {
      if (expression) {
        onChange(expression);
      }
    }, [expression]);

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
      >
        {expression.rows.map((row, i) => {
          if (isExpressionConditionType(row)) {
            return (
              <ExpressionConditionRow
                key={row.key}
                row={i + 1}
                wrap={displayOption === DISPLAY_OPT_WRAP}
                resourceTypes={row.resourceTypes}
                resourceType={row.resourceType}
                resourceSelectItems={row.resourceSelectItems}
                resourceLabel={resourceLabel}
                resourceHelpText={resourceHelpText}
                operatorLabel={operatorLabel}
                operatorHelpText={operatorHelpText}
                valueLabel={valueLabel}
                valueLabelHelpText={valueLabelHelpText}
                rowHelpText={row.helpText}
                AndOr={expression.action}
                resources={resources}
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
                group={i + 1}
                parentAction={expression.action}
                onActionChange={(andOr) => handleGroupActionChange(andOr, row)}
                onAddCondition={() => handleAddCondition(row)}
              >
                {row.rows.map((childRow: ExpressionConditionType, k) => (
                  <ExpressionConditionRow
                    key={childRow.key}
                    group={i + 1}
                    row={k + 1}
                    wrap={displayOption === DISPLAY_OPT_WRAP}
                    resourceTypes={childRow.resourceTypes}
                    resourceType={childRow.resourceType}
                    resourceSelectItems={childRow.resourceSelectItems}
                    AndOr={row.action}
                    resourceLabel={resourceLabel}
                    resourceHelpText={resourceHelpText}
                    operatorLabel={operatorLabel}
                    operatorHelpText={operatorHelpText}
                    valueLabel={valueLabel}
                    valueLabelHelpText={valueLabelHelpText}
                    rowHelpText={childRow.helpText}
                    resources={resources}
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
