import { UserProfileUi } from '@jetstream/types';
import lazy from './components/core/LazyLoad';
import React, { useEffect } from 'react';

import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import OrgSelectionRequired from './components/orgs/OrgSelectionRequired';

const LoadRecords = lazy(() => import('./components/load-records/LoadRecords'));
const LoadRecordsMultiObject = lazy(() => import('./components/load-records-multi-object/LoadRecordsMultiObject'));

const Query = lazy(() => import('./components/query/Query'));
const QueryBuilder = lazy(() => import('./components/query/QueryBuilder/QueryBuilder'));
const QueryResults = lazy(() => import('./components/query/QueryResults/QueryResults'));

const AutomationControl = lazy(() => import('./components/automation-control/AutomationControl'));
const AutomationControlSelection = lazy(() => import('./components/automation-control/AutomationControlSelection'));
const AutomationControlEditor = lazy(() => import('./components/automation-control/AutomationControlEditor'));

const ManagePermissions = lazy(() => import('./components/manage-permissions/ManagePermissions'));
const ManagePermissionsEditor = lazy(() => import('./components/manage-permissions/ManagePermissionsEditor'));
const ManagePermissionsSelection = lazy(() => import('./components/manage-permissions/ManagePermissionsSelection'));

const DeployMetadata = lazy(() => import('./components/deploy/DeployMetadata'));
const DeployMetadataSelection = lazy(() => import('./components/deploy/DeployMetadataSelection'));
const DeployMetadataDeployment = lazy(() => import('./components/deploy/DeployMetadataDeployment'));

const CreateObjectAndFields = lazy(() => import('./components/create-object-and-fields/CreateObjectAndFields'));
const CreateFieldsSelection = lazy(() => import('./components/create-object-and-fields/CreateFieldsSelection'));
const CreateFields = lazy(() => import('./components/create-object-and-fields/CreateFields'));

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
  userProfile: UserProfileUi;
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
    } else if (location.pathname.includes('/deploy-sobject-metadata')) {
      CreateFields.preload();
    } else if (location.pathname.includes('/update-records')) {
      MassUpdateRecordsDeployment.preload();
    }
  }, [location]);

  return (
    <Routes>
      <Route
        path="/query"
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
        path="/load"
        element={
          <OrgSelectionRequired>
            <LoadRecords featureFlags={featureFlags} />
          </OrgSelectionRequired>
        }
      />
      <Route
        path="/load-multiple-objects"
        element={
          <OrgSelectionRequired>
            <LoadRecordsMultiObject featureFlags={featureFlags} />
          </OrgSelectionRequired>
        }
      />
      <Route
        path="/automation-control"
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
        path="/permissions-manager"
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
        path="/deploy-metadata"
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
        path="/deploy-sobject-metadata"
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
        path="/update-records"
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
        path="/apex"
        element={
          <OrgSelectionRequired>
            <AnonymousApex />
          </OrgSelectionRequired>
        }
      />
      <Route
        path="/salesforce-api"
        element={
          <OrgSelectionRequired>
            <SalesforceApi />
          </OrgSelectionRequired>
        }
      />
      <Route
        path="/debug-logs"
        element={
          <OrgSelectionRequired>
            <DebugLogViewer />
          </OrgSelectionRequired>
        }
      />
      <Route
        path="/platform-event-monitor"
        element={
          <OrgSelectionRequired>
            <PlatformEventMonitor />
          </OrgSelectionRequired>
        }
      />
      <Route
        path="/object-export"
        element={
          <OrgSelectionRequired>
            <SObjectExport />
          </OrgSelectionRequired>
        }
      />
      <Route path="/feedback" element={<Feedback userProfile={userProfile} />} />
      <Route path="/settings" element={<Settings featureFlags={featureFlags} userProfile={userProfile} />} />
      <Route path="*" element={<Navigate to="/query" />} />
    </Routes>
  );
};
