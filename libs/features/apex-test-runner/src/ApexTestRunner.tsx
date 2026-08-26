import { TITLES } from '@jetstream/shared/constants';
import { APP_ROUTES } from '@jetstream/shared/ui-router';
import { useTitle } from '@jetstream/shared/ui-utils';
import { AutoFullHeightContainer, Page, PageHeader, PageHeaderRow, PageHeaderTitle, Tabs, TabsRef } from '@jetstream/ui';
import { applicationCookieState, selectedOrgState } from '@jetstream/ui/app-state';
import { useAtomValue } from 'jotai';
import { FunctionComponent, useRef, useState } from 'react';
import TestRunsTab from './runs/TestRunsTab';
import type { SelectedTestRun } from './useApexTestRun';
import { useApexTestRunsList } from './useApexTestRunsList';

const HEIGHT_BUFFER = 170;

export const ApexTestRunner: FunctionComponent = () => {
  useTitle(TITLES.APEX_TESTS);
  const selectedOrg = useAtomValue(selectedOrgState);
  const { defaultApiVersion } = useAtomValue(applicationCookieState);
  const tabsRef = useRef<TabsRef>(null);
  const [selectedRun, setSelectedRun] = useState<SelectedTestRun | null>(null);
  const runsList = useApexTestRunsList(selectedOrg);

  return (
    <Page testId="apex-test-runner-page">
      <PageHeader>
        <PageHeaderRow>
          <PageHeaderTitle icon={{ type: 'standard', icon: 'apex' }} label="Apex Test Runner" docsPath={APP_ROUTES.APEX_TESTS.DOCS} />
        </PageHeaderRow>
      </PageHeader>
      <AutoFullHeightContainer
        bottomBuffer={10}
        className="slds-p-horizontal_x-small slds-scrollable_none"
        bufferIfNotRendered={HEIGHT_BUFFER}
      >
        <Tabs
          ref={tabsRef}
          renderAllContent
          tabs={[
            {
              id: 'run-tests',
              title: 'Run Tests',
              content: <div key={selectedOrg.uniqueId}>Run tests coming soon</div>,
            },
            {
              id: 'test-runs',
              title: 'Test Runs',
              content: (
                <TestRunsTab
                  key={selectedOrg.uniqueId}
                  selectedOrg={selectedOrg}
                  apiVersion={defaultApiVersion}
                  runsList={runsList}
                  selectedRun={selectedRun}
                  onSelectedRunChange={setSelectedRun}
                />
              ),
            },
            {
              id: 'code-coverage',
              title: 'Code Coverage',
              content: <div key={selectedOrg.uniqueId}>Code coverage coming soon</div>,
            },
          ]}
        />
      </AutoFullHeightContainer>
    </Page>
  );
};

export default ApexTestRunner;
