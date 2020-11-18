/* eslint-disable @typescript-eslint/no-unused-vars */
import { formatNumber } from '@jetstream/shared/ui-utils';
import { truncate } from '@jetstream/shared/utils';
import { ExpressionConditionType } from '@jetstream/types';
import { Badge } from '@jetstream/ui';
import React, { Fragment, FunctionComponent } from 'react';
import { ErrorBoundary } from 'react-error-boundary';
import { useRecoilValue } from 'recoil';
import * as fromQueryState from '../../query.state';

// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface QueryFilterTitleSummaryProps {}

function hasValue(row: ExpressionConditionType) {
  const hasValue = Array.isArray(row.selected.value) ? row.selected.value.length : !!row.selected.value;
  return (
    row.selected.operator &&
    row.selected.resource &&
    (hasValue || row.selected.operator === 'isNull' || row.selected.operator === 'isNotNull')
  );
}

function getFilterLabel(row: ExpressionConditionType) {
  let operatorString;
  switch (row.selected.operator) {
    case 'eq':
      operatorString = '=';
      break;
    case 'ne':
      operatorString = '!=';
      break;
    case 'lt':
      operatorString = '<';
      break;
    case 'lte':
      operatorString = '<=';
      break;
    case 'gt':
      operatorString = '>';
      break;
    case 'gte':
      operatorString = '>=';
      break;
    case 'contains':
      operatorString = 'contains';
      break;
    case 'doesNotContain':
      operatorString = 'does not contain';
      break;
    case 'startsWith':
      operatorString = 'starts with';
      break;
    case 'doesNotStartWith':
      operatorString = 'does not start with';
      break;
    case 'endsWith':
      operatorString = 'ends with';
      break;
    case 'doesNotEndWith':
      operatorString = 'does not end with';
      break;
    case 'isNull':
      operatorString = 'is null';
      break;
    case 'isNotNull':
      operatorString = 'is not null';
      break;
    case 'in':
      operatorString = 'in';
      break;
    case 'notIn':
      operatorString = 'not in';
      break;
    case 'includes':
      operatorString = 'includes';
      break;
    case 'excludes':
      operatorString = 'excludes';
      break;
    default:
      break;
  }

  let value = row.selected.value;
  switch (row.selected.operator) {
    case 'in':
    case 'notIn':
    case 'includes':
    case 'excludes':
      value = (Array.isArray(value) ? value : value.split('\n')).join(', ');
      break;
    default:
      value = row.selected.value;
      break;
  }
  return (
    <span title={`${row.selected.resource} ${operatorString} ${value}`}>
      {row.selected.resource} <code className="slds-m-horizontal--xx-small">{operatorString}</code>{' '}
      {hasValue(row) ? truncate(value as string, 10) : ''}
    </span>
  );
}

export const QueryFilterTitleSummary: FunctionComponent<QueryFilterTitleSummaryProps> = () => {
  const filters = useRecoilValue(fromQueryState.queryFiltersState);

  const configuredFilters = filters.rows.concat(filters.groups.flatMap((group) => group.rows)).filter(hasValue);
  const beyondDisplayLimit = configuredFilters.length > 3;

  return (
    <ErrorBoundary fallbackRender={() => <Fragment />}>
      {!!configuredFilters.length &&
        !beyondDisplayLimit &&
        configuredFilters.map((filter) => (
          <Badge key={filter.key} className="slds-m-left_x-small slds-truncate">
            {getFilterLabel(filter)}
          </Badge>
        ))}
      {!!beyondDisplayLimit && (
        <Badge className="slds-m-left_x-small slds-truncate">{formatNumber(configuredFilters.length)} Active Filters</Badge>
      )}
    </ErrorBoundary>
  );
};

export default QueryFilterTitleSummary;
