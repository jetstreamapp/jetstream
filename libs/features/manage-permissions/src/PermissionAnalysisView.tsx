import { css } from '@emotion/react';
import { logger } from '@jetstream/shared/client-logger';
import { getAnalysisJob } from '@jetstream/shared/data';
import { getErrorMessage } from '@jetstream/shared/utils';
import {
  AutoFullHeightContainer,
  Icon,
  ScopedNotification,
  Spinner,
  Tabs,
  Toast,
  Toolbar,
  ToolbarItemActions,
  ToolbarItemGroup,
} from '@jetstream/ui';
import { RequireMetadataApiBanner } from '@jetstream/ui-core';
import { selectedOrgState } from '@jetstream/ui/app-state';
import { useAtomValue } from 'jotai';
import { Fragment, FunctionComponent, useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';

const HEIGHT_BUFFER = 170;

function formatJobResult(result: unknown): string {
  try {
    return JSON.stringify(result, null, 2);
  } catch {
    return String(result);
  }
}

/**
 * Read-only analysis workspace: polls the analysis job created from the selection step.
 */
export const PermissionAnalysisView: FunctionComponent = () => {
  const selectedOrg = useAtomValue(selectedOrgState);
  const [searchParams] = useSearchParams();
  const jobId = searchParams.get('job');

  const [jobRecord, setJobRecord] = useState<Record<string, unknown> | null>(null);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const refreshJob = useCallback(async () => {
    if (!selectedOrg?.uniqueId || !jobId) {
      return;
    }
    try {
      const { job } = await getAnalysisJob(selectedOrg, jobId);
      setJobRecord(job);
      setFetchError(null);
    } catch (ex) {
      setFetchError(getErrorMessage(ex));
      logger.error('Failed to refresh analysis job', ex);
    }
  }, [selectedOrg, jobId]);

  useEffect(() => {
    if (!selectedOrg?.uniqueId || !jobId) {
      return;
    }

    let cancelled = false;
    const intervalIdRef: { current: ReturnType<typeof setInterval> | undefined } = { current: undefined };

    async function pollOnce() {
      try {
        const { job } = await getAnalysisJob(selectedOrg, jobId);
        if (cancelled) {
          return;
        }
        setJobRecord(job);
        setFetchError(null);
        const status = String(job.status ?? '');
        if ((status === 'completed' || status === 'failed') && intervalIdRef.current) {
          clearInterval(intervalIdRef.current);
          intervalIdRef.current = undefined;
        }
      } catch (ex) {
        if (!cancelled) {
          setFetchError(getErrorMessage(ex));
          logger.error('Failed to load analysis job', ex);
          if (intervalIdRef.current) {
            clearInterval(intervalIdRef.current);
            intervalIdRef.current = undefined;
          }
        }
      }
    }

    void pollOnce();
    intervalIdRef.current = setInterval(() => void pollOnce(), 2000);

    return () => {
      cancelled = true;
      if (intervalIdRef.current) {
        clearInterval(intervalIdRef.current);
      }
    };
  }, [selectedOrg, jobId]);

  const statusLabel = jobRecord?.status != null ? String(jobRecord.status) : null;
  const isTerminal = statusLabel === 'completed' || statusLabel === 'failed';
  const showSpinner = Boolean(
    jobId && !fetchError && !isTerminal && (statusLabel === null || statusLabel === 'pending' || statusLabel === 'running'),
  );

  const tabs = useMemo(
    () => [
      {
        id: 'export-job',
        title: (
          <Fragment>
            <span className="slds-tabs__left-icon">
              <Icon
                type="standard"
                icon="portal"
                containerClassname="slds-icon_container slds-icon-standard-portal"
                className="slds-icon slds-icon_small"
              />
            </span>
            Export job{statusLabel ? ` (${statusLabel})` : ''}
          </Fragment>
        ),
        titleText: 'Export job',
        content: (
          <div className="slds-p-around_medium">
            {showSpinner && (
              <div className="slds-m-bottom_medium">
                <Spinner />
              </div>
            )}
            {jobRecord && (
              <dl className="slds-dl_horizontal">
                <dt className="slds-dl_horizontal__label">
                  <p className="slds-truncate">Status</p>
                </dt>
                <dd className="slds-dl_horizontal__detail">
                  <p className="slds-truncate">{statusLabel ?? '—'}</p>
                </dd>
                <dt className="slds-dl_horizontal__label">
                  <p className="slds-truncate">Job type</p>
                </dt>
                <dd className="slds-dl_horizontal__detail">
                  <p className="slds-truncate">{jobRecord.jobType != null ? String(jobRecord.jobType) : '—'}</p>
                </dd>
                {jobRecord.errorMessage != null && String(jobRecord.errorMessage).length > 0 && (
                  <>
                    <dt className="slds-dl_horizontal__label">
                      <p className="slds-truncate">Error</p>
                    </dt>
                    <dd className="slds-dl_horizontal__detail">
                      <p>{String(jobRecord.errorMessage)}</p>
                    </dd>
                  </>
                )}
              </dl>
            )}
            {jobRecord?.result != null && (
              <pre
                className="slds-box slds-m-top_medium slds-scrollable_y"
                css={css`
                  max-height: 360px;
                  font-size: 0.75rem;
                `}
              >
                {formatJobResult(jobRecord.result)}
              </pre>
            )}
          </div>
        ),
      },
    ],
    [jobRecord, showSpinner, statusLabel],
  );

  return (
    <div>
      <RequireMetadataApiBanner />
      <Toolbar>
        <ToolbarItemGroup>
          <Link className="slds-button slds-button_brand" to="..">
            <Icon type="utility" icon="back" className="slds-button__icon slds-button__icon_left" omitContainer />
            Go Back
          </Link>
        </ToolbarItemGroup>
        <ToolbarItemActions>
          <button
            type="button"
            className="slds-button slds-button_neutral collapsible-button collapsible-button-xs"
            onClick={() => void refreshJob()}
            disabled={!jobId}
          >
            <Icon type="utility" icon="refresh" className="slds-button__icon slds-button__icon_left" />
            <span>Refresh status</span>
          </button>
        </ToolbarItemActions>
      </Toolbar>
      <AutoFullHeightContainer
        baseCss={css`
          background-color: #ffffff;
        `}
        bottomBuffer={10}
        className="slds-scrollable_none"
        bufferIfNotRendered={HEIGHT_BUFFER}
      >
        {!jobId && (
          <div className="slds-p-around_medium">
            <ScopedNotification theme="warning">
              No analysis job is linked to this page. Use Continue on the selection screen to start a permission export job.
            </ScopedNotification>
          </div>
        )}
        {jobId && fetchError && <Toast type="error">{fetchError}</Toast>}
        {jobId && !fetchError && <Tabs initialActiveId="export-job" tabs={tabs} />}
      </AutoFullHeightContainer>
    </div>
  );
};

export default PermissionAnalysisView;
