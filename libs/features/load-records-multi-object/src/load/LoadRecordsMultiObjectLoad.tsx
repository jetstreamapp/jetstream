import { css } from '@emotion/react';
import { ANALYTICS_KEYS } from '@jetstream/shared/constants';
import { formatNumber } from '@jetstream/shared/ui-utils';
import { pluralizeFromNumber } from '@jetstream/shared/utils';
import { Maybe, SalesforceOrgUi, SalesforceOrgUiType } from '@jetstream/types';
import { Badge, ConfirmationModalPromise, DropDown, Grid, Icon, ScopedNotification } from '@jetstream/ui';
import { ConfirmPageChange, useAmplitude } from '@jetstream/ui-core';
import { useAtomValue } from 'jotai';
import { FunctionComponent, useEffect, useMemo, useRef } from 'react';
import { LoadMultiObjectRun } from '../load-records-multi-object-types';
import { buildRetryRequests } from '../load-records-multi-object-utils';
import { groupsByRefIdState, loadProgressState, requestsState, totalRecordsToLoadState } from '../load-records-multi-object.state';
import { getGroupNumbersByGraphId } from '../review/review-utils';
import useLoadFile from '../useLoadFile';
import LoadRecordsMultiObjectDownloadModal from './LoadRecordsMultiObjectDownloadModal';
import LoadRecordsMultiObjectResultsTables from './LoadRecordsMultiObjectResultsTables';
import { buildRecordResultRows, getLoadResultsSummary } from './load-results-utils';
import useDownloadResults from './useDownloadResults';

export interface LoadRecordsMultiObjectLoadProps {
  selectedOrg: SalesforceOrgUi;
  orgType: Maybe<SalesforceOrgUiType>;
  serverUrl: string;
  apiVersion: string;
}

/** Step 2: confirm the target org, run the load with live progress, then review/retry per-record results */
export const LoadRecordsMultiObjectLoad: FunctionComponent<LoadRecordsMultiObjectLoadProps> = ({
  selectedOrg,
  orgType,
  serverUrl,
  apiVersion,
}) => {
  const { trackEvent } = useAmplitude();
  const { downloadRequests, downloadResults, handleCloseDownloadModal, downloadModalData } = useDownloadResults();

  const requests = useAtomValue(requestsState);
  const groupsByRefId = useAtomValue(groupsByRefIdState);
  const progress = useAtomValue(loadProgressState);
  const { loadFile, retryFailed, cancel, loading, runs } = useLoadFile(selectedOrg, serverUrl, apiVersion);

  const groupNumbersByGraphId = useMemo(() => getGroupNumbersByGraphId(groupsByRefId), [groupsByRefId]);
  // Before the first run, show every record as pending so the user can review exactly what will be loaded
  const runsToDisplay = useMemo((): LoadMultiObjectRun[] => {
    if (runs.length || !requests?.length) {
      return runs;
    }
    return [{ runId: -1, type: 'initial', requests, startedAt: null, finishedAt: null, cancelled: false }];
  }, [runs, requests]);
  const resultRows = useMemo(() => buildRecordResultRows(runsToDisplay, groupNumbersByGraphId), [runsToDisplay, groupNumbersByGraphId]);
  const { successCount, failureCount, pendingCount } = useMemo(() => getLoadResultsSummary(resultRows), [resultRows]);

  // Same count that gates "Continue to Load" on the review step, so the two can never disagree
  const totalRecordCount = useAtomValue(totalRecordsToLoadState);
  const totalGroupCount = useMemo(
    () => (requests || []).reduce((count, request) => count + Object.keys(request.dataWithResultsByGraphId).length, 0),
    [requests],
  );

  const loadFinished = runs.length > 0 && !loading;
  const failedGroupRequests = useMemo(
    () => (loadFinished ? buildRetryRequests(runs.flatMap(({ requests: runRequests }) => runRequests)) : []),
    [loadFinished, runs],
  );
  const failedGroupCount = useMemo(
    () => failedGroupRequests.reduce((count, request) => count + Object.keys(request.dataWithResultsByGraphId).length, 0),
    [failedGroupRequests],
  );

  async function handleLoadStarted() {
    if (!requests?.length) {
      return;
    }
    if (
      runs.length === 0 ||
      (await ConfirmationModalPromise({
        content: 'This file has already been loaded, are you sure you want to load it again?',
      }))
    ) {
      trackEvent(ANALYTICS_KEYS.load_multi_obj_Submitted, {
        records: totalRecordCount,
        groups: totalGroupCount,
        requests: requests.length,
        isReload: runs.length > 0,
      });
      loadFile(requests);
    }
  }

  function handleRetryFailed() {
    trackEvent(ANALYTICS_KEYS.load_multi_obj_RetryFailed, { groups: failedGroupCount });
    retryFailed(failedGroupRequests);
  }

  function handleCancel() {
    trackEvent(ANALYTICS_KEYS.load_multi_obj_Cancelled, { progress });
    cancel();
  }

  function handleDownloadResults(which: 'results' | 'failures') {
    trackEvent(ANALYTICS_KEYS.load_multi_obj_DownloadResults, { which });
    downloadResults(resultRows, which);
  }

  const progressPercent = progress && progress.recordsTotal ? Math.round((progress.recordsProcessed / progress.recordsTotal) * 100) : 0;

  // The Load and Cancel buttons replace each other, unmounting whichever is focused. Hand focus
  // along the chain (Load -> Cancel on start, Cancel -> Load on finish), but only when focus was
  // actually dropped to <body> so we never steal it from a user who moved elsewhere.
  const loadButtonRef = useRef<HTMLButtonElement>(null);
  const cancelButtonRef = useRef<HTMLButtonElement>(null);
  const wasLoadingRef = useRef(loading);
  useEffect(() => {
    const wasLoading = wasLoadingRef.current;
    wasLoadingRef.current = loading;
    if (wasLoading === loading) {
      return;
    }
    window.setTimeout(() => {
      const active = document.activeElement;
      if (active && active !== document.body) {
        return;
      }
      (loading ? cancelButtonRef.current : loadButtonRef.current)?.focus();
    });
  }, [loading]);

  return (
    <div>
      <ConfirmPageChange actionInProgress={loading} />
      <LoadRecordsMultiObjectDownloadModal downloadModalData={downloadModalData} onClose={handleCloseDownloadModal} />

      <Grid align="spread" verticalAlign="center" wrap className="slds-p-around_small">
        <div>
          <Badge type={orgType === 'Production' ? 'warning' : 'light'} title={orgType || undefined}>
            {orgType}
          </Badge>
          <strong className="slds-m-left_xx-small">{selectedOrg.username}</strong>
        </div>
        <DropDown
          position="right"
          actionText="additional downloads"
          items={[{ id: 'load-data', value: 'Download Load Data (JSON)', icon: { type: 'utility', icon: 'download' } }]}
          onSelected={() => requests && downloadRequests(requests)}
        />
      </Grid>

      <div className="slds-p-horizontal_small">
        {totalRecordCount === 0 && (
          <ScopedNotification theme="warning">
            There are no records to load. Go back and check that your file has data and no unresolved errors.
          </ScopedNotification>
        )}
        {!loading && totalRecordCount > 0 && (
          <button ref={loadButtonRef} className="slds-button slds-button_brand" onClick={handleLoadStarted}>
            Load <strong className="slds-m-horizontal_xx-small">{formatNumber(totalRecordCount)}</strong>
            {pluralizeFromNumber('Record', totalRecordCount)} ({formatNumber(totalGroupCount)}{' '}
            {pluralizeFromNumber('Group', totalGroupCount)}
            {requests && requests.length > 1 ? `, ${formatNumber(requests.length)} ${pluralizeFromNumber('Request', requests.length)}` : ''}
            )
          </button>
        )}
        {loading && (
          <button ref={cancelButtonRef} className="slds-button slds-button_text-destructive" onClick={handleCancel}>
            Cancel Remaining Requests
          </button>
        )}
        {loadFinished && failedGroupCount > 0 && (
          <button className="slds-button slds-button_neutral slds-m-left_small" onClick={handleRetryFailed}>
            <Icon type="utility" icon="refresh" className="slds-button__icon slds-button__icon_left" />
            Retry Failed {pluralizeFromNumber('Group', failedGroupCount)} ({formatNumber(failedGroupCount)})
          </button>
        )}
        {loadFinished && (
          <span className="slds-m-left_small">
            <button className="slds-button" onClick={() => handleDownloadResults('results')}>
              <Icon type="utility" icon="download" className="slds-button__icon slds-button__icon_left" omitContainer />
              Download All Results
            </button>
            {failureCount > 0 && (
              <button className="slds-button slds-m-left_small" onClick={() => handleDownloadResults('failures')}>
                <Icon type="utility" icon="download" className="slds-button__icon slds-button__icon_left" omitContainer />
                Download Failures
              </button>
            )}
          </span>
        )}
      </div>

      {(loading || runs.length > 0) && (
        <div className="slds-p-around_small">
          {loading && progress && (
            <div>
              <div className="slds-m-bottom_xx-small">
                Request {formatNumber(Math.max(progress.current, 1))} of {formatNumber(progress.total)} ·{' '}
                {formatNumber(progress.recordsProcessed)} of {formatNumber(progress.recordsTotal)} records
              </div>
              <div
                className="slds-progress-bar"
                role="progressbar"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={progressPercent}
                aria-label="Load progress"
              >
                <span
                  className="slds-progress-bar__value"
                  css={css`
                    width: ${progressPercent}%;
                  `}
                />
              </div>
            </div>
          )}
          {runs.length > 0 && (
            <div className="slds-m-top_x-small">
              <span className="slds-text-color_success slds-m-right_small">
                <Icon type="utility" icon="success" className="slds-icon slds-icon_xx-small slds-icon-text-success slds-m-right_xx-small" />
                {formatNumber(successCount)} success
              </span>
              <span className={failureCount ? 'slds-text-color_error slds-m-right_small' : 'slds-m-right_small'}>
                <Icon
                  type="utility"
                  icon="error"
                  className={`slds-icon slds-icon_xx-small slds-m-right_xx-small ${failureCount ? 'slds-icon-text-error' : 'slds-icon-text-default'}`}
                />
                {formatNumber(failureCount)} {pluralizeFromNumber('failure', failureCount)}
              </span>
              {pendingCount > 0 && <span className="slds-text-color_weak">{formatNumber(pendingCount)} not processed</span>}
            </div>
          )}
        </div>
      )}

      <LoadRecordsMultiObjectResultsTables
        rows={resultRows}
        hasMultipleRuns={runs.length > 1}
        isRunning={loading}
        selectedOrg={selectedOrg}
        serverUrl={serverUrl}
      />
    </div>
  );
};

export default LoadRecordsMultiObjectLoad;
