import { formatNumber } from '@jetstream/shared/ui-utils';
import { Badge } from '@jetstream/ui';
import { fromQueryState } from '@jetstream/ui-core';
import { useAtomValue } from 'jotai';
import { Fragment, FunctionComponent } from 'react';
import { ErrorBoundary } from 'react-error-boundary';

export interface QueryFieldFnsTitleSummaryProps {}

export const QueryFieldFnsTitleSummary: FunctionComponent<QueryFieldFnsTitleSummaryProps> = () => {
  const fieldFilterFns = useAtomValue(fromQueryState.fieldFilterFunctions);
  const beyondDisplayLimit = fieldFilterFns.length > 3;

  return (
    // eslint-disable-next-line react/jsx-no-useless-fragment
    <ErrorBoundary fallbackRender={() => <Fragment />}>
      {!!fieldFilterFns.length &&
        !beyondDisplayLimit &&
        fieldFilterFns
          .filter((fieldFn) => fieldFn.selectedField && fieldFn.selectedFunction)
          .map((fieldFn) => (
            <Badge
              key={fieldFn.selectedField?.field}
              className="slds-m-left_x-small slds-truncate"
              title={`${fieldFn.selectedField?.field || ''}${fieldFn.selectedFunction || ''}`}
            >
              {fieldFn.selectedFunction}({fieldFn.selectedField?.field})
            </Badge>
          ))}
      {!!beyondDisplayLimit && (
        <Badge className="slds-m-left_x-small slds-truncate">{formatNumber(fieldFilterFns.length)} Active Field Functions</Badge>
      )}
    </ErrorBoundary>
  );
};

export default QueryFieldFnsTitleSummary;
