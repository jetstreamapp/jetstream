import { TITLES } from '@jetstream/shared/constants';
import { useTitle } from '@jetstream/shared/ui-utils';
import { AnalysisToolsPaywall } from '@jetstream/ui-core';
import { analysisToolsAccessState } from '@jetstream/ui/app-state';
import { useAtomValue } from 'jotai';
import { FunctionComponent } from 'react';
import { Outlet } from 'react-router-dom';

/** Route shell for **Data analysis** (field usage). Paid-only — see {@link analysisToolsAccessState}. */
export const DataAnalysis: FunctionComponent = () => {
  useTitle(TITLES.DATA_ANALYSIS);
  const { hasAnalysisToolsAccess } = useAtomValue(analysisToolsAccessState);
  if (!hasAnalysisToolsAccess) {
    return <AnalysisToolsPaywall featureLabel="Field Usage Analysis" />;
  }
  return <Outlet />;
};

export default DataAnalysis;
