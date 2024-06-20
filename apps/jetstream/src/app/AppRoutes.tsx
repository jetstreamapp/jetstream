import { Maybe, UserProfileUi } from '@jetstream/types';
import { useEffect } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import lazy from './components/core/LazyLoad';
import { APP_ROUTES } from './components/core/app-routes';
import { AppHome } from './components/home/AppHome';
import OrgSelectionRequired from './components/orgs/OrgSelectionRequired';

const LoadRecords = lazy(() => import('./components/load-records/LoadRecords'));
const LoadRecordsMultiObject = lazy(() => import('./components/load-records-multi-object/LoadRecordsMultiObject'));

const Query = lazy(() => import('@jetstream/feature/query').then((module) => ({ default: module.Query })));
const QueryBuilder = lazy(() => import('@jetstream/feature/query').then((module) => ({ default: module.QueryBuilder })));
const QueryResults = lazy(() => import('@jetstream/feature/query').then((module) => ({ default: module.QueryResults })));

const AutomationControl = lazy(() => import('./components/automation-control/AutomationControl'));
const AutomationControlSelection = lazy(() => import('./components/automation-control/AutomationControlSelection'));
const AutomationControlEditor = lazy(() => import('./components/automation-control/AutomationControlEditor'));

const ManagePermissions = lazy(() => import('./components/manage-permissions/ManagePermissions'));
const ManagePermissionsSelection = lazy(() => import('./components/manage-permissions/ManagePermissionsSelection'));
const ManagePermissionsEditor = lazy(() => import('./components/manage-permissions/ManagePermissionsEditor'));

const DeployMetadata = lazy(() => import('./components/deploy/DeployMetadata'));
const DeployMetadataSelection = lazy(() => import('./components/deploy/DeployMetadataSelection'));
const DeployMetadataDeployment = lazy(() => import('./components/deploy/DeployMetadataDeployment'));

const CreateObjectAndFields = lazy(() => import('./components/create-object-and-fields/CreateObjectAndFields'));
const CreateFieldsSelection = lazy(() => import('./components/create-object-and-fields/CreateFieldsSelection'));
const CreateFields = lazy(() => import('./components/create-object-and-fields/CreateFields'));

const FormulaEvaluator = lazy(() => import('./components/formula-evaluator/FormulaEvaluator'));

const MassUpdateRecords = lazy(() => import('./components/update-records/MassUpdateRecords'));
const MassUpdateRecordsSelection = lazy(() => import('./components/update-records/selection/MassUpdateRecordsSelection'));
const MassUpdateRecordsDeployment = lazy(() => import('./components/update-records/deployment/MassUpdateRecordsDeployment'));

const AnonymousApex = lazy(() => import('./components/anonymous-apex/AnonymousApex'));

const SalesforceApi = lazy(() => import('./components/salesforce-api/SalesforceApi'));

const DebugLogViewer = lazy(() => import('./components/debug-log-viewer/DebugLogViewer'));

const SObjectExport = lazy(() => import('./components/sobject-export/SObjectExport'));

const PlatformEventMonitor = lazy(() => import('./components/platform-event-monitor/PlatformEventMonitor'));

const Feedback = lazy(() => import('./components/feedback/Feedback'));

const Settings = lazy(() => import('./components/settings/Settings'));

export interface AppRoutesProps {
  featureFlags: Set<string>;
  userProfile: Maybe<UserProfileUi>;
}

export const AppRoutes = ({ featureFlags, userProfile }: AppRoutesProps) => {
  const location = useLocation();

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
      <Route path={APP_ROUTES.HOME.ROUTE} element={<AppHome />} />
      <Route
        path={APP_ROUTES.QUERY.ROUTE}
        element={
          <OrgSelectionRequired>
            <Query />
          </OrgSelectionRequired>
        }
      >
        <Route index element={<QueryBuilder />} />
        <Route path="results" element={<QueryResults />} />
        <Route path="*" element={<Navigate to=".." />} />
      </Route>
      <Route
        path={APP_ROUTES.LOAD.ROUTE}
        element={
          <OrgSelectionRequired>
            <LoadRecords featureFlags={featureFlags} />
          </OrgSelectionRequired>
        }
      />
      <Route
        path={APP_ROUTES.LOAD_MULTIPLE.ROUTE}
        element={
          <OrgSelectionRequired>
            <LoadRecordsMultiObject featureFlags={featureFlags} />
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
      <Route path={APP_ROUTES.SETTINGS.ROUTE} element={<Settings featureFlags={featureFlags} userProfile={userProfile} />} />
      <Route path="*" element={<Navigate to={APP_ROUTES.HOME.ROUTE} />} />
    </Routes>
  );
};
