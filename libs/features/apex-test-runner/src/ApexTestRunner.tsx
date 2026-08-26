import { TITLES } from '@jetstream/shared/constants';
import { APP_ROUTES } from '@jetstream/shared/ui-router';
import { useTitle } from '@jetstream/shared/ui-utils';
import { AutoFullHeightContainer, Page, PageHeader, PageHeaderRow, PageHeaderTitle, Tabs } from '@jetstream/ui';
import { selectedOrgState } from '@jetstream/ui/app-state';
import { useAtomValue } from 'jotai';
import { FunctionComponent } from 'react';

const HEIGHT_BUFFER = 170;

export const ApexTestRunner: FunctionComponent = () => {
  useTitle(TITLES.APEX_TESTS);
  const selectedOrg = useAtomValue(selectedOrgState);

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
              content: <div key={selectedOrg.uniqueId}>Test runs coming soon</div>,
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
