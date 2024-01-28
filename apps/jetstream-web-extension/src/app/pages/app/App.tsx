/* eslint-disable no-restricted-globals */
import { APP_ROUTES } from '@jetstream/core/app';
import { QueryBuilder, QueryResults } from '@jetstream/core/query';
import { AppLoading, HeaderNavbar, NotificationsRequestModal } from '@jetstream/core/shared-ui';
import { enableLogger } from '@jetstream/shared/client-logger';
import { Maybe, SalesforceOrgUi } from '@jetstream/types';
import { AppToast, ConfirmationServiceProvider, ErrorBoundaryFallback } from '@jetstream/ui';
import { OverlayProvider } from '@react-aria/overlays';
import { Suspense, useEffect, useState } from 'react';
import { DndProvider } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import { createRoot } from 'react-dom/client';
import { ErrorBoundary } from 'react-error-boundary';
import ModalContainer from 'react-modal-promise';
import { Navigate, Route, Routes } from 'react-router-dom';
import { RecoilRoot } from 'recoil';
import { AppHome } from '../../components/AppHome';
import AppInitializer from '../../components/AppInitializer';
import '../../components/monaco-loader';
import { sendMessage } from '../../utils';

const args = new URLSearchParams(location.search.slice(1));
const salesforceHost = args.get('host');

const container = document.getElementById('app-container');
const root = createRoot(container!);
root.render(<App />);

enableLogger(true);

const unavailableRoutesDefault = new Set<keyof typeof APP_ROUTES>([
  'LOAD',
  'LOAD_MULTIPLE',
  'LOAD_MASS_UPDATE',
  'AUTOMATION_CONTROL',
  'PERMISSION_MANAGER',
  'DEPLOY_METADATA',
  'CREATE_FIELDS',
  'FORMULA_EVALUATOR',
  'ANON_APEX',
  'DEBUG_LOG_VIEWER',
  'OBJECT_EXPORT',
  'SALESFORCE_API',
  'PLATFORM_EVENT_MONITOR',
  'FEEDBACK_SUPPORT',
  'SETTINGS',
]);

export function App() {
  // const [] = useState();

  // const [isOnSalesforcePage] = useState(
  //   () => !!document.querySelector('body.sfdcBody, body.ApexCSIPage, #auraLoadingBox') || location.host.endsWith('visualforce.com')
  // );
  // /**
  //  * TODO: Should we make the user sign in instead of using cookies?
  //  * increases friction, but more secure
  //  */
  const [selectedOrg, setSelectedOrg] = useState<Maybe<SalesforceOrgUi>>(null);

  // useEffect(() => {
  //   if (isOnSalesforcePage) {
  //     getHost(location.href).then((salesforceHost) => {
  //       setsfHost(salesforceHost);
  //     });
  //   }
  // }, [isOnSalesforcePage]);

  useEffect(() => {
    (async () => {
      try {
        if (salesforceHost) {
          const sessionInfo = await sendMessage({
            message: 'GET_SESSION',
            data: { salesforceHost },
          });
          console.log('sessionInfo', sessionInfo);
          if (sessionInfo) {
            const apiClient = await sendMessage({
              message: 'INIT_ORG',
              data: { sessionInfo },
            });
            setSelectedOrg(apiClient.org);
          }
        }
      } catch (ex) {
        console.error(ex);
      }
    })();
  }, []);

  if (!salesforceHost || !selectedOrg) {
    console.log('no host parameter');
    return <AppLoading />;
  }

  return (
    <ConfirmationServiceProvider>
      <RecoilRoot>
        <Suspense fallback={<AppLoading />}>
          <AppInitializer>
            <OverlayProvider>
              <DndProvider backend={HTML5Backend}>
                <ModalContainer />
                {/* <AppStateResetOnOrgChange /> */}
                <AppToast />
                {/* <LogInitializer /> */}
                <NotificationsRequestModal loadDelay={10000} />
                {/* <DownloadFileStream /> */}
                <div>
                  <HeaderNavbar
                    selectedOrg={selectedOrg}
                    unavailableRoutes={unavailableRoutesDefault}
                    // orgsDropdown={<OrgsDropdown />}
                    // userProfile={userProfile}
                    // featureFlags={featureFlags}
                  />
                  <div className="app-container slds-p-horizontal_xx-small slds-p-vertical_xx-small" data-testid="content">
                    <Suspense fallback={<AppLoading />}>
                      <ErrorBoundary FallbackComponent={ErrorBoundaryFallback}>
                        <Routes>
                          <Route path={APP_ROUTES.HOME.ROUTE} element={<AppHome />} />
                          <Route path="/query">
                            <Route index element={<QueryBuilder selectedOrg={selectedOrg} />} />
                            <Route path="results" element={<QueryResults selectedOrg={selectedOrg} />} />
                            <Route path="*" element={<Navigate to=".." />} />
                          </Route>

                          <Route path="*" element={<Navigate to={APP_ROUTES.HOME.ROUTE} />} />
                        </Routes>
                      </ErrorBoundary>
                    </Suspense>
                  </div>
                </div>
              </DndProvider>
            </OverlayProvider>
          </AppInitializer>
        </Suspense>
      </RecoilRoot>
    </ConfirmationServiceProvider>
  );
}
