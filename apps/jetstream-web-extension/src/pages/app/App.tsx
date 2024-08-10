/* eslint-disable no-restricted-globals */
import { AnonymousApex } from '@jetstream/feature/anon-apex';
import { AutomationControl, AutomationControlEditor, AutomationControlSelection } from '@jetstream/feature/automation-control';
import { CreateFields, CreateFieldsSelection, CreateObjectAndFields } from '@jetstream/feature/create-object-and-fields';
import { DebugLogViewer } from '@jetstream/feature/debug-log-viewer';
import { DeployMetadata, DeployMetadataDeployment, DeployMetadataSelection } from '@jetstream/feature/deploy';
import { FormulaEvaluator } from '@jetstream/feature/formula-evaluator';
import { LoadRecords } from '@jetstream/feature/load-records';
import { LoadRecordsMultiObject } from '@jetstream/feature/load-records-multi-object';
import { ManagePermissions, ManagePermissionsEditor, ManagePermissionsSelection } from '@jetstream/feature/manage-permissions';
import { PlatformEventMonitor } from '@jetstream/feature/platform-event-monitor';
import { Query, QueryBuilder, QueryResults } from '@jetstream/feature/query';
import { SalesforceApi } from '@jetstream/feature/salesforce-api';
import { SObjectExport } from '@jetstream/feature/sobject-export';
import { MassUpdateRecords, MassUpdateRecordsDeployment, MassUpdateRecordsSelection } from '@jetstream/feature/update-records';
import { appActionObservable, AppActionTypes } from '@jetstream/shared/ui-utils';
import { APP_ROUTES, AppHome, AppLoading, ErrorBoundaryFallback, HeaderNavbar } from '@jetstream/ui-core';
import { initAndRenderReact } from '@jetstream/web-extension-utils';
import { Suspense, useEffect } from 'react';
import { ErrorBoundary } from 'react-error-boundary';
import { Navigate, Route, Routes, useNavigate } from 'react-router-dom';
import { AppWrapper } from '../../core/AppWrapper';
import '../../utils/monaco-loader';

initAndRenderReact(
  <AppWrapper>
    <App />
  </AppWrapper>
);

const featureFlags = new Set<string>();
const pageUrl = new URL(location.href);
const searchParams = pageUrl.searchParams;
const url = searchParams.get('url');
const action = searchParams.get('action') as AppActionTypes | undefined;
const actionValue = searchParams.get('actionValue');

searchParams.delete('url');
searchParams.delete('action');
searchParams.delete('actionValue');

window.history.replaceState({}, '', pageUrl);

export function App() {
  const navigate = useNavigate();

  useEffect(() => {
    if (url) {
      navigate(decodeURIComponent(url));
    } else if (action === 'VIEW_RECORD' && actionValue) {
      appActionObservable.next({ action, payload: { recordId: actionValue } });
    } else if (action === 'EDIT_RECORD' && actionValue) {
      appActionObservable.next({ action, payload: { recordId: actionValue } });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div>
      <HeaderNavbar
        userProfile={undefined}
        featureFlags={featureFlags}
        isChromeExtension
        // unavailableRoutes={unavailableRoutesDefault}
        // orgsDropdown={<OrgPreview selectedOrg={selectedOrg} />}
        // userProfile={userProfile}
        // featureFlags={featureFlags}
      />
      <div className="app-container slds-p-horizontal_xx-small slds-p-vertical_xx-small" data-testid="content">
        <Suspense fallback={<AppLoading />}>
          <ErrorBoundary FallbackComponent={ErrorBoundaryFallback}>
            <Routes>
              <Route path={APP_ROUTES.HOME.ROUTE} element={<AppHome />} />
              <Route path={APP_ROUTES.QUERY.ROUTE} element={<Query />}>
                <Route index element={<QueryBuilder />} />
                <Route path="results" element={<QueryResults />} />
                <Route path="*" element={<Navigate to=".." />} />
              </Route>

              <Route path="*" element={<Navigate to={APP_ROUTES.HOME.ROUTE} />} />
              <Route path={APP_ROUTES.LOAD.ROUTE} element={<LoadRecords featureFlags={featureFlags} />} />
              <Route path={APP_ROUTES.LOAD_MULTIPLE.ROUTE} element={<LoadRecordsMultiObject featureFlags={featureFlags} />} />
              <Route path={APP_ROUTES.AUTOMATION_CONTROL.ROUTE} element={<AutomationControl />}>
                <Route index element={<AutomationControlSelection />} />
                <Route path="editor" element={<AutomationControlEditor />} />
                <Route path="*" element={<Navigate to=".." />} />
              </Route>
              <Route path={APP_ROUTES.PERMISSION_MANAGER.ROUTE} element={<ManagePermissions />}>
                <Route index element={<ManagePermissionsSelection />} />
                <Route path="editor" element={<ManagePermissionsEditor />} />
                <Route path="*" element={<Navigate to=".." />} />
              </Route>
              <Route path={APP_ROUTES.DEPLOY_METADATA.ROUTE} element={<DeployMetadata />}>
                <Route index element={<DeployMetadataSelection />} />
                <Route path="deploy" element={<DeployMetadataDeployment />} />
                <Route path="*" element={<Navigate to=".." />} />
              </Route>
              <Route path={APP_ROUTES.CREATE_FIELDS.ROUTE} element={<CreateObjectAndFields />}>
                <Route index element={<CreateFieldsSelection />} />
                <Route path="configurator" element={<CreateFields />} />
                <Route path="*" element={<Navigate to=".." />} />
              </Route>
              <Route path={APP_ROUTES.FORMULA_EVALUATOR.ROUTE} element={<FormulaEvaluator />} />
              <Route path={APP_ROUTES.LOAD_MASS_UPDATE.ROUTE} element={<MassUpdateRecords />}>
                <Route index element={<MassUpdateRecordsSelection />} />
                <Route path="deployment" element={<MassUpdateRecordsDeployment />} />
                <Route path="*" element={<Navigate to=".." />} />
              </Route>
              <Route path={APP_ROUTES.ANON_APEX.ROUTE} element={<AnonymousApex />} />
              <Route path={APP_ROUTES.SALESFORCE_API.ROUTE} element={<SalesforceApi />} />
              <Route path={APP_ROUTES.DEBUG_LOG_VIEWER.ROUTE} element={<DebugLogViewer />} />
              <Route path={APP_ROUTES.PLATFORM_EVENT_MONITOR.ROUTE} element={<PlatformEventMonitor />} />
              <Route path={APP_ROUTES.OBJECT_EXPORT.ROUTE} element={<SObjectExport />} />
            </Routes>
            {/* <Route path={APP_ROUTES.SETTINGS.ROUTE} element={<Settings featureFlags={featureFlags} userProfile={userProfile} />} /> */}
          </ErrorBoundary>
        </Suspense>
      </div>
    </div>
  );
}
