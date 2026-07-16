import { css } from '@emotion/react';
import { logger } from '@jetstream/shared/client-logger';
import { describeGlobal, queryWithCache } from '@jetstream/shared/data';
import { escapeSoqlString, formatNumber } from '@jetstream/shared/ui-utils';
import { getErrorMessage, gzipDecode } from '@jetstream/shared/utils';
import type { AsyncJob, PermissionExportAnalysisJob, PermissionExportFullResult } from '@jetstream/types';
import {
  AutoFullHeightContainer,
  Icon,
  ProgressIndicator,
  ScopedNotification,
  Tabs,
  Toast,
  Toolbar,
  ToolbarItemActions,
  ToolbarItemGroup,
  Tooltip,
} from '@jetstream/ui';
import { PermissionAnalysisHistoryModal, RequireMetadataApiBanner, jobsState } from '@jetstream/ui-core';
import { applicationCookieState, selectSkipFrontdoorAuth, selectedOrgState } from '@jetstream/ui/app-state';
import { dexieDb } from '@jetstream/ui/db';
import { useLiveQuery } from 'dexie-react-hooks';
import { useAtomValue } from 'jotai';
import { Fragment, FunctionComponent, useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { PermissionAnalysisExportGrid } from './PermissionAnalysisExportGrid';
import { PermissionAnalysisFieldPermissionsTree } from './PermissionAnalysisFieldPermissionsTree';
import { PermissionAnalysisFindingsFiltersBar } from './PermissionAnalysisFindingsFiltersBar';
import { PermissionAnalysisIssuesTab } from './PermissionAnalysisIssuesTab';
import { PermissionAnalysisObjectPermissionsTree } from './PermissionAnalysisObjectPermissionsTree';
import { PermissionAnalysisPermissionSetsTree } from './PermissionAnalysisPermissionSetsTree';
import { PermissionAnalysisTabVisibilityTree } from './PermissionAnalysisTabVisibilityTree';
import { PermissionAnalysisUserAssignmentsTree } from './PermissionAnalysisUserAssignmentsTree';
import { PermissionAnalysisExportMetadataProvider } from './permission-analysis-export-metadata-context';
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

/** True for local Vite dev; false in production builds — used to avoid exposing raw job payloads in prod. */
const SHOW_RAW_JOB_JSON_UI = import.meta.env.DEV;

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
 * Lazily stringifies the result when the Raw JSON tab actually renders. Stringifying inline inside
 * the `resultTabs` useMemo would re-run on every memo dep change even if the tab isn't active —
 * for ~20 MB blobs in dev that adds noticeable jank when toggling filters.
 */
const RawJsonTabContent: FunctionComponent<{ result: unknown }> = ({ result }) => {
  const formatted = useMemo(() => formatJobResult(result), [result]);
  return (
    <div className="slds-p-around_medium">
      <pre
        className="slds-box slds-scrollable_y"
        css={css`
          max-height: min(560px, 70vh);
          font-size: 0.75rem;
        `}
      >
        {formatted}
      </pre>
    </div>
  );
};

/**
 * Read-only analysis workspace. Subscribes to the in-flight job entry (jotai jobsState) for progress
 * and to Dexie `analysis_job_history` for the terminal row; no HTTP polling. Result decoding happens
 * once per Dexie row (gzip decompress) and is reshaped into the envelope the parser expects.
 */
export const PermissionAnalysisView: FunctionComponent = () => {
  const selectedOrg = useAtomValue(selectedOrgState);
  const { serverUrl, defaultApiVersion } = useAtomValue(applicationCookieState);
  const skipFrontdoorLogin = useAtomValue(selectSkipFrontdoorAuth);
  const jobs = useAtomValue(jobsState);
  const [searchParams, setSearchParams] = useSearchParams();
  const jobId = searchParams.get('job');

  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [sobjectExportDetails, setSobjectExportDetails] = useState<Record<string, SobjectExportDetail>>({});
  const [tabLabelBySettingName, setTabLabelBySettingName] = useState<Map<string, string>>(() => new Map());
  const [fieldExportDetails, setFieldExportDetails] = useState<Record<string, FieldExportDetail>>({});
  const [decodedFullResult, setDecodedFullResult] = useState<PermissionExportFullResult | null>(null);
  const [decodeError, setDecodeError] = useState<string | null>(null);

  /**
   * Live in-flight AsyncJob for this jobHistoryKey, when present. Drives the progress UI before the
   * Dexie terminal row lands; the Jobs popover shows the same entry.
   */
  const inFlightJob: AsyncJob<PermissionExportAnalysisJob> | null = useMemo(() => {
    if (!jobId) {
      return null;
    }
    for (const candidate of Object.values(jobs)) {
      if (candidate.type !== 'PermissionExportAnalysis') {
        continue;
      }
      const meta = candidate.meta as PermissionExportAnalysisJob | undefined;
      if (meta?.jobHistoryKey === jobId) {
        return candidate as AsyncJob<PermissionExportAnalysisJob>;
      }
    }
    return null;
  }, [jobs, jobId]);

  const inFlightStatus = inFlightJob?.status;
  const isJobRunning = inFlightStatus === 'pending' || inFlightStatus === 'in-progress';

  /**
   * Terminal Dexie row for this jobHistoryKey, kept reactive via useLiveQuery so the view updates
   * the moment the JobWorker writes the row. Scoped to the selected org: a row whose `org` does not
   * match (bookmarked/copied key, or org switched while the URL still has an old key) resolves to
   * `undefined` so we never show another org's analysis in this org's context.
   */
  const selectedOrgId = selectedOrg?.uniqueId;
  const historyRow = useLiveQuery(async () => {
    if (!jobId || !selectedOrgId) {
      return undefined;
    }
    const row = await dexieDb.analysis_job_history.get(jobId);
    return row && row.org === selectedOrgId ? row : undefined;
  }, [jobId, selectedOrgId]);

  useEffect(() => {
    // Eagerly drop any prior decoded payload so switching between large completed runs doesn't keep both
    // the old and new uncompressed blobs in memory while the new gunzip resolves.
    // eslint-disable-next-line react-hooks/set-state-in-effect -- clear stale decoded payload when job/row changes
    setDecodedFullResult(null);
    setDecodeError(null);
    if (!historyRow || historyRow.status !== 'completed' || !historyRow.resultBlob) {
      return;
    }
    let cancelled = false;
    gzipDecode<PermissionExportFullResult>(historyRow.resultBlob)
      .then((decoded) => {
        if (!cancelled) {
          setDecodedFullResult(decoded);
        }
      })
      .catch((ex) => {
        if (!cancelled) {
          logger.error('Failed to decode permission_export history blob', ex);
          setDecodeError(getErrorMessage(ex));
        }
      });
    return () => {
      cancelled = true;
    };
  }, [historyRow]);

  const jobStatusNormalized = useMemo(() => {
    if (historyRow?.status === 'completed' || historyRow?.status === 'failed') {
      return historyRow.status;
    }
    if (isJobRunning) {
      return 'running';
    }
    if (inFlightStatus === 'failed' || inFlightStatus === 'aborted') {
      return 'failed';
    }
    return null;
  }, [historyRow?.status, isJobRunning, inFlightStatus]);

  const isTerminal = jobStatusNormalized === 'completed' || jobStatusNormalized === 'failed';
  const fetchError = decodeError;
  const terminalErrorMessage = historyRow?.errorMessage ?? inFlightJob?.statusMessage ?? null;
  const liveProgress = inFlightJob?.progress;

  /**
   * The decoded blob from Dexie has the FLAT merged shape (counts, findings, permissionSets, etc.
   * at the top level). The parser expects a nested envelope `{ ...summary, export: { permissionSets, ... } }`.
   * Reshape once and feed both the parser and downstream consumers (request-scope lookups) the same root.
   */
  const reshapedJobResult = useMemo(() => {
    if (!decodedFullResult) {
      return null;
    }
    return {
      requestPayload: decodedFullResult.requestPayload,
      phase: decodedFullResult.phase,
      summary: decodedFullResult.summary,
      truncated: decodedFullResult.truncated,
      counts: decodedFullResult.counts,
      findings: decodedFullResult.findings,
      issueCodeSummary: decodedFullResult.issueCodeSummary,
      export: {
        permissionSets: decodedFullResult.permissionSets,
        permissionSetAssignments: decodedFullResult.permissionSetAssignments,
        permissionSetGroups: decodedFullResult.permissionSetGroups,
        permissionSetGroupComponents: decodedFullResult.permissionSetGroupComponents,
        mutingPermissionSets: decodedFullResult.mutingPermissionSets,
        objectPermissions: decodedFullResult.objectPermissions,
        fieldPermissions: decodedFullResult.fieldPermissions,
        permissionSetTabSettings: decodedFullResult.permissionSetTabSettings,
      },
    };
  }, [decodedFullResult]);

  const parsedExport = useMemo(() => {
    if (!reshapedJobResult) {
      return null;
    }
    return parsePermissionExportResult(reshapedJobResult);
  }, [reshapedJobResult]);

  const issueScopeFilterContext = useMemo(() => {
    if (!reshapedJobResult) {
      return undefined;
    }
    const scope = parsePermissionExportRequestScope(reshapedJobResult);
    const supportsExportScopeFilter = scope.profilePermissionSetIds.length > 0 && scope.permissionSetIds.length > 0;
    return {
      supportsExportScopeFilter,
      profilePermissionSetIds: new Set(scope.profilePermissionSetIds),
      permissionSetIds: new Set(scope.permissionSetIds),
    };
  }, [reshapedJobResult]);

  const exportObjectScopeNames = useMemo(() => parsePermissionExportRequestScope(reshapedJobResult).objectApiNames, [reshapedJobResult]);

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
    () => ({ fieldExportDetails, sobjectExportDetails, tabLabelBySettingName }),
    [fieldExportDetails, sobjectExportDetails, tabLabelBySettingName],
  );

  const resultTabs = useMemo(() => {
    if (!selectedOrg || !parsedExport) {
      return null;
    }

    const { export: exportBundle, truncated, findings: allFindings } = parsedExport;
    const counts = parsedExport.counts;

    const containerLabelById = buildPermissionSetIdLabelMap(exportBundle.permissionSets);

    const gridProps = {
      org: selectedOrg,
      serverUrl,
      skipFrontdoorLogin,
      defaultApiVersion,
      sobjectExportDetails,
    };

    const requestScope = parsePermissionExportRequestScope(reshapedJobResult);
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
          <PermissionAnalysisPermissionSetsTree
            permissionSetRows={profilePermissionSetRows}
            permissionSetAssignments={exportBundle.permissionSetAssignments}
            findings={globallyFilteredFindings}
            containerLabelById={containerLabelById}
            treePresentation="profiles"
            {...gridProps}
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
      ...(SHOW_RAW_JOB_JSON_UI
        ? [
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
              content: <RawJsonTabContent result={reshapedJobResult} />,
            },
          ]
        : []),
    ];
  }, [
    selectedOrg,
    parsedExport,
    serverUrl,
    skipFrontdoorLogin,
    defaultApiVersion,
    reshapedJobResult,
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
          analysisJobType="permission_export"
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
        {jobId && !fetchError && jobStatusNormalized === 'failed' && terminalErrorMessage != null && (
          <div className="slds-p-around_medium">
            <Toast type="error">{terminalErrorMessage}</Toast>
          </div>
        )}
        {jobId && !fetchError && !isTerminal && (
          <div className="slds-p-around_medium">
            <h2 className="slds-text-heading_small slds-m-bottom_x-small">Permission analysis in progress…</h2>
            <p className="slds-text-body_small slds-text-color_weak slds-m-bottom_x-small">
              {isJobRunning && liveProgress?.label ? liveProgress.label : 'Preparing'}
              {isJobRunning && liveProgress && liveProgress.total > 0
                ? ` — step ${formatNumber(liveProgress.current)} of ${formatNumber(liveProgress.total)}`
                : ''}
            </p>
            <ProgressIndicator
              currentValue={isJobRunning && liveProgress && Number.isFinite(liveProgress.percent) ? Math.round(liveProgress.percent) : 0}
              isIndeterminate={!isJobRunning || !liveProgress || !Number.isFinite(liveProgress.percent)}
            />
            <p className="slds-text-body_small slds-text-color_weak slds-m-top_x-small">
              You can leave this page, but keep this tab open — the job will keep running and you&apos;ll find it in the Background Jobs.
            </p>
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
        {jobId && !fetchError && isTerminal && jobStatusNormalized === 'completed' && !parsedExport && reshapedJobResult && (
          <div className="slds-p-around_medium">
            {SHOW_RAW_JOB_JSON_UI ? (
              <Fragment>
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
                          {formatJobResult(reshapedJobResult)}
                        </pre>
                      ),
                    },
                  ]}
                />
              </Fragment>
            ) : (
              <ScopedNotification theme="warning">
                This job result does not include a structured permission export payload. The result cannot be shown in the analysis UI.
              </ScopedNotification>
            )}
          </div>
        )}
      </AutoFullHeightContainer>
    </div>
  );
};

export default PermissionAnalysisView;
