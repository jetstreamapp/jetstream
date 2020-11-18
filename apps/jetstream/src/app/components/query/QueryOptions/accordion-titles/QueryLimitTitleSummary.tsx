/* eslint-disable @typescript-eslint/no-unused-vars */
import { formatNumber } from '@jetstream/shared/ui-utils';
import { Badge } from '@jetstream/ui';
import React, { Fragment, FunctionComponent } from 'react';
import { ErrorBoundary } from 'react-error-boundary';
import { useRecoilValue } from 'recoil';
import * as fromQueryState from '../../query.state';

// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface QueryLimitTitleSummaryProps {}

export const QueryLimitTitleSummary: FunctionComponent<QueryLimitTitleSummaryProps> = () => {
  const limit = useRecoilValue(fromQueryState.queryLimit);
  const skip = useRecoilValue(fromQueryState.queryLimitSkip);

  return (
    <ErrorBoundary fallbackRender={() => <Fragment />}>
      {limit && <Badge className="slds-m-left_x-small">Limit {formatNumber(Number(limit))}</Badge>}
      {skip && <Badge className="slds-m-left_x-small">Skip {formatNumber(Number(skip))}</Badge>}
    </ErrorBoundary>
  );
};

export default QueryLimitTitleSummary;
