import { formatNumber } from '@jetstream/shared/ui-utils';
import { Badge } from '@jetstream/ui';
import { fromQueryState } from '@jetstream/ui-core';
import { Fragment, FunctionComponent } from 'react';
import { ErrorBoundary } from 'react-error-boundary';
import { useAtom, useAtomValue, useSetAtom } from 'jotai';
import { useResetAtom } from 'jotai/utils';

// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface QueryGroupByTitleSummaryProps {}

export const QueryGroupByTitleSummary: FunctionComponent<QueryGroupByTitleSummaryProps> = () => {
  const groupByClauses = useAtomValue(fromQueryState.queryGroupByState);
  const beyondDisplayLimit = groupByClauses.length > 3;

  return (
    // eslint-disable-next-line react/jsx-no-useless-fragment
    <ErrorBoundary fallbackRender={() => <Fragment />}>
      {!!groupByClauses.length &&
        !beyondDisplayLimit &&
        groupByClauses
          .filter((groupBy) => groupBy.field)
          .map((groupBy) => (
            <Badge key={groupBy.field} className="slds-m-left_x-small slds-truncate" title={groupBy.fieldLabel || undefined}>
              {groupBy.function ? (
                <>
                  {groupBy.function}({groupBy.field})
                </>
              ) : (
                groupBy.field
              )}
            </Badge>
          ))}
      {!!beyondDisplayLimit && (
        <Badge className="slds-m-left_x-small slds-truncate">{formatNumber(groupByClauses.length)} Active Group By Clauses</Badge>
      )}
    </ErrorBoundary>
  );
};

export default QueryGroupByTitleSummary;
