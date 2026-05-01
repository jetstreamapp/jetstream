import { css } from '@emotion/react';
import { logger } from '@jetstream/shared/client-logger';
import { describeGlobal, getAnalysisJob, queryWithCache } from '@jetstream/shared/data';
import { escapeSoqlString } from '@jetstream/shared/ui-utils';
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
import { PermissionAnalysisExportGrid } from './PermissionAnalysisExportGrid';
import { PermissionAnalysisObjectPermissionsTree } from './PermissionAnalysisObjectPermissionsTree';
import { PermissionAnalysisPermissionSetsTree } from './PermissionAnalysisPermissionSetsTree';
import { PermissionAnalysisHistoryModal } from './PermissionAnalysisHistoryModal';
import { PermissionAnalysisIssuesTab } from './PermissionAnalysisIssuesTab';
import {
  buildPermissionSetIdLabelMap,
  collectSobjectApiNamesFromPermissionExport,
  filterPermissionSetExportRowsById,
  parsePermissionExportRequestScope,
  parsePermissionExportResult,
  type SobjectExportDetail,
} from './permission-export-result-view';

const HEIGHT_BUFFER = 170;
const ENTITY_DEFINITION_CHUNK_SIZE = 40;

interface ToolingEntityDefinitionRow {
  QualifiedApiName: string;
  Label?: string | null;
  Description?: string | null;
}

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
  const [sobjectExportDetails, setSobjectExportDetails] = useState<Record<string, SobjectExportDetail>>({});

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
  const isTerminal = jobStatusNormalized === 'completed' || jobStatusNormalized === 'failed';

  const parsedExport = useMemo(() => {
    if (!jobRecord?.result) {
      return null;
    }
    return parsePermissionExportResult(jobRecord.result);
  }, [jobRecord]);

  useEffect(() => {
    const exportSnapshot = parsedExport;

    if (!selectedOrg?.uniqueId) {
      setSobjectExportDetails({});
      return;
    }

    if (!exportSnapshot) {
      setSobjectExportDetails({});
      return;
    }

    const exportBundleForSobjects = exportSnapshot.export;

    let cancelled = false;

    async function loadSobjectExportDetails() {
      const details: Record<string, SobjectExportDetail> = {};
      try {
        const describeResponse = await describeGlobal(selectedOrg);
        if (cancelled) {
          return;
        }
        if (describeResponse.data?.sobjects) {
          for (const sobject of describeResponse.data.sobjects) {
            details[sobject.name] = {
              apiName: sobject.name,
              label: sobject.label,
              description: null,
            };
          }
        }
      } catch (error) {
        if (!cancelled) {
          logger.error('Failed to load describe global for permission analysis object metadata', error);
        }
      }

      if (cancelled) {
        return;
      }

      const apiNames = collectSobjectApiNamesFromPermissionExport(exportBundleForSobjects);
      for (let offset = 0; offset < apiNames.length; offset += ENTITY_DEFINITION_CHUNK_SIZE) {
        if (cancelled) {
          return;
        }
        const chunk = apiNames.slice(offset, offset + ENTITY_DEFINITION_CHUNK_SIZE);
        const inList = chunk.map((name) => `'${escapeSoqlString(name)}'`).join(', ');
        const soql = `SELECT QualifiedApiName, Label, Description FROM EntityDefinition WHERE QualifiedApiName IN (${inList})`;
        try {
          const { data } = await queryWithCache<ToolingEntityDefinitionRow>(selectedOrg, soql, true);
          const records = data?.queryResults?.records;
          if (!Array.isArray(records)) {
            continue;
          }
          for (const record of records) {
            const api = record.QualifiedApiName;
            if (typeof api !== 'string' || api.trim().length === 0) {
              continue;
            }
            const existing = details[api];
            const descriptionFromEd =
              record.Description != null && String(record.Description).trim().length > 0
                ? String(record.Description).trim()
                : (existing?.description ?? null);
            const labelFromEd = typeof record.Label === 'string' && record.Label.trim().length > 0 ? record.Label.trim() : api;
            details[api] = {
              apiName: api,
              label: existing?.label ?? labelFromEd,
              description: descriptionFromEd,
            };
          }
        } catch (entityDefinitionError) {
          logger.warn('EntityDefinition query failed for permission analysis object metadata', entityDefinitionError);
        }
      }

      for (const api of apiNames) {
        if (!details[api]) {
          details[api] = { apiName: api, label: api, description: null };
        }
      }

      if (!cancelled) {
        setSobjectExportDetails(details);
      }
    }

    void loadSobjectExportDetails();

    return () => {
      cancelled = true;
    };
  }, [selectedOrg, parsedExport]);

  const findingsCount = parsedExport?.findings.length ?? 0;

  const resultTabs = useMemo(() => {
    if (!selectedOrg || !parsedExport) {
      return null;
    }

    const { export: exportBundle, truncated, findings } = parsedExport;
    const counts = parsedExport.counts;

    const containerLabelById = buildPermissionSetIdLabelMap(exportBundle.permissionSets);
    const exportFindingProps = { findings, containerLabelById };

    const gridProps = {
      org: selectedOrg,
      serverUrl,
      skipFrontdoorLogin,
      defaultApiVersion,
      sobjectExportDetails,
    };

    const requestScope = parsePermissionExportRequestScope(jobRecord?.result);
    const hasExplicitScope = requestScope.profilePermissionSetIds.length > 0 || requestScope.permissionSetIds.length > 0;
    const profileIdSet = new Set(requestScope.profilePermissionSetIds);
    const permissionSetIdSet = new Set(requestScope.permissionSetIds);
    const profilePermissionSetRows = filterPermissionSetExportRowsById(exportBundle.permissionSets, profileIdSet);
    let standalonePermissionSetRows = filterPermissionSetExportRowsById(exportBundle.permissionSets, permissionSetIdSet);
    let showProfilesTab = requestScope.profilePermissionSetIds.length > 0;
    let showPermissionSetsTab = requestScope.permissionSetIds.length > 0;

    if (!hasExplicitScope && exportBundle.permissionSets.length > 0) {
      showProfilesTab = false;
      showPermissionSetsTab = true;
      standalonePermissionSetRows = exportBundle.permissionSets;
    }

    const showPermissionSetGroupsTab =
      exportBundle.permissionSetGroups.length > 0 ||
      exportBundle.permissionSetGroupComponents.length > 0 ||
      exportBundle.mutingPermissionSets.length > 0;

    function renderTruncationNotice() {
      if (!truncated) {
        return null;
      }
      return (
        <ScopedNotification theme="warning" className="slds-m-bottom_small">
          Export hit the row limit; some Salesforce rows may be missing from these tables.
        </ScopedNotification>
      );
    }

    const profilesTab = {
      id: 'profiles',
      title: (
        <Fragment>
          <span className="slds-tabs__left-icon">
            <Icon
              type="standard"
              icon="customers"
              containerClassname="slds-icon_container slds-icon-standard-customers"
              className="slds-icon slds-icon_small"
            />
          </span>
          Profiles ({profilePermissionSetRows.length})
        </Fragment>
      ),
      titleText: 'Profiles',
      content: (
        <div
          className="slds-grid slds-grid_vertical slds-p-around_x-small"
          css={css`
            height: 100%;
          `}
        >
          {renderTruncationNotice()}
          <PermissionAnalysisExportGrid
            rows={profilePermissionSetRows}
            {...gridProps}
            {...exportFindingProps}
            findingSurface="container_row"
          />
        </div>
      ),
    };

    const permissionSetsTab = {
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
          Permission Sets ({standalonePermissionSetRows.length})
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
          {renderTruncationNotice()}
          <PermissionAnalysisPermissionSetsTree
            permissionSetRows={standalonePermissionSetRows}
            permissionSetAssignments={exportBundle.permissionSetAssignments}
            findings={findings}
            containerLabelById={containerLabelById}
            {...gridProps}
          />
        </div>
      ),
    };

    return [
      ...(showProfilesTab ? [profilesTab] : []),
      ...(showPermissionSetsTab ? [permissionSetsTab] : []),
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
            {renderTruncationNotice()}
            <PermissionAnalysisExportGrid
              rows={exportBundle.permissionSetAssignments}
              {...gridProps}
              {...exportFindingProps}
              findingSurface="assignment_row"
            />
          </div>
        ),
      },
      ...(showPermissionSetGroupsTab
        ? [
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
                  {renderTruncationNotice()}
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
          ]
        : []),
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
            {renderTruncationNotice()}
            <PermissionAnalysisObjectPermissionsTree
              objectPermissionRows={exportBundle.objectPermissions}
              permissionSetRows={exportBundle.permissionSets}
              findings={findings}
              {...gridProps}
            />
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
            {renderTruncationNotice()}
            <PermissionAnalysisExportGrid
              rows={exportBundle.permissionSetTabSettings}
              {...gridProps}
              {...exportFindingProps}
              findingSurface="tab_visibility_row"
            />
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
            {renderTruncationNotice()}
            <PermissionAnalysisExportGrid
              rows={exportBundle.fieldPermissions}
              {...gridProps}
              {...exportFindingProps}
              findingSurface="field_permissions"
            />
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
    sobjectExportDetails,
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
            <Spinner />
          </div>
        )}
        {jobId && !fetchError && isTerminal && jobStatusNormalized === 'completed' && parsedExport && selectedOrg && resultTabs && (
          <Fragment>
            {parsedExport.summary && (
              <div className="slds-p-horizontal_medium slds-p-top_x-small">
                <p className="slds-text-body_small slds-text-color_weak">{parsedExport.summary}</p>
              </div>
            )}
            <Tabs key={resultTabs.map((tab) => tab.id).join('|')} initialActiveId={resultTabs[0]?.id ?? 'assignments'} tabs={resultTabs} />
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
