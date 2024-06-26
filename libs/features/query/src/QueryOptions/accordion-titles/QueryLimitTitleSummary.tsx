/* eslint-disable @typescript-eslint/no-unused-vars */
import { formatNumber } from '@jetstream/shared/ui-utils';
import { Badge, Grid, Icon, Tooltip } from '@jetstream/ui';
import { fromQueryState } from '@jetstream/ui-core';
import { Fragment, FunctionComponent } from 'react';
import { ErrorBoundary } from 'react-error-boundary';
import { useRecoilValue } from 'recoil';

// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface QueryLimitTitleSummaryProps {}

export const QueryLimitTitleSummary: FunctionComponent<QueryLimitTitleSummaryProps> = () => {
  const limit = useRecoilValue(fromQueryState.queryLimit);
  const limitOverride = useRecoilValue(fromQueryState.selectQueryLimitHasOverride);
  const skip = useRecoilValue(fromQueryState.queryLimitSkip);

  return (
    <ErrorBoundary fallbackRender={() => <Fragment />}>
      {limit && !limitOverride && <Badge className="slds-m-left_x-small">Limit {formatNumber(Number(limit))}</Badge>}
      {limitOverride && (
        <Grid className="slds-m-left_x-small">
          <Tooltip
            id={`tooltip-limit-warning`}
            content={
              <div>
                For metadata queries, if FullName or Metadata are included in your query, Salesforce only allows one record to be returned.
              </div>
            }
          >
            <Fragment>
              <Badge className="slds-m-left_x-small">Limit 1</Badge>
              <Icon type="utility" icon="warning" className="slds-icon slds-icon-text-warning slds-icon_xx-small slds-m-left_x-small" />
            </Fragment>
          </Tooltip>
        </Grid>
      )}
      {skip && <Badge className="slds-m-left_x-small">Skip {formatNumber(Number(skip))}</Badge>}
    </ErrorBoundary>
  );
};

export default QueryLimitTitleSummary;
