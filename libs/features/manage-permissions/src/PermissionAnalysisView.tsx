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
import { PermissionAnalysisFieldPermissionsTree } from './PermissionAnalysisFieldPermissionsTree';
import { PermissionAnalysisObjectPermissionsTree } from './PermissionAnalysisObjectPermissionsTree';
import { PermissionAnalysisTabVisibilityTree } from './PermissionAnalysisTabVisibilityTree';
import { PermissionAnalysisPermissionSetsTree } from './PermissionAnalysisPermissionSetsTree';
import { PermissionAnalysisUserAssignmentsTree } from './PermissionAnalysisUserAssignmentsTree';
import { PermissionAnalysisExportMetadataProvider } from './permission-analysis-export-metadata-context';
import { PermissionAnalysisFindingsFiltersBar } from './PermissionAnalysisFindingsFiltersBar';
import { PermissionAnalysisHistoryModal } from './PermissionAnalysisHistoryModal';
import { PermissionAnalysisIssuesTab } from './PermissionAnalysisIssuesTab';
import { usePermissionAnalysisIssuesFilters } from './permission-analysis-issues-filters';
import {
  buildPermissionSetIdLabelMap,
  collectSobjectApiNamesFromPermissionExport,
  collectTabSettingNamesFromPermissionExport,
  fieldExportDetailLookupKey,
  fieldPermissionQualifiedFieldShortApi,
  filterPermissionSetExportRowsById,
  parsePermissionExportRequestScope,
  parsePermissionExportResult,
  type FieldExportDetail,
  type PermissionAnalysisFinding,
  type PermissionExportRow,
  type SobjectExportDetail,
} from './permission-export-result-view';

const EMPTY_PERMISSION_ANALYSIS_FINDINGS: PermissionAnalysisFinding[] = [];
const EMPTY_PERMISSION_EXPORT_ASSIGNMENT_ROWS: PermissionExportRow[] = [];

const HEIGHT_BUFFER = 170;
const ENTITY_DEFINITION_CHUNK_SIZE = 40;
const TAB_DEFINITION_CHUNK_SIZE = 100;
const FIELD_DEFINITION_CHUNK_SIZE = 50;
/** Max concurrent per-object FieldDefinition Tooling queries (avoids unbounded parallel requests). */
const FIELD_DEFINITION_OBJECT_CONCURRENCY = 5;

async function mapPool<T>(items: readonly T[], concurrency: number, fn: (item: T) => Promise<void>): Promise<void> {
  if (items.length === 0) {
    return;
  }
  const workerCount = Math.max(1, Math.min(concurrency, items.length));
  let nextIndex = 0;
  async function worker(): Promise<void> {
    while (true) {
      const index = nextIndex++;
      if (index >= items.length) {
        return;
      }
      await fn(items[index]);
    }
  }
  await Promise.all(Array.from({ length: workerCount }, () => worker()));
}

interface ToolingEntityDefinitionRow {
  QualifiedApiName: string;
  Label?: string | null;
  Description?: string | null;
}

interface ToolingTabDefinitionRow {
  Name: string;
  Label?: string | null;
}

interface ToolingFieldDefinitionRow {
  QualifiedApiName: string;
  Label?: string | null;
  Description?: string | null;
  DurableId?: string | null;
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
  const [tabLabelBySettingName, setTabLabelBySettingName] = useState<Map<string, string>>(() => new Map());
  const [fieldExportDetails, setFieldExportDetails] = useState<Record<string, FieldExportDetail>>({});

  useEffect(() => {
    if (!selectedOrg?.uniqueId || !jobId) {
      return;
    }

    // eslint-disable-next-line react-hooks/set-state-in-effect -- switching org/job clears stale record until poll returns
    setJobRecord(null);

    const orgForPoll = selectedOrg;
    const jobIdForPoll = jobId;

    let cancelled = false;
    let intervalId: ReturnType<typeof setInterval> | undefined;
    /** Visible-tab polling interval; backs off slightly while the job stays non-terminal. */
    let pollIntervalMs = 2000;
    let consecutiveNonTerminalSuccess = 0;

    const clearPolling = () => {
      if (intervalId !== undefined) {
        clearInterval(intervalId);
        intervalId = undefined;
      }
    };

    const effectivePollIntervalMs = () => {
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') {
        return Math.max(pollIntervalMs, 12000);
      }
      return pollIntervalMs;
    };

    const schedulePolling = () => {
      clearPolling();
      intervalId = setInterval(() => void pollOnce(), effectivePollIntervalMs());
    };

    async function pollOnce() {
      try {
        const { job } = await getAnalysisJob(orgForPoll, jobIdForPoll);
        if (cancelled) {
          return;
        }
        setJobRecord(job);
        setFetchError(null);
        const status = String(job.status ?? '');
        if (status === 'completed' || status === 'failed') {
          clearPolling();
          return;
        }
        consecutiveNonTerminalSuccess += 1;
        const nextMs = Math.min(5000, 2000 + (consecutiveNonTerminalSuccess - 1) * 500);
        if (nextMs !== pollIntervalMs) {
          pollIntervalMs = nextMs;
          schedulePolling();
        }
      } catch (ex) {
        if (!cancelled) {
          setFetchError(getErrorMessage(ex));
          logger.error('Failed to load analysis job', ex);
          clearPolling();
        }
      }
    }

    const onVisibilityChange = () => {
      if (cancelled) {
        return;
      }
      if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
        pollIntervalMs = 2000;
        consecutiveNonTerminalSuccess = 0;
        void pollOnce();
      }
      schedulePolling();
    };

    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', onVisibilityChange);
    }

    void pollOnce();
    schedulePolling();

    return () => {
      cancelled = true;
      if (typeof document !== 'undefined') {
        document.removeEventListener('visibilitychange', onVisibilityChange);
      }
      clearPolling();
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

  const issueScopeFilterContext = useMemo(() => {
    if (!jobRecord?.result) {
      return undefined;
    }
    const scope = parsePermissionExportRequestScope(jobRecord.result);
    const supportsExportScopeFilter = scope.profilePermissionSetIds.length > 0 && scope.permissionSetIds.length > 0;
    return {
      supportsExportScopeFilter,
      profilePermissionSetIds: new Set(scope.profilePermissionSetIds),
      permissionSetIds: new Set(scope.permissionSetIds),
    };
  }, [jobRecord]);

  const exportObjectScopeNames = useMemo(() => parsePermissionExportRequestScope(jobRecord?.result).objectApiNames, [jobRecord]);

  const permissionAnalysisIssuesFilters = usePermissionAnalysisIssuesFilters({
    findings: parsedExport?.findings ?? EMPTY_PERMISSION_ANALYSIS_FINDINGS,
    permissionSetAssignments: parsedExport?.export.permissionSetAssignments ?? EMPTY_PERMISSION_EXPORT_ASSIGNMENT_ROWS,
    searchParams,
    setSearchParams,
    issueScopeFilterContext,
  });
  const globallyFilteredFindings = permissionAnalysisIssuesFilters.filteredFindings;

  useEffect(() => {
    const exportSnapshot = parsedExport;

    if (!selectedOrg?.uniqueId) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- reset cached labels when org clears
      setSobjectExportDetails({});
      return;
    }

    if (!exportSnapshot) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- reset when job payload missing
      setSobjectExportDetails({});
      return;
    }

    const exportBundleForSobjects = exportSnapshot.export;

    let cancelled = false;

    async function loadSobjectExportDetails() {
      /** Primary labels/descriptions from EntityDefinition; describeGlobal only for APIs missing from ED (odd/large orgs). */
      const details: Record<string, SobjectExportDetail> = {};
      const returnedFromEntityDefinition = new Set<string>();

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
            returnedFromEntityDefinition.add(api);
            const existing = details[api];
            const descriptionFromEd =
              record.Description != null && String(record.Description).trim().length > 0
                ? String(record.Description).trim()
                : (existing?.description ?? null);
            const labelFromEd = typeof record.Label === 'string' && record.Label.trim().length > 0 ? record.Label.trim() : api;
            details[api] = {
              apiName: api,
              label: labelFromEd,
              description: descriptionFromEd,
            };
          }
        } catch (entityDefinitionError) {
          logger.warn('EntityDefinition query failed for permission analysis object metadata', entityDefinitionError);
        }
      }

      const missingFromEntityDefinition = apiNames.filter((api) => !returnedFromEntityDefinition.has(api));
      if (missingFromEntityDefinition.length > 0 && !cancelled) {
        try {
          const { data } = await describeGlobal(selectedOrg, false);
          const sobjects = data?.sobjects;
          if (Array.isArray(sobjects)) {
            const byName = new Map(sobjects.map((s) => [s.name, s]));
            for (const api of missingFromEntityDefinition) {
              const described = byName.get(api);
              if (described) {
                const label = typeof described.label === 'string' && described.label.trim().length > 0 ? described.label.trim() : api;
                details[api] = {
                  apiName: api,
                  label,
                  description: null,
                };
              }
            }
          }
        } catch (describeGlobalError) {
          logger.warn('describeGlobal fallback failed for permission analysis object metadata', describeGlobalError);
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

  useEffect(() => {
    if (!selectedOrg?.uniqueId) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- reset cached tab labels when org clears
      setTabLabelBySettingName(new Map());
      return;
    }

    if (!parsedExport) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- reset when export snapshot missing
      setTabLabelBySettingName(new Map());
      return;
    }

    const exportBundleForTabs = parsedExport.export;
    let cancelled = false;

    async function loadTabDefinitionLabels() {
      const tabNames = collectTabSettingNamesFromPermissionExport(exportBundleForTabs);
      const labelMap = new Map<string, string>();

      for (let offset = 0; offset < tabNames.length; offset += TAB_DEFINITION_CHUNK_SIZE) {
        if (cancelled) {
          return;
        }
        const chunk = tabNames.slice(offset, offset + TAB_DEFINITION_CHUNK_SIZE);
        const inList = chunk.map((name) => `'${escapeSoqlString(name)}'`).join(', ');
        const soql = `SELECT Name, Label FROM TabDefinition WHERE Name IN (${inList})`;
        try {
          const { data } = await queryWithCache<ToolingTabDefinitionRow>(selectedOrg, soql, true);
          const records = data?.queryResults?.records;
          if (!Array.isArray(records)) {
            continue;
          }
          for (const record of records) {
            const api = record.Name;
            if (typeof api !== 'string' || api.trim().length === 0) {
              continue;
            }
            const trimmedApi = api.trim();
            const labelFromTd = typeof record.Label === 'string' && record.Label.trim().length > 0 ? record.Label.trim() : trimmedApi;
            labelMap.set(trimmedApi, labelFromTd);
          }
        } catch (tabDefinitionError) {
          logger.warn('TabDefinition query failed for permission analysis tab labels', tabDefinitionError);
        }
      }

      if (!cancelled) {
        setTabLabelBySettingName(labelMap);
      }
    }

    void loadTabDefinitionLabels();

    return () => {
      cancelled = true;
    };
  }, [selectedOrg, parsedExport]);

  useEffect(() => {
    if (!selectedOrg?.uniqueId) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- reset cached field labels when org clears
      setFieldExportDetails({});
      return;
    }

    if (!parsedExport) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- reset when export snapshot missing
      setFieldExportDetails({});
      return;
    }

    const bundle = parsedExport.export;
    let cancelled = false;

    async function loadFieldDefinitions() {
      const fieldsByObject = new Map<string, Set<string>>();
      for (const row of bundle.fieldPermissions) {
        const obj = typeof row.SobjectType === 'string' ? row.SobjectType.trim() : '';
        if (!obj) {
          continue;
        }
        const short = fieldPermissionQualifiedFieldShortApi(row);
        if (!short) {
          continue;
        }
        let fieldSet = fieldsByObject.get(obj);
        if (!fieldSet) {
          fieldSet = new Set();
          fieldsByObject.set(obj, fieldSet);
        }
        fieldSet.add(short);
      }

      const details: Record<string, FieldExportDetail> = {};

      const objectWorkItems = [...fieldsByObject.entries()].map(([objectApi, fieldSet]) => ({
        objectApi,
        names: [...fieldSet].sort((a, b) => a.localeCompare(b)),
      }));

      await mapPool(objectWorkItems, FIELD_DEFINITION_OBJECT_CONCURRENCY, async ({ objectApi, names }) => {
        for (let offset = 0; offset < names.length; offset += FIELD_DEFINITION_CHUNK_SIZE) {
          if (cancelled) {
            return;
          }
          const chunk = names.slice(offset, offset + FIELD_DEFINITION_CHUNK_SIZE);
          const inList = chunk.map((name) => `'${escapeSoqlString(name)}'`).join(', ');
          const soql = `SELECT QualifiedApiName, Label, Description, DurableId FROM FieldDefinition WHERE EntityDefinition.QualifiedApiName = '${escapeSoqlString(objectApi)}' AND QualifiedApiName IN (${inList})`;
          try {
            const { data } = await queryWithCache<ToolingFieldDefinitionRow>(selectedOrg, soql, true);
            const records = data?.queryResults?.records;
            if (!Array.isArray(records)) {
              continue;
            }
            for (const record of records) {
              const qn = record.QualifiedApiName;
              if (typeof qn !== 'string' || qn.trim().length === 0) {
                continue;
              }
              const qualified = qn.trim();
              const key = fieldExportDetailLookupKey(objectApi, qualified);
              const labelFromFd = typeof record.Label === 'string' && record.Label.trim().length > 0 ? record.Label.trim() : qualified;
              const desc =
                record.Description != null && String(record.Description).trim().length > 0 ? String(record.Description).trim() : null;
              const durable = typeof record.DurableId === 'string' && record.DurableId.trim().length > 0 ? record.DurableId.trim() : null;
              details[key] = {
                objectApiName: objectApi,
                qualifiedApiName: qualified,
                label: labelFromFd,
                description: desc,
                durableId: durable,
              };
            }
          } catch (fieldDefinitionError) {
            logger.warn('FieldDefinition query failed for permission analysis field metadata', fieldDefinitionError);
          }
        }
      });

      if (!cancelled) {
        setFieldExportDetails(details);
      }
    }

    void loadFieldDefinitions();

    return () => {
      cancelled = true;
    };
  }, [selectedOrg, parsedExport]);

  const findingsCount = parsedExport?.findings.length ?? 0;

  const permissionAnalysisExportMetadata = useMemo(
    () => ({ fieldExportDetails, tabLabelBySettingName }),
    [fieldExportDetails, tabLabelBySettingName],
  );

  const resultTabs = useMemo(() => {
    if (!selectedOrg || !parsedExport) {
      return null;
    }

    const { export: exportBundle, truncated, findings: allFindings } = parsedExport;
    const counts = parsedExport.counts;

    const containerLabelById = buildPermissionSetIdLabelMap(exportBundle.permissionSets);
    const exportFindingProps = { findings: globallyFilteredFindings, containerLabelById };

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
            findings={globallyFilteredFindings}
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
            className="slds-grid slds-grid_vertical slds-p-around_x-small"
            css={css`
              height: 100%;
            `}
          >
            {renderTruncationNotice()}
            <PermissionAnalysisUserAssignmentsTree
              permissionSetAssignments={exportBundle.permissionSetAssignments}
              permissionSets={exportBundle.permissionSets}
              permissionSetGroupComponents={exportBundle.permissionSetGroupComponents}
              permissionSetGroups={exportBundle.permissionSetGroups}
              findings={globallyFilteredFindings}
              containerLabelById={containerLabelById}
              {...gridProps}
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
              findings={globallyFilteredFindings}
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
            className="slds-grid slds-grid_vertical slds-p-around_x-small"
            css={css`
              height: 100%;
            `}
          >
            {renderTruncationNotice()}
            <PermissionAnalysisTabVisibilityTree
              tabSettingRows={exportBundle.permissionSetTabSettings}
              permissionSetRows={exportBundle.permissionSets}
              findings={globallyFilteredFindings}
              containerLabelById={containerLabelById}
              {...gridProps}
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
            <PermissionAnalysisFieldPermissionsTree
              fieldPermissionRows={exportBundle.fieldPermissions}
              permissionSetRows={exportBundle.permissionSets}
              findings={globallyFilteredFindings}
              {...gridProps}
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
            findings={allFindings}
            issuesFilters={permissionAnalysisIssuesFilters}
            org={selectedOrg}
            serverUrl={serverUrl}
            skipFrontdoorLogin={skipFrontdoorLogin}
            defaultApiVersion={defaultApiVersion}
            sobjectExportDetails={sobjectExportDetails}
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
    findingsCount,
    sobjectExportDetails,
    permissionAnalysisIssuesFilters,
    globallyFilteredFindings,
  ]);

  return (
    <div>
      <RequireMetadataApiBanner />
      <Toolbar>
        <div
          css={css`
            display: flex;
            width: 100%;
            min-width: 0;
            align-items: center;
            flex-wrap: nowrap;
            gap: 0.5rem 0.75rem;
          `}
        >
          <div
            css={css`
              flex: 0 0 auto;
            `}
          >
            <ToolbarItemGroup>
              <Link className="slds-button slds-button_brand" to="..">
                <Icon type="utility" icon="back" className="slds-button__icon slds-button__icon_left" omitContainer />
                Go Back
              </Link>
            </ToolbarItemGroup>
          </div>
          <div
            css={css`
              flex: 1 1 0;
              min-width: 0;
              overflow-x: auto;
              overflow-y: hidden;
            `}
          >
            {jobId && !fetchError && isTerminal && jobStatusNormalized === 'completed' && parsedExport && selectedOrg ? (
              <div
                css={css`
                  width: max-content;
                  min-width: 100%;
                  min-height: 0;
                `}
              >
                <PermissionAnalysisFindingsFiltersBar findings={parsedExport.findings} issuesFilters={permissionAnalysisIssuesFilters} />
              </div>
            ) : null}
          </div>
          <div
            css={css`
              flex: 0 0 auto;
            `}
          >
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
          </div>
        </div>
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
          <PermissionAnalysisExportMetadataProvider value={permissionAnalysisExportMetadata}>
            <Fragment>
              {exportObjectScopeNames.length > 0 && (
                <div className="slds-p-horizontal_medium slds-p-top_x-small">
                  <ScopedNotification theme="info">
                    Object scope for object and field permissions ({exportObjectScopeNames.length} type
                    {exportObjectScopeNames.length === 1 ? '' : 's'}
                    ):
                    {exportObjectScopeNames.length <= 8 ? (
                      <> {exportObjectScopeNames.join(', ')}.</>
                    ) : (
                      <>
                        {' '}
                        {exportObjectScopeNames.slice(0, 8).join(', ')}… and {exportObjectScopeNames.length - 8} more.
                      </>
                    )}{' '}
                    Tab visibility and permission set lists are not filtered by object.
                  </ScopedNotification>
                </div>
              )}
              {parsedExport.summary && (
                <div className="slds-p-horizontal_medium slds-p-top_x-small">
                  <p className="slds-text-body_small slds-text-color_weak">{parsedExport.summary}</p>
                </div>
              )}
              <Tabs
                key={resultTabs.map((tab) => tab.id).join('|')}
                initialActiveId={resultTabs[0]?.id ?? 'assignments'}
                tabs={resultTabs}
              />
            </Fragment>
          </PermissionAnalysisExportMetadataProvider>
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
