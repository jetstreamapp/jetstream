import {
  AndOr,
  ExpressionConditionRowSelectedItems,
  ExpressionConditionType,
  ExpressionGroupType,
  ExpressionType,
  ListItem,
  ListItemGroup,
  ExpressionGetResourceTypeFns,
  QueryFilterOperator,
} from '@jetstream/types';
import React, { FunctionComponent, useEffect, useState } from 'react';
import Expression from './Expression';
import ExpressionConditionRow from './ExpressionConditionRow';
import ExpressionGroup from './ExpressionGroup';
import { logger } from '@jetstream/shared/client-logger';

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
  if (expression) {
    if (expression.rows.length === 0) {
      expression.rows.push(initRow(0));
    }
    return expression;
  }
  return {
    action: 'AND',
    groups: [],
    rows: [initRow(0)],
  };
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
    const [nextConditionNumber, setNextConditionNumber] = useState<number>(1);
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
        const groupIdx = clonedExpression.groups.findIndex((item) => item.key === group.key);
        if (groupIdx >= 0) {
          clonedExpression.groups = [...clonedExpression.groups];
          clonedExpression.groups[groupIdx] = { ...clonedExpression.groups[groupIdx] };
          clonedExpression.groups[groupIdx].rows = [...clonedExpression.groups[groupIdx].rows];
          clonedExpression.groups[groupIdx].rows = clonedExpression.groups[groupIdx].rows.concat(initRow(nextConditionNumber));
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
      clonedExpression.groups = clonedExpression.groups.concat(initGroup(nextConditionNumber, nextConditionNumber + 1));
      setNextConditionNumber(nextConditionNumber + 2);
      setExpression(clonedExpression);
    }

    function handleGroupActionChange(action: AndOr, group: ExpressionGroupType) {
      const clonedExpression = { ...expression };
      const groupIdx = clonedExpression.groups.findIndex((item) => item.key === group.key);
      if (groupIdx >= 0) {
        clonedExpression.groups = [...clonedExpression.groups];
        clonedExpression.groups[groupIdx] = { ...clonedExpression.groups[groupIdx], action };
      }
      setExpression(clonedExpression);
    }

    function handleRowChange(selected: ExpressionConditionRowSelectedItems, row: ExpressionConditionType, group?: ExpressionGroupType) {
      const clonedExpression = { ...expression };
      if (group) {
        const groupIdx = clonedExpression.groups.findIndex((item) => item.key === group.key);
        if (groupIdx >= 0) {
          const rowIdx = clonedExpression.groups[groupIdx].rows.findIndex((item) => item.key === row.key);
          if (rowIdx >= 0) {
            clonedExpression.groups = [...clonedExpression.groups];
            clonedExpression.groups[groupIdx] = { ...clonedExpression.groups[groupIdx] };
            clonedExpression.groups[groupIdx].rows = [...clonedExpression.groups[groupIdx].rows];

            const resourceChanged =
              clonedExpression.groups[groupIdx].rows[rowIdx].selected.resource !== selected.resource ||
              clonedExpression.groups[groupIdx].rows[rowIdx].selected.operator !== selected.operator ||
              clonedExpression.groups[groupIdx].rows[rowIdx].selected.resourceType !== selected.resourceType;

            clonedExpression.groups[groupIdx].rows[rowIdx] = { ...clonedExpression.groups[groupIdx].rows[rowIdx], selected };

            if (resourceChanged) {
              updateResourcesOnRow(clonedExpression.groups[groupIdx].rows[rowIdx], selected);
            }
          }
        }
      } else {
        const rowIdx = clonedExpression.rows.findIndex((item) => item.key === row.key);
        if (rowIdx >= 0) {
          const resourceChanged =
            clonedExpression.rows[rowIdx].selected.resource !== selected.resource ||
            clonedExpression.rows[rowIdx].selected.operator !== selected.operator ||
            clonedExpression.rows[rowIdx].selected.resourceType !== selected.resourceType;

          clonedExpression.rows = [...clonedExpression.rows];
          clonedExpression.rows[rowIdx] = { ...clonedExpression.rows[rowIdx], selected };

          if (resourceChanged) {
            updateResourcesOnRow(clonedExpression.rows[rowIdx], selected);
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
        } catch (ex) {
          logger.warn('Error setting resource type or selected items', ex);
        }
      }
    }

    function handleDeleteRow(row: ExpressionConditionType, group?: ExpressionGroupType) {
      const clonedExpression = { ...expression };
      if (group) {
        const groupIdx = clonedExpression.groups.findIndex((item) => item.key === group.key);
        if (groupIdx >= 0) {
          clonedExpression.groups = [...clonedExpression.groups];
          clonedExpression.groups[groupIdx] = { ...clonedExpression.groups[groupIdx] };
          clonedExpression.groups[groupIdx].rows = clonedExpression.groups[groupIdx].rows.filter((item) => item.key !== row.key);
          // remove group if all rows are deleted
          if (clonedExpression.groups[groupIdx].rows.length === 0) {
            clonedExpression.groups.splice(groupIdx, 1);
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
        onActionChange={handleExpressionActionChange}
        onAddCondition={handleAddCondition}
        onAddGroup={handleAddGroup}
      >
        {expression.rows.map((row, i) => (
          <ExpressionConditionRow
            key={row.key}
            row={i + 1}
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
        ))}
        {expression.groups.map((group, i) => (
          <ExpressionGroup
            key={group.key}
            group={i + 1}
            parentAction={expression.action}
            onActionChange={(andOr) => handleGroupActionChange(andOr, group)}
            onAddCondition={() => handleAddCondition(group)}
          >
            {group.rows.map((row, k) => (
              <ExpressionConditionRow
                key={row.key}
                group={i + 1}
                row={k + 1}
                resourceTypes={row.resourceTypes}
                resourceType={row.resourceType}
                resourceSelectItems={row.resourceSelectItems}
                AndOr={group.action}
                resourceLabel={resourceLabel}
                resourceHelpText={resourceHelpText}
                operatorLabel={operatorLabel}
                operatorHelpText={operatorHelpText}
                valueLabel={valueLabel}
                valueLabelHelpText={valueLabelHelpText}
                resources={resources}
                operators={operators}
                selected={row.selected}
                disableValueForOperators={disableValueForOperators}
                onChange={(selected) => handleRowChange(selected, row, group)}
                onDelete={() => handleDeleteRow(row, group)}
              ></ExpressionConditionRow>
            ))}
          </ExpressionGroup>
        ))}
      </Expression>
    );
  }
);

export default ExpressionContainer;
