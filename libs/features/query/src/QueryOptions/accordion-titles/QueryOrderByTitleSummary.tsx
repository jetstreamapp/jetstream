/* eslint-disable @typescript-eslint/no-unused-vars */
import { formatNumber } from '@jetstream/shared/ui-utils';
import { QueryOrderByClause } from '@jetstream/types';
import { Badge } from '@jetstream/ui';
import { fromQueryState } from '@jetstream/ui-core';
import { Fragment, FunctionComponent } from 'react';
import { ErrorBoundary } from 'react-error-boundary';
import { useRecoilValue } from 'recoil';

// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface QueryOrderByTitleSummaryProps {}

function getOrderByText(orderBy: QueryOrderByClause) {
  let output = `${orderBy.field} ${orderBy.order === 'ASC' ? '(A to Z)' : '(Z to A)'}`;
  if (orderBy.nulls) {
    output += ` Nulls ${orderBy.nulls === 'FIRST' ? 'First' : 'Last'}`;
  }
  return output;
}

export const QueryOrderByTitleSummary: FunctionComponent<QueryOrderByTitleSummaryProps> = () => {
  const orderByClauses = useRecoilValue(fromQueryState.queryOrderByState);
  const beyondDisplayLimit = orderByClauses.length > 3;

  return (
    <ErrorBoundary fallbackRender={() => <Fragment />}>
      {!!orderByClauses.length &&
        !beyondDisplayLimit &&
        orderByClauses
          .filter((orderBy) => orderBy.field)
          .map((orderBy) => (
            <Badge key={orderBy.field} className="slds-m-left_x-small slds-truncate" title={orderBy.fieldLabel || undefined}>
              {getOrderByText(orderBy)}
            </Badge>
          ))}
      {!!beyondDisplayLimit && (
        <Badge className="slds-m-left_x-small slds-truncate">{formatNumber(orderByClauses.length)} Active Order By Clauses</Badge>
      )}
    </ErrorBoundary>
  );
};

export default QueryOrderByTitleSummary;
