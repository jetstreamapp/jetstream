import { css } from '@emotion/react';
import { filterPermissionsSobjects, PermissionAnalysisHistoryModal } from '@jetstream/feature/manage-permissions';
import { APP_ROUTES } from '@jetstream/shared/ui-router';
import { useNonInitialEffect } from '@jetstream/shared/ui-utils';
import { AsyncJobNew, DescribeGlobalSObjectResult, FieldUsageAnalysisJob } from '@jetstream/types';
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
import { fromJetstreamEvents, jobsState } from '@jetstream/ui-core';
import { selectedOrgState } from '@jetstream/ui/app-state';
import { atom, useAtom, useAtomValue } from 'jotai';
import { FunctionComponent, useCallback, useState } from 'react';
import { useNavigate } from 'react-router';
import { isAnalysisJobActive } from './shared/analysis-job-runtime-state';

const selectedSObjectsAtom = atom<string[]>([]);
const sobjectsAtom = atom<DescribeGlobalSObjectResult[] | null>(null);

/**
 * Object selection for field-usage style analysis; enqueues a browser-side job via the JobWorker pattern
 * and routes the user to the results view keyed by the Dexie row that will receive the final blob.
 */
export const DataAnalysisSelection: FunctionComponent = () => {
  const navigate = useNavigate();
  const selectedOrg = useAtomValue(selectedOrgState);
  const jobs = useAtomValue(jobsState);
  const [sobjects, setSobjects] = useAtom(sobjectsAtom);
  const [selectedSObjects, setSelectedSObjects] = useAtom(selectedSObjectsAtom);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);

  // These atoms are module-level, so clear the prior org's objects/selection when the org changes
  // (avoids submitting a previous org's selection against the newly selected org).
  useNonInitialEffect(() => {
    setSobjects(null);
    setSelectedSObjects([]);
  }, [selectedOrg?.uniqueId, setSobjects, setSelectedSObjects]);

  const handleStartJob = useCallback(() => {
    if (!selectedOrg || !selectedSObjects.length) {
      fireToast({ message: 'Select at least one Object.', type: 'error' });
      return;
    }
    if (isAnalysisJobActive(jobs, selectedOrg.uniqueId, 'field_usage')) {
      fireToast({
        message: 'A Field Usage job is already running for this org. Wait for it to finish before starting another.',
        type: 'warning',
      });
      return;
    }

    const jobHistoryKey = `aj_${crypto.randomUUID()}`;
    const meta: FieldUsageAnalysisJob = {
      jobHistoryKey,
      orgUniqueId: selectedOrg.uniqueId,
      objectApiNames: selectedSObjects,
      loadFullScan: false,
    };
    const asyncJobNew: AsyncJobNew<FieldUsageAnalysisJob> = {
      type: 'FieldUsageAnalysis',
      title: `Field Usage Analysis (${selectedSObjects.length} Object${selectedSObjects.length === 1 ? '' : 's'})`,
      org: selectedOrg,
      meta,
      viewUrl: `${APP_ROUTES.DATA_ANALYSIS.ROUTE}/analysis?job=${encodeURIComponent(jobHistoryKey)}`,
    };
    fromJetstreamEvents.emit({ type: 'newJob', payload: [asyncJobNew] });
    fireToast({ message: 'Field Usage job started. Loading results…', type: 'success' });
    navigate({ pathname: 'analysis', search: new URLSearchParams({ job: jobHistoryKey }).toString() });
  }, [jobs, navigate, selectedOrg, selectedSObjects]);

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
            <button type="button" className="slds-button slds-button_brand" disabled={!selectedSObjects.length} onClick={handleStartJob}>
              Start Field Usage Analysis
              <Icon type="utility" icon="forward" className="slds-button__icon slds-button__icon_right" omitContainer />
            </button>
          </PageHeaderActions>
        </PageHeaderRow>
        <PageHeaderRow>
          <span className="slds-text-body_small slds-text-color_weak">
            Select Salesforce objects, then start a job. Results are computed in your browser and persisted locally per org.
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
