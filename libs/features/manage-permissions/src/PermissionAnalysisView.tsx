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
  Tooltip,
} from '@jetstream/ui';
import { RequireMetadataApiBanner } from '@jetstream/ui-core';
import { applicationCookieState, selectSkipFrontdoorAuth, selectedOrgState } from '@jetstream/ui/app-state';
import { useAtomValue } from 'jotai';
import { Fragment, FunctionComponent, useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { formatAnalysisJobStatusForDisplay } from './analysis-job-status-display';
import { PermissionAnalysisExportGrid } from './PermissionAnalysisExportGrid';
import { PermissionAnalysisHistoryModal } from './PermissionAnalysisHistoryModal';
import { PermissionAnalysisIssuesTab } from './PermissionAnalysisIssuesTab';
import { parsePermissionExportResult } from './permission-export-result-view';

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
  const { serverUrl, defaultApiVersion } = useAtomValue(applicationCookieState);
  const skipFrontdoorLogin = useAtomValue(selectSkipFrontdoorAuth);
  const [searchParams, setSearchParams] = useSearchParams();
  const jobId = searchParams.get('job');

  const [jobRecord, setJobRecord] = useState<Record<string, unknown> | null>(null);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);

  useEffect(() => {
    if (!selectedOrg?.uniqueId || !jobId) {
      return;
    }

    setJobRecord(null);

    const orgForPoll = selectedOrg;
    const jobIdForPoll = jobId;

    let cancelled = false;
    const intervalIdRef: { current: ReturnType<typeof setInterval> | undefined } = { current: undefined };

    async function pollOnce() {
      try {
        const { job } = await getAnalysisJob(orgForPoll, jobIdForPoll);
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

  const jobStatusRaw = jobRecord?.status != null ? String(jobRecord.status).trim() : null;
  const jobStatusNormalized = jobStatusRaw?.toLowerCase() ?? null;
  const statusDisplay = jobStatusRaw ? formatAnalysisJobStatusForDisplay(jobStatusRaw) : null;
  const isTerminal = jobStatusNormalized === 'completed' || jobStatusNormalized === 'failed';
  const showSpinnerForJobLifecycle = Boolean(
    jobId &&
    !fetchError &&
    !isTerminal &&
    (jobStatusNormalized === null || jobStatusNormalized === 'pending' || jobStatusNormalized === 'running'),
  );

  const parsedExport = useMemo(() => {
    if (!jobRecord?.result) {
      return null;
    }
    return parsePermissionExportResult(jobRecord.result);
  }, [jobRecord]);

  const findingsCount = parsedExport?.findings.length ?? 0;

  const resultTabs = useMemo(() => {
    if (!selectedOrg || !parsedExport) {
      return null;
    }

    const { export: exportBundle, truncated, findings } = parsedExport;
    const counts = parsedExport.counts;

    const gridProps = {
      org: selectedOrg,
      serverUrl,
      skipFrontdoorLogin,
      defaultApiVersion,
    };

    return [
      {
        id: 'permission-sets',
        title: (
          <Fragment>
            <span className="slds-tabs__left-icon">
              <Icon
                type="standard"
                icon="user"
                containerClassname="slds-icon_container slds-icon-standard-user"
                className="slds-icon slds-icon_small"
              />
            </span>
            Permission Sets{counts.permissionSets != null ? ` (${counts.permissionSets})` : ''}
          </Fragment>
        ),
        titleText: 'Permission Sets',
        content: (
          <div
            className="slds-grid slds-grid_vertical slds-p-around_x-small"
            css={css`
              height: 100%;
            `}
          >
            {truncated && (
              <ScopedNotification theme="warning" className="slds-m-bottom_small">
                Export hit the row limit; some Salesforce rows may be missing from these tables.
              </ScopedNotification>
            )}
            <PermissionAnalysisExportGrid rows={exportBundle.permissionSets} {...gridProps} />
          </div>
        ),
      },
      {
        id: 'assignments',
        title: (
          <Fragment>
            <span className="slds-tabs__left-icon">
              <Icon
                type="standard"
                icon="customer_portal_users"
                containerClassname="slds-icon_container slds-icon-standard-customer-portal-users"
                className="slds-icon slds-icon_small"
              />
            </span>
            Assignments{counts.permissionSetAssignments != null ? ` (${counts.permissionSetAssignments})` : ''}
          </Fragment>
        ),
        titleText: 'Assignments',
        content: (
          <div
            className="slds-p-around_x-small"
            css={css`
              height: 100%;
            `}
          >
            <PermissionAnalysisExportGrid rows={exportBundle.permissionSetAssignments} {...gridProps} />
          </div>
        ),
      },
      {
        id: 'permission-set-groups',
        title: (
          <Fragment>
            <span className="slds-tabs__left-icon">
              <Icon
                type="standard"
                icon="groups"
                containerClassname="slds-icon_container slds-icon-standard-groups"
                className="slds-icon slds-icon_small"
              />
            </span>
            Permission Set Groups
            {counts.permissionSetGroups != null ? ` (${counts.permissionSetGroups})` : ''}
          </Fragment>
        ),
        titleText: 'Permission Set Groups',
        content: (
          <div
            className="slds-grid slds-grid_vertical slds-gutters_x-small slds-p-around_x-small"
            css={css`
              height: 100%;
            `}
          >
            <div>
              <h2 className="slds-text-heading_small slds-m-bottom_x-small">Groups</h2>
              <PermissionAnalysisExportGrid rows={exportBundle.permissionSetGroups} {...gridProps} />
            </div>
            <div>
              <h2 className="slds-text-heading_small slds-m-bottom_x-small">Group components</h2>
              <PermissionAnalysisExportGrid rows={exportBundle.permissionSetGroupComponents} {...gridProps} />
            </div>
            <div>
              <h2 className="slds-text-heading_small slds-m-bottom_x-small">Muting permission sets</h2>
              <PermissionAnalysisExportGrid rows={exportBundle.mutingPermissionSets} {...gridProps} />
            </div>
          </div>
        ),
      },
      {
        id: 'object-permissions',
        title: (
          <Fragment>
            <span className="slds-tabs__left-icon">
              <Icon
                type="standard"
                icon="entity"
                containerClassname="slds-icon_container slds-icon-standard-entity"
                className="slds-icon slds-icon_small"
              />
            </span>
            Object Permissions{counts.objectPermissions != null ? ` (${counts.objectPermissions})` : ''}
          </Fragment>
        ),
        titleText: 'Object Permissions',
        content: (
          <div
            className="slds-p-around_x-small"
            css={css`
              height: 100%;
            `}
          >
            <PermissionAnalysisExportGrid rows={exportBundle.objectPermissions} {...gridProps} />
          </div>
        ),
      },
      {
        id: 'tab-visibility',
        title: (
          <Fragment>
            <span className="slds-tabs__left-icon">
              <Icon
                type="standard"
                icon="portal_roles_and_subordinates"
                containerClassname="slds-icon_container slds-icon-standard-portal-roles-and-subordinates"
                className="slds-icon slds-icon_small"
              />
            </span>
            Tab Visibility{counts.permissionSetTabSettings != null ? ` (${counts.permissionSetTabSettings})` : ''}
          </Fragment>
        ),
        titleText: 'Tab Visibility',
        content: (
          <div
            className="slds-p-around_x-small"
            css={css`
              height: 100%;
            `}
          >
            <PermissionAnalysisExportGrid rows={exportBundle.permissionSetTabSettings} {...gridProps} />
          </div>
        ),
      },
      {
        id: 'field-permissions',
        title: (
          <Fragment>
            <span className="slds-tabs__left-icon">
              <Icon
                type="standard"
                icon="multi_picklist"
                containerClassname="slds-icon_container slds-icon-standard-multi-picklist"
                className="slds-icon slds-icon_small"
              />
            </span>
            Field Permissions{counts.fieldPermissions != null ? ` (${counts.fieldPermissions})` : ''}
          </Fragment>
        ),
        titleText: 'Field Permissions',
        content: (
          <div
            className="slds-p-around_x-small"
            css={css`
              height: 100%;
            `}
          >
            <PermissionAnalysisExportGrid rows={exportBundle.fieldPermissions} {...gridProps} />
          </div>
        ),
      },
      {
        id: 'issues',
        title: (
          <Fragment>
            <span className="slds-tabs__left-icon">
              <Icon
                type="standard"
                icon="incident"
                containerClassname="slds-icon_container slds-icon-standard-incident"
                className="slds-icon slds-icon_small"
              />
            </span>
            Issues{findingsCount > 0 ? ` (${findingsCount})` : ''}
          </Fragment>
        ),
        titleText: 'Issues',
        content: (
          <PermissionAnalysisIssuesTab
            findings={findings}
            permissionSetAssignments={exportBundle.permissionSetAssignments}
            org={selectedOrg}
            serverUrl={serverUrl}
            skipFrontdoorLogin={skipFrontdoorLogin}
            defaultApiVersion={defaultApiVersion}
            searchParams={searchParams}
            setSearchParams={setSearchParams}
          />
        ),
      },
      {
        id: 'raw-json',
        title: (
          <Fragment>
            <span className="slds-tabs__left-icon">
              <Icon
                type="standard"
                icon="apex"
                containerClassname="slds-icon_container slds-icon-standard-apex"
                className="slds-icon slds-icon_small"
              />
            </span>
            Raw JSON
          </Fragment>
        ),
        titleText: 'Raw JSON',
        content: (
          <div className="slds-p-around_medium">
            <pre
              className="slds-box slds-scrollable_y"
              css={css`
                max-height: min(560px, 70vh);
                font-size: 0.75rem;
              `}
            >
              {formatJobResult(jobRecord?.result)}
            </pre>
          </div>
        ),
      },
    ];
  }, [
    selectedOrg,
    parsedExport,
    serverUrl,
    skipFrontdoorLogin,
    defaultApiVersion,
    jobRecord,
    searchParams,
    setSearchParams,
    findingsCount,
  ]);

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
          <Tooltip ariaRole="label" content="View past permission export runs for this org">
            <button
              type="button"
              aria-label="Export history"
              className="slds-button slds-button_neutral collapsible-button collapsible-button-xs"
              css={css`
                padding: 0.5rem;
              `}
              disabled={!selectedOrg?.uniqueId}
              onClick={() => setIsHistoryOpen(true)}
            >
              <Icon type="utility" icon="date_time" className="slds-button__icon" omitContainer title="Export history" />
            </button>
          </Tooltip>
        </ToolbarItemActions>
      </Toolbar>
      {isHistoryOpen && selectedOrg && (
        <PermissionAnalysisHistoryModal
          selectedOrg={selectedOrg}
          currentJobId={jobId}
          onClose={() => setIsHistoryOpen(false)}
          onSelectJob={(nextJobId) => {
            setSearchParams({ job: nextJobId }, { replace: true });
          }}
        />
      )}
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
        {jobId && !fetchError && jobStatusNormalized === 'failed' && jobRecord?.errorMessage != null && (
          <div className="slds-p-around_medium">
            <Toast type="error">{String(jobRecord.errorMessage)}</Toast>
          </div>
        )}
        {jobId && !fetchError && !isTerminal && (
          <div className="slds-p-around_medium">
            {showSpinnerForJobLifecycle && (
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
                  <p className="slds-truncate">{statusDisplay ?? '—'}</p>
                </dd>
                <dt className="slds-dl_horizontal__label">
                  <p className="slds-truncate">Job type</p>
                </dt>
                <dd className="slds-dl_horizontal__detail">
                  <p className="slds-truncate">{jobRecord.jobType != null ? String(jobRecord.jobType) : '—'}</p>
                </dd>
              </dl>
            )}
          </div>
        )}
        {jobId && !fetchError && isTerminal && jobStatusNormalized === 'completed' && parsedExport && selectedOrg && resultTabs && (
          <Fragment>
            {parsedExport.summary && (
              <div className="slds-p-horizontal_medium slds-p-top_x-small">
                <p className="slds-text-body_small slds-text-color_weak">{parsedExport.summary}</p>
              </div>
            )}
            <Tabs initialActiveId="object-permissions" tabs={resultTabs} />
          </Fragment>
        )}
        {jobId && !fetchError && isTerminal && jobStatusNormalized === 'completed' && !parsedExport && jobRecord && (
          <div className="slds-p-around_medium">
            <ScopedNotification theme="warning" className="slds-m-bottom_medium">
              This job result does not include a structured permission export payload. Showing raw JSON only.
            </ScopedNotification>
            <Tabs
              initialActiveId="legacy-json"
              tabs={[
                {
                  id: 'legacy-json',
                  title: 'Raw JSON',
                  titleText: 'Raw JSON',
                  content: (
                    <pre
                      className="slds-box slds-scrollable_y slds-m-around_small"
                      css={css`
                        max-height: 560px;
                        font-size: 0.75rem;
                      `}
                    >
                      {formatJobResult(jobRecord.result)}
                    </pre>
                  ),
                },
              ]}
            />
          </div>
        )}
      </AutoFullHeightContainer>
    </div>
  );
};

export default PermissionAnalysisView;
