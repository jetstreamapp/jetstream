import { css } from '@emotion/react';
import { filterPermissionsSobjects } from '@jetstream/feature/manage-permissions';
import { createAnalysisJob } from '@jetstream/shared/data';
import { DescribeGlobalSObjectResult } from '@jetstream/types';
import {
  AutoFullHeightContainer,
  ConnectedSobjectListMultiSelect,
  fireToast,
  Icon,
  Page,
  PageHeader,
  PageHeaderActions,
  PageHeaderRow,
  PageHeaderTitle,
} from '@jetstream/ui';
import { selectedOrgState } from '@jetstream/ui/app-state';
import { atom, useAtom, useAtomValue } from 'jotai';
import { FunctionComponent, useCallback, useState } from 'react';

const selectedSObjectsAtom = atom<string[]>([]);
const sobjectsAtom = atom<DescribeGlobalSObjectResult[] | null>(null);

/**
 * Object selection for field-usage style analysis; registers a **field_usage** job scaffold via API.
 */
export const DataAnalysisSelection: FunctionComponent = () => {
  const selectedOrg = useAtomValue(selectedOrgState);
  const [sobjects, setSobjects] = useAtom(sobjectsAtom);
  const [selectedSObjects, setSelectedSObjects] = useAtom(selectedSObjectsAtom);
  const [submitting, setSubmitting] = useState(false);

  const handleStartJob = useCallback(async () => {
    if (!selectedOrg || !selectedSObjects.length) {
      fireToast({ message: 'Select at least one object.', type: 'error' });
      return;
    }
    setSubmitting(true);
    try {
      const { job } = await createAnalysisJob(selectedOrg, {
        jobType: 'field_usage',
        payload: { objectApiNames: selectedSObjects },
      });
      fireToast({
        message: `Job registered (${String((job as { id?: string }).id || 'ok')}). Results UI ships in a follow-up.`,
        type: 'success',
      });
    } catch (ex: unknown) {
      fireToast({ message: ex instanceof Error ? ex.message : 'Failed to start job', type: 'error' });
    } finally {
      setSubmitting(false);
    }
  }, [selectedOrg, selectedSObjects]);

  return (
    <Page testId="data-analysis-page">
      <PageHeader>
        <PageHeaderRow>
          <PageHeaderTitle icon={{ type: 'standard', icon: 'data_streams' }} label="Data Analysis" />
          <PageHeaderActions colType="actions" buttonType="separate">
            <button
              type="button"
              className="slds-button slds-button_brand"
              disabled={submitting || !selectedSObjects.length}
              onClick={() => void handleStartJob()}
            >
              Register field usage job
              <Icon type="utility" icon="forward" className="slds-button__icon slds-button__icon_right" omitContainer />
            </button>
          </PageHeaderActions>
        </PageHeaderRow>
        <PageHeaderRow>
          <span className="slds-text-body_small slds-text-color_weak">
            Select Salesforce objects, then register a job. The API persists job metadata; heavy SOQL runs next.
          </span>
        </PageHeaderRow>
      </PageHeader>
      <AutoFullHeightContainer bottomBuffer={24} className="slds-p-horizontal_small">
        <div
          css={css`
            max-width: 520px;
          `}
        >
          <ConnectedSobjectListMultiSelect
            selectedOrg={selectedOrg}
            sobjects={sobjects}
            selectedSObjects={selectedSObjects}
            recentItemsEnabled
            recentItemsKey="sobject"
            filterFn={filterPermissionsSobjects}
            onSobjects={setSobjects}
            onSelectedSObjects={setSelectedSObjects}
          />
        </div>
      </AutoFullHeightContainer>
    </Page>
  );
};

export default DataAnalysisSelection;
