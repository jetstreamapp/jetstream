import { TITLES } from '@jetstream/shared/constants';
import { APP_ROUTES } from '@jetstream/shared/ui-router';
import { useTitle } from '@jetstream/shared/ui-utils';
import { AnalysisToolsPaywall } from '@jetstream/ui-core';
import { analysisToolsAccessState, useFeatureFlag } from '@jetstream/ui/app-state';
import { useAtomValue } from 'jotai';
import { FunctionComponent } from 'react';
import { Navigate, Outlet } from 'react-router-dom';

/**
 * Route shell for **Data analysis** (field usage). Gated by the `analysis-tools` rollout flag (redirects
 * home when disabled); when enabled it is paid-only — see {@link analysisToolsAccessState}.
 */
export const DataAnalysis: FunctionComponent = () => {
  useTitle(TITLES.DATA_ANALYSIS);
  const analysisToolsEnabled = useFeatureFlag('analysis-tools');
  const { hasAnalysisToolsAccess } = useAtomValue(analysisToolsAccessState);
  if (!analysisToolsEnabled) {
    return <Navigate to={APP_ROUTES.HOME.ROUTE} replace />;
  }
  if (!hasAnalysisToolsAccess) {
    return <AnalysisToolsPaywall featureLabel="Field Usage Analysis" />;
  }
  return <Outlet />;
};

export default DataAnalysis;
