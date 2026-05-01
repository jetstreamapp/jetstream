import { css } from '@emotion/react';
import { PermissionAnalysisHistoryModal, filterPermissionsSobjects } from '@jetstream/feature/manage-permissions';
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
  Tooltip,
} from '@jetstream/ui';
import { selectedOrgState } from '@jetstream/ui/app-state';
import { atom, useAtom, useAtomValue } from 'jotai';
import { FunctionComponent, useCallback, useState } from 'react';
import { useNavigate } from 'react-router-dom';

const selectedSObjectsAtom = atom<string[]>([]);
const sobjectsAtom = atom<DescribeGlobalSObjectResult[] | null>(null);

/**
 * Object selection for field-usage style analysis; registers a **field_usage** job scaffold via API.
 */
export const DataAnalysisSelection: FunctionComponent = () => {
  const navigate = useNavigate();
  const selectedOrg = useAtomValue(selectedOrgState);
  const [sobjects, setSobjects] = useAtom(sobjectsAtom);
  const [selectedSObjects, setSelectedSObjects] = useAtom(selectedSObjectsAtom);
  const [submitting, setSubmitting] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);

  const handleStartJob = useCallback(async () => {
    if (!selectedOrg || !selectedSObjects.length) {
      fireToast({ message: 'Select at least one Object.', type: 'error' });
      return;
    }
    setSubmitting(true);
    try {
      const { job } = await createAnalysisJob(selectedOrg, {
        jobType: 'field_usage',
        payload: { objectApiNames: selectedSObjects },
      });
      const jobId = (job as { id?: string }).id;
      fireToast({
        message: jobId ? 'Field Usage job started. Loading results…' : 'Field Usage job registered.',
        type: 'success',
      });
      if (jobId) {
        navigate({ pathname: 'analysis', search: new URLSearchParams({ job: jobId }).toString() });
      }
    } catch (ex: unknown) {
      fireToast({ message: ex instanceof Error ? ex.message : 'Failed to start job', type: 'error' });
    } finally {
      setSubmitting(false);
    }
  }, [navigate, selectedOrg, selectedSObjects]);

  return (
    <Page testId="data-analysis-page">
      <PageHeader>
        <PageHeaderRow>
          <PageHeaderTitle icon={{ type: 'standard', icon: 'data_streams' }} label="Data Analysis" />
          <PageHeaderActions colType="actions" buttonType="separate">
            <Tooltip ariaRole="label" content="View past Field Usage runs for this org">
              <button
                type="button"
                aria-label="Field Usage history"
                className="slds-button slds-button_neutral collapsible-button collapsible-button-xs"
                css={css`
                  padding: 0.5rem;
                `}
                disabled={!selectedOrg?.uniqueId}
                onClick={() => setIsHistoryOpen(true)}
              >
                <Icon type="utility" icon="date_time" className="slds-button__icon" omitContainer title="Field Usage history" />
              </button>
            </Tooltip>
            <button
              type="button"
              className="slds-button slds-button_brand"
              disabled={submitting || !selectedSObjects.length}
              onClick={() => void handleStartJob()}
            >
              Start Field Usage Analysis
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
      {isHistoryOpen && selectedOrg && (
        <PermissionAnalysisHistoryModal
          selectedOrg={selectedOrg}
          analysisJobType="field_usage"
          currentJobId={null}
          onClose={() => setIsHistoryOpen(false)}
          onSelectJob={(nextJobId) => {
            setIsHistoryOpen(false);
            navigate({ pathname: 'analysis', search: new URLSearchParams({ job: nextJobId }).toString() });
          }}
        />
      )}
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
