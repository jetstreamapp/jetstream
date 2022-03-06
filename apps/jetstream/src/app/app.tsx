import { css } from '@emotion/react';
import { FEATURE_FLAGS } from '@jetstream/shared/constants';
import { hasFeatureFlagAccess } from '@jetstream/shared/ui-utils';
import { UserProfileUi } from '@jetstream/types';
import { ConfirmationServiceProvider } from '@jetstream/ui';
// import { initSocket } from '@jetstream/shared/data';
import { OverlayProvider } from '@react-aria/overlays';
import { lazy, Suspense, useEffect, useState } from 'react';
import { ErrorBoundary } from 'react-error-boundary';
import ModalContainer from 'react-modal-promise';
import { Redirect, Route, RouteComponentProps, Switch } from 'react-router-dom';
import { RecoilRoot } from 'recoil';
import AppInitializer from './components/core/AppInitializer';
import AppStateResetOnOrgChange from './components/core/AppStateResetOnOrgChange';
import AppToast from './components/core/AppToast';
import ErrorBoundaryFallback from './components/core/ErrorBoundaryFallback';
import HeaderNavbar from './components/core/HeaderNavbar';
import LogInitializer from './components/core/LogInitializer';
import './components/core/monaco-loader';
import NotificationsRequestModal from './components/core/NotificationsRequestModal';
import OrgSelectionRequired from './components/orgs/OrgSelectionRequired';
import PlatformEventMonitor from './components/platform-event-monitor/PlatformEventMonitor';

const AutomationControl = lazy(() => import('./components/automation-control/AutomationControl'));
const Feedback = lazy(() => import('./components/feedback/Feedback'));
const LoadRecords = lazy(() => import('./components/load-records/LoadRecords'));
const LoadRecordsMultiObject = lazy(() => import('./components/load-records-multi-object/LoadRecordsMultiObject'));
const Query = lazy(() => import('./components/query/Query'));
const ManagePermissions = lazy(() => import('./components/manage-permissions/ManagePermissions'));
const DeployMetadata = lazy(() => import('./components/deploy/DeployMetadata'));
const CreateObjectAndFields = lazy(() => import('./components/create-object-and-fields/CreateObjectAndFields'));
const AnonymousApex = lazy(() => import('./components/anonymous-apex/AnonymousApex'));
const SalesforceApi = lazy(() => import('./components/salesforce-api/SalesforceApi'));
const DebugLogViewer = lazy(() => import('./components/debug-log-viewer/DebugLogViewer'));
const SObjectExport = lazy(() => import('./components/sobject-export/SObjectExport'));
const Settings = lazy(() => import('./components/settings/Settings'));

interface RouteItem {
  path: string;
  flag?: string;
  render: (props: RouteComponentProps<unknown>) => React.ReactNode;
}

let _userProfile: UserProfileUi;
const _featureFlags: Set<string> = new Set();

const ROUTES: RouteItem[] = [
  {
    path: '/query',
    // flag: FEATURE_FLAGS.QUERY,
    render: () => (
      <OrgSelectionRequired>
        <Query />
      </OrgSelectionRequired>
    ),
  },
  {
    path: '/load',
    // flag: FEATURE_FLAGS.LOAD,
    render: () => (
      <OrgSelectionRequired>
        <LoadRecords featureFlags={_featureFlags} />
      </OrgSelectionRequired>
    ),
  },
  {
    path: '/load-multiple-objects',
    // flag: FEATURE_FLAGS.LOAD_MULTI_OBJ,
    render: () => (
      <OrgSelectionRequired>
        <LoadRecordsMultiObject featureFlags={_featureFlags} />
      </OrgSelectionRequired>
    ),
  },
  {
    path: '/automation-control',
    // flag: FEATURE_FLAGS.AUTOMATION_CONTROL,
    render: () => (
      <OrgSelectionRequired>
        <AutomationControl />
      </OrgSelectionRequired>
    ),
  },
  {
    path: '/permissions-manager',
    // flag: FEATURE_FLAGS.PERMISSION_MANAGER,
    render: () => (
      <OrgSelectionRequired>
        <ManagePermissions />
      </OrgSelectionRequired>
    ),
  },
  {
    path: '/deploy-metadata',
    // flag: FEATURE_FLAGS.DEPLOYMENT,
    render: () => (
      <OrgSelectionRequired>
        <DeployMetadata />
      </OrgSelectionRequired>
    ),
  },
  {
    path: '/deploy-sobject-metadata',
    render: () => (
      <OrgSelectionRequired>
        <CreateObjectAndFields />
      </OrgSelectionRequired>
    ),
  },
  {
    path: '/apex',
    render: () => (
      <OrgSelectionRequired>
        <AnonymousApex />
      </OrgSelectionRequired>
    ),
  },
  {
    path: '/salesforce-api',
    render: () => (
      <OrgSelectionRequired>
        <SalesforceApi />
      </OrgSelectionRequired>
    ),
  },
  {
    path: '/debug-logs',
    render: () => (
      <OrgSelectionRequired>
        <DebugLogViewer />
      </OrgSelectionRequired>
    ),
  },
  {
    path: '/platform-event-monitor',
    render: () => (
      <OrgSelectionRequired>
        <PlatformEventMonitor />
      </OrgSelectionRequired>
    ),
  },
  {
    path: '/object-export',
    render: () => (
      <OrgSelectionRequired>
        <SObjectExport />
      </OrgSelectionRequired>
    ),
  },
  { path: '/feedback', render: () => <Feedback userProfile={_userProfile} /> },
  { path: '/settings', render: () => <Settings featureFlags={_featureFlags} userProfile={_userProfile} /> },
  { path: '*', render: () => <Redirect to="/query" /> },
];

/**
 * TODO: disabled socket from browser until we have a solid use-case for it
 * previously this was used for platform events, but that was moved to browser
 */
// initSocket();

export const App = () => {
  const [userProfile, setUserProfile] = useState<UserProfileUi>();
  const [featureFlags, setFeatureFlags] = useState<Set<string>>(new Set());
  const [routes, setRoutes] = useState<RouteItem[]>([]);

  useEffect(() => {
    _userProfile = userProfile;
    if (userProfile && userProfile['http://getjetstream.app/app_metadata']?.featureFlags) {
      const flags = new Set<string>(userProfile['http://getjetstream.app/app_metadata'].featureFlags.flags);
      setRoutes(ROUTES.filter((route) => !route.flag || hasFeatureFlagAccess(flags, route.flag)));
      setFeatureFlags(flags);
    }
  }, [userProfile]);

  useEffect(() => {
    if (featureFlags) {
      featureFlags.forEach((flag) => _featureFlags.add(flag));
    }
  }, [featureFlags]);

  return (
    <ConfirmationServiceProvider>
      <RecoilRoot>
        {/* TODO: make better loading indicators for suspense (both global and localized versions - maybe SVG placeholders) */}
        <Suspense fallback={<div>Loading...</div>}>
          <AppInitializer onUserProfile={setUserProfile}>
            <OverlayProvider>
              <ModalContainer />
              <AppStateResetOnOrgChange />
              <AppToast />
              <LogInitializer />
              <NotificationsRequestModal featureFlags={featureFlags} loadDelay={30000} />
              <div>
                <div>
                  <HeaderNavbar userProfile={userProfile} featureFlags={featureFlags} />
                </div>
                <div
                  className="slds-p-horizontal_xx-small slds-p-vertical_xx-small"
                  css={css`
                    margin-top: 90px;
                  `}
                >
                  <Suspense fallback={<div>Loading...</div>}>
                    <ErrorBoundary FallbackComponent={ErrorBoundaryFallback}>
                      <Switch>
                        {routes.map((route) => (
                          <Route key={route.path} path={route.path} render={route.render} />
                        ))}
                      </Switch>
                    </ErrorBoundary>
                  </Suspense>
                </div>
              </div>
            </OverlayProvider>
          </AppInitializer>
        </Suspense>
      </RecoilRoot>
    </ConfirmationServiceProvider>
  );
};

export default App;
