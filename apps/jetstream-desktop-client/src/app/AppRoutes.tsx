import { APP_ROUTES } from '@jetstream/shared/ui-router';
import { AppHome, Feedback, OrgSelectionRequired as OrgSelectionRequiredExternal } from '@jetstream/ui-core';
import { useEffect } from 'react';
import { Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { environment } from '../environments/environment';
import lazy from './components/core/LazyLoad';
import { addDesktopOrg } from './utils/utils';

const Organizations = lazy(() => import('@jetstream/feature/orgGroups').then((module) => ({ default: module.OrgGroups })));

const LoadRecords = lazy(() => import('@jetstream/feature/load-records').then((module) => ({ default: module.LoadRecords })));
const LoadRecordsMultiObject = lazy(() =>
  import('@jetstream/feature/load-records-multi-object').then((module) => ({ default: module.LoadRecordsMultiObject })),
);
const CreateRecords = lazy(() => import('@jetstream/feature/create-records').then((module) => ({ default: module.CreateRecords })));

const Query = lazy(() => import('@jetstream/feature/query').then((module) => ({ default: module.Query })));
const QueryBuilder = lazy(() => import('@jetstream/feature/query').then((module) => ({ default: module.QueryBuilder })));
const QueryResults = lazy(() => import('@jetstream/feature/query').then((module) => ({ default: module.QueryResults })));

const AutomationControl = lazy(() =>
  import('@jetstream/feature/automation-control').then((module) => ({ default: module.AutomationControl })),
);
const AutomationControlEditor = lazy(() =>
  import('@jetstream/feature/automation-control').then((module) => ({ default: module.AutomationControlEditor })),
);
const AutomationControlSelection = lazy(() =>
  import('@jetstream/feature/automation-control').then((module) => ({ default: module.AutomationControlSelection })),
);

const ManagePermissions = lazy(() =>
  import('@jetstream/feature/manage-permissions').then((module) => ({ default: module.ManagePermissions })),
);
const ManagePermissionsSelection = lazy(() =>
  import('@jetstream/feature/manage-permissions').then((module) => ({ default: module.ManagePermissionsSelection })),
);
const ManagePermissionsEditor = lazy(() =>
  import('@jetstream/feature/manage-permissions').then((module) => ({ default: module.ManagePermissionsEditor })),
);

const DeployMetadata = lazy(() => import('@jetstream/feature/deploy').then((module) => ({ default: module.DeployMetadata })));
const DeployMetadataSelection = lazy(() =>
  import('@jetstream/feature/deploy').then((module) => ({ default: module.DeployMetadataSelection })),
);
const DeployMetadataDeployment = lazy(() =>
  import('@jetstream/feature/deploy').then((module) => ({ default: module.DeployMetadataDeployment })),
);

const CreateObjectAndFields = lazy(() =>
  import('@jetstream/feature/create-object-and-fields').then((module) => ({ default: module.CreateObjectAndFields })),
);
const CreateFieldsSelection = lazy(() =>
  import('@jetstream/feature/create-object-and-fields').then((module) => ({ default: module.CreateFieldsSelection })),
);
const CreateFields = lazy(() => import('@jetstream/feature/create-object-and-fields').then((module) => ({ default: module.CreateFields })));

const FormulaEvaluator = lazy(() =>
  import('@jetstream/feature/formula-evaluator').then((module) => ({ default: module.FormulaEvaluator })),
);

const RecordTypeManager = lazy(() =>
  import('@jetstream/feature/record-type-manager').then((module) => ({ default: module.RecordTypeManager })),
);
const RecordTypeManagerSelection = lazy(() =>
  import('@jetstream/feature/record-type-manager').then((module) => ({ default: module.RecordTypeManagerSelection })),
);
const RecordTypeManagerEditor = lazy(() =>
  import('@jetstream/feature/record-type-manager').then((module) => ({ default: module.RecordTypeManagerEditor })),
);

const MassUpdateRecords = lazy(() => import('@jetstream/feature/update-records').then((module) => ({ default: module.MassUpdateRecords })));
const MassUpdateRecordsSelection = lazy(() =>
  import('@jetstream/feature/update-records').then((module) => ({ default: module.MassUpdateRecordsSelection })),
);
const MassUpdateRecordsDeployment = lazy(() =>
  import('@jetstream/feature/update-records').then((module) => ({ default: module.MassUpdateRecordsDeployment })),
);

const AnonymousApex = lazy(() => import('@jetstream/feature/anon-apex').then((module) => ({ default: module.AnonymousApex })));

const SalesforceApi = lazy(() => import('@jetstream/feature/salesforce-api').then((module) => ({ default: module.SalesforceApi })));

const DebugLogViewer = lazy(() => import('@jetstream/feature/debug-log-viewer').then((module) => ({ default: module.DebugLogViewer })));

const SObjectExport = lazy(() => import('@jetstream/feature/sobject-export').then((module) => ({ default: module.SObjectExport })));

const PlatformEventMonitor = lazy(() =>
  import('@jetstream/feature/platform-event-monitor').then((module) => ({ default: module.PlatformEventMonitor })),
);

const Settings = lazy(() => import('./components/settings/Settings'));

// Wrapper to avoid having to define this everywhere
const OrgSelectionRequired = ({ children }: { children: React.ReactNode }) => (
  <OrgSelectionRequiredExternal onAddOrgHandlerFn={addDesktopOrg}>{children}</OrgSelectionRequiredExternal>
);

export const AppRoutes = () => {
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    if (window.electronAPI?.onOpenSettings) {
      const handle = () => {
        navigate(APP_ROUTES.SETTINGS.ROUTE);
      };
      const unsubscribe = window.electronAPI.onOpenSettings(handle);
      return () => {
        if (typeof unsubscribe === 'function') {
          unsubscribe();
        }
      };
    }
  }, [navigate]);

  // Preload sub-pages if user is on parent page
  useEffect(() => {
    if (location.pathname.includes('/query')) {
      QueryResults.preload();
    } else if (location.pathname.includes('/automation-control')) {
      AutomationControlEditor.preload();
    } else if (location.pathname.includes('/permissions-manager')) {
      ManagePermissionsEditor.preload();
    } else if (location.pathname.includes('/deploy-metadata')) {
      DeployMetadataDeployment.preload();
    } else if (location.pathname.includes('/create-fields')) {
      CreateFields.preload();
    } else if (location.pathname.includes('/update-records')) {
      MassUpdateRecordsDeployment.preload();
    }
  }, [location]);

  return (
    <Routes>
      {/* This is just here to allow testing the error page without having a real error - can uncomment for testing */}
      {/* <Route path={'/error'} element={<ErrorBoundaryFallback error={new Error('test')} resetErrorBoundary={NOOP} />} /> */}
      <Route path={APP_ROUTES.HOME.ROUTE} element={<AppHome showAlternativeAppFormats={environment.BILLING_ENABLED} />} />
      <Route
        path={APP_ROUTES.QUERY.ROUTE}
        element={
          // TODO: need to do this for every route
          <OrgSelectionRequired>
            <Query />
          </OrgSelectionRequired>
        }
      >
        <Route index element={<QueryBuilder />} />
        <Route path="results" element={<QueryResults />} />
        <Route path="*" element={<Navigate to=".." />} />
      </Route>
      <Route path={APP_ROUTES.SALESFORCE_ORG_GROUPS.ROUTE} element={<Organizations onAddOrgHandlerFn={addDesktopOrg} />} />
      <Route
        path={APP_ROUTES.LOAD.ROUTE}
        element={
          <OrgSelectionRequired>
            <LoadRecords />
          </OrgSelectionRequired>
        }
      />
      <Route
        path={APP_ROUTES.LOAD_MULTIPLE.ROUTE}
        element={
          <OrgSelectionRequired>
            <LoadRecordsMultiObject />
          </OrgSelectionRequired>
        }
      />
      <Route
        path={APP_ROUTES.LOAD_CREATE_RECORD.ROUTE}
        element={
          <OrgSelectionRequired>
            <CreateRecords />
          </OrgSelectionRequired>
        }
      />
      <Route
        path={APP_ROUTES.AUTOMATION_CONTROL.ROUTE}
        element={
          <OrgSelectionRequired>
            <AutomationControl />
          </OrgSelectionRequired>
        }
      >
        <Route index element={<AutomationControlSelection />} />
        <Route path="editor" element={<AutomationControlEditor />} />
        <Route path="*" element={<Navigate to=".." />} />
      </Route>
      <Route
        path={APP_ROUTES.PERMISSION_MANAGER.ROUTE}
        element={
          <OrgSelectionRequired>
            <ManagePermissions />
          </OrgSelectionRequired>
        }
      >
        <Route index element={<ManagePermissionsSelection />} />
        <Route path="editor" element={<ManagePermissionsEditor />} />
        <Route path="*" element={<Navigate to=".." />} />
      </Route>
      <Route
        path={APP_ROUTES.DEPLOY_METADATA.ROUTE}
        element={
          <OrgSelectionRequired>
            <DeployMetadata />
          </OrgSelectionRequired>
        }
      >
        <Route index element={<DeployMetadataSelection />} />
        <Route path="deploy" element={<DeployMetadataDeployment />} />
        <Route path="*" element={<Navigate to=".." />} />
      </Route>
      <Route
        path={APP_ROUTES.CREATE_FIELDS.ROUTE}
        element={
          <OrgSelectionRequired>
            <CreateObjectAndFields />
          </OrgSelectionRequired>
        }
      >
        <Route index element={<CreateFieldsSelection />} />
        <Route path="configurator" element={<CreateFields />} />
        <Route path="*" element={<Navigate to=".." />} />
      </Route>
      <Route
        path={APP_ROUTES.FORMULA_EVALUATOR.ROUTE}
        element={
          <OrgSelectionRequired>
            <FormulaEvaluator />
          </OrgSelectionRequired>
        }
      />
      <Route
        path={APP_ROUTES.RECORD_TYPE_MANAGER.ROUTE}
        element={
          <OrgSelectionRequired>
            <RecordTypeManager />
          </OrgSelectionRequired>
        }
      >
        <Route index element={<RecordTypeManagerSelection />} />
        <Route path="editor" element={<RecordTypeManagerEditor />} />
        <Route path="*" element={<Navigate to=".." />} />
      </Route>
      <Route
        path={APP_ROUTES.LOAD_MASS_UPDATE.ROUTE}
        element={
          <OrgSelectionRequired>
            <MassUpdateRecords />
          </OrgSelectionRequired>
        }
      >
        <Route index element={<MassUpdateRecordsSelection />} />
        <Route path="deployment" element={<MassUpdateRecordsDeployment />} />
        <Route path="*" element={<Navigate to=".." />} />
      </Route>
      <Route
        path={APP_ROUTES.ANON_APEX.ROUTE}
        element={
          <OrgSelectionRequired>
            <AnonymousApex />
          </OrgSelectionRequired>
        }
      />
      <Route
        path={APP_ROUTES.SALESFORCE_API.ROUTE}
        element={
          <OrgSelectionRequired>
            <SalesforceApi />
          </OrgSelectionRequired>
        }
      />
      <Route
        path={APP_ROUTES.DEBUG_LOG_VIEWER.ROUTE}
        element={
          <OrgSelectionRequired>
            <DebugLogViewer />
          </OrgSelectionRequired>
        }
      />
      <Route
        path={APP_ROUTES.PLATFORM_EVENT_MONITOR.ROUTE}
        element={
          <OrgSelectionRequired>
            <PlatformEventMonitor />
          </OrgSelectionRequired>
        }
      />
      <Route
        path={APP_ROUTES.OBJECT_EXPORT.ROUTE}
        element={
          <OrgSelectionRequired>
            <SObjectExport />
          </OrgSelectionRequired>
        }
      />
      <Route path={APP_ROUTES.FEEDBACK_SUPPORT.ROUTE} element={<Feedback />} />
      <Route path={APP_ROUTES.SETTINGS.ROUTE} element={<Settings />} />
      <Route path="*" element={<Navigate to={APP_ROUTES.HOME.ROUTE} />} />
    </Routes>
  );
};
