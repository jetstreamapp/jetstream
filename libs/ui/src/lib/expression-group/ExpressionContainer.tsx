import {
  AndOr,
  ExpressionConditionRowSelectedItems,
  ExpressionConditionType,
  ExpressionGroupType,
  ExpressionType,
  ListItem,
  ListItemGroup,
} from '@jetstream/types';
import React, { FunctionComponent, useEffect, useState } from 'react';
import Expression from './Expression';
import ExpressionConditionRow from './ExpressionConditionRow';
import ExpressionGroup from './ExpressionGroup';

export interface ExpressionContainerProps {
  title?: string;
  actionLabel: string;
  resourceLabel?: string;
  operatorLabel?: string;
  valueLabel?: string;
  resources: ListItemGroup[];
  operators: ListItem[];
  expressionInitValue?: ExpressionType;
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
    selected: {
      resource: null,
      operator: null,
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

export const ExpressionContainer: FunctionComponent<ExpressionContainerProps> = ({
  title,
  actionLabel,
  resourceLabel,
  operatorLabel,
  resources,
  operators,
  expressionInitValue,
  onChange,
}) => {
  const [expression, setExpression] = useState<ExpressionType>(initExpression(expressionInitValue));
  const [nextConditionNumber, setNextConditionNumber] = useState<number>(1);

  useEffect(() => {
    if (expression) {
      onChange(expression);
    }
  }, [onChange, expression]);

  function handleExpressionActionChange(action: AndOr) {
    expression.action = action;
    setExpression({ ...expression });
  }

  function handleAddCondition(group?: ExpressionGroupType) {
    if (group) {
      const foundGroup = expression.groups.find((item) => item.key === group.key);
      if (foundGroup) {
        foundGroup.rows = foundGroup.rows.concat(initRow(nextConditionNumber));
      }
    } else {
      expression.rows = expression.rows.concat(initRow(nextConditionNumber));
    }
    setNextConditionNumber(nextConditionNumber + 1);
    setExpression({ ...expression });
  }

  function handleAddGroup() {
    expression.groups = expression.groups.concat(initGroup(nextConditionNumber, nextConditionNumber + 1));
    setNextConditionNumber(nextConditionNumber + 2);
    setExpression({ ...expression });
  }

  function handleGroupActionChange(action: AndOr, group: ExpressionGroupType) {
    const foundGroup = expression.groups.find((item) => item.key === group.key);
    if (foundGroup) {
      foundGroup.action = action;
    }
    setExpression({ ...expression });
  }

  function handleRowChange(selected: ExpressionConditionRowSelectedItems, row: ExpressionConditionType, group?: ExpressionGroupType) {
    if (group) {
      const foundGroup = expression.groups.find((item) => item.key === group.key);
      if (foundGroup) {
        const foundRow = foundGroup.rows.find((item) => item.key === row.key);
        if (foundRow) {
          foundRow.selected = selected;
        }
      }
    } else {
      const foundRow = expression.rows.find((item) => item.key === row.key);
      if (foundRow) {
        foundRow.selected = selected;
      }
    }
    setExpression({ ...expression });
  }

  function handleDeleteRow(row: ExpressionConditionType, group?: ExpressionGroupType) {
    if (group) {
      const foundGroup = expression.groups.find((item) => item.key === group.key);
      if (foundGroup) {
        foundGroup.rows = foundGroup.rows.filter((item) => item.key !== row.key);
        // remove group if all rows are deleted
        if (foundGroup.rows.length === 0) {
          expression.groups = expression.groups.filter((item) => item !== foundGroup);
        }
      }
    } else {
      expression.rows = expression.rows.filter((item) => item.key !== row.key);
      if (expression.rows.length === 0) {
        // ensure at least one row exists
        expression.rows = [initRow(nextConditionNumber)];
        setNextConditionNumber(nextConditionNumber + 1);
      }
    }
    setExpression({ ...expression });
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
          resourceLabel={resourceLabel}
          operatorLabel={operatorLabel}
          valueLabel={operatorLabel}
          AndOr={expression.action}
          resources={resources}
          operators={operators}
          selected={row.selected}
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
              AndOr={group.action}
              resourceLabel={resourceLabel}
              operatorLabel={operatorLabel}
              valueLabel={operatorLabel}
              resources={resources}
              operators={operators}
              selected={row.selected}
              onChange={(selected) => handleRowChange(selected, row, group)}
              onDelete={() => handleDeleteRow(row, group)}
            ></ExpressionConditionRow>
          ))}
        </ExpressionGroup>
      ))}
    </Expression>
  );
};

export default ExpressionContainer;
