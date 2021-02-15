import { logger } from '@jetstream/shared/client-logger';
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
import React, { FunctionComponent, useEffect, useState } from 'react';
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
    const [expression, setExpression] = useState<ExpressionType>(() => initExpression(expressionInitValue));
    const [displayOption, setDisplayOption] = useState(DISPLAY_OPT_ROW);
    const [nextConditionNumber, setNextConditionNumber] = useState<number>(() => {
      let nextNumber = 1;
      if (expressionInitValue) {
        nextNumber = Math.max(...expressionInitValue.rows.map((row) => row.key));
        nextNumber++;
      }
      return nextNumber;
    });
    const [isInit, setIsInit] = useState<boolean>(false);

    useEffect(() => {
      if (isInit) {
        if (expression) {
          onChange(expression);
        }
      } else {
        setIsInit(true);
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [expression]);

    function handleExpressionActionChange(action: AndOr) {
      setExpression({ ...expression, action });
    }

    function handleAddCondition(group?: ExpressionGroupType) {
      const clonedExpression = { ...expression };
      if (group) {
        const groupIdx = clonedExpression.rows.findIndex((item) => item.key === group.key);
        if (groupIdx >= 0) {
          clonedExpression.rows = [...clonedExpression.rows];
          const currRow = { ...clonedExpression.rows[groupIdx] } as ExpressionGroupType;
          currRow.rows = [...currRow.rows];
          currRow.rows = currRow.rows.concat(initRow(nextConditionNumber));
          clonedExpression.rows[groupIdx] = currRow;
        }
      } else {
        clonedExpression.rows = [...clonedExpression.rows];
        clonedExpression.rows = clonedExpression.rows.concat(initRow(nextConditionNumber));
      }
      setNextConditionNumber(nextConditionNumber + 1);
      setExpression(clonedExpression);
    }

    function handleAddGroup() {
      const clonedExpression = { ...expression };
      clonedExpression.rows = clonedExpression.rows.concat(initGroup(nextConditionNumber, nextConditionNumber + 1));
      setNextConditionNumber(nextConditionNumber + 2);
      setExpression(clonedExpression);
    }

    function handleGroupActionChange(action: AndOr, group: ExpressionGroupType) {
      const clonedExpression = { ...expression };
      const groupIdx = clonedExpression.rows.findIndex((item) => item.key === group.key);
      if (groupIdx >= 0) {
        clonedExpression.rows = [...clonedExpression.rows];
        clonedExpression.rows[groupIdx] = { ...clonedExpression.rows[groupIdx], action };
      }
      setExpression(clonedExpression);
    }

    function handleRowChange(selected: ExpressionConditionRowSelectedItems, row: ExpressionConditionType, group?: ExpressionGroupType) {
      const clonedExpression = { ...expression };
      if (group) {
        const groupIdx = clonedExpression.rows.findIndex((item) => item.key === group.key);
        if (groupIdx >= 0) {
          const rowIdx = (clonedExpression.rows[groupIdx] as ExpressionGroupType).rows.findIndex((item) => item.key === row.key);
          if (rowIdx >= 0) {
            clonedExpression.rows = [...clonedExpression.rows];
            clonedExpression.rows[groupIdx] = { ...clonedExpression.rows[groupIdx] };
            const currRow = clonedExpression.rows[groupIdx] as ExpressionGroupType;
            currRow.rows = [...currRow.rows];

            const resourceChanged =
              currRow.rows[rowIdx].selected.resource !== selected.resource ||
              currRow.rows[rowIdx].selected.operator !== selected.operator ||
              currRow.rows[rowIdx].selected.resourceType !== selected.resourceType;

            currRow.rows[rowIdx] = { ...currRow.rows[rowIdx], selected };

            if (resourceChanged) {
              updateResourcesOnRow(currRow.rows[rowIdx], selected);
            }
          }
        }
      } else {
        const rowIdx = clonedExpression.rows.findIndex((item) => item.key === row.key);
        if (rowIdx >= 0) {
          const currRow = clonedExpression.rows[rowIdx] as ExpressionConditionType;
          const resourceChanged =
            currRow.selected.resource !== selected.resource ||
            currRow.selected.operator !== selected.operator ||
            currRow.selected.resourceType !== selected.resourceType;

          clonedExpression.rows = [...clonedExpression.rows];
          clonedExpression.rows[rowIdx] = { ...clonedExpression.rows[rowIdx], selected };

          if (resourceChanged) {
            updateResourcesOnRow(clonedExpression.rows[rowIdx] as ExpressionConditionType, selected);
          }
        }
      }
      setExpression(clonedExpression);
    }

    function updateResourcesOnRow(mutableRow: ExpressionConditionType, selected: ExpressionConditionRowSelectedItems) {
      if (getResourceTypeFns) {
        try {
          mutableRow.resourceTypes = getResourceTypeFns.getTypes ? getResourceTypeFns.getTypes(selected) : undefined;
          mutableRow.resourceType = getResourceTypeFns.getType(selected);
          mutableRow.resourceSelectItems = getResourceTypeFns.getSelectItems(selected);
          mutableRow.selected = getResourceTypeFns?.checkSelected(selected) || selected;
        } catch (ex) {
          logger.warn('Error setting resource type or selected items', ex);
        }
      }
    }

    function handleDeleteRow(row: ExpressionConditionType, group?: ExpressionGroupType) {
      const clonedExpression = { ...expression };
      if (group) {
        const groupIdx = clonedExpression.rows.findIndex((item) => item.key === group.key);
        if (groupIdx >= 0) {
          clonedExpression.rows = [...clonedExpression.rows];
          clonedExpression.rows[groupIdx] = { ...clonedExpression.rows[groupIdx] };
          const currRow = clonedExpression.rows[groupIdx] as ExpressionGroupType;
          currRow.rows = currRow.rows.filter((item) => item.key !== row.key);
          // remove group if all rows are deleted
          if (currRow.rows.length === 0) {
            clonedExpression.rows.splice(groupIdx, 1);
          }
        }
      } else {
        clonedExpression.rows = [...clonedExpression.rows];
        clonedExpression.rows = clonedExpression.rows.filter((item) => item.key !== row.key);
        if (clonedExpression.rows.length === 0) {
          // ensure at least one row exists
          clonedExpression.rows = [initRow(nextConditionNumber)];
          setNextConditionNumber(nextConditionNumber + 1);
        }
      }
      setExpression(clonedExpression);
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
