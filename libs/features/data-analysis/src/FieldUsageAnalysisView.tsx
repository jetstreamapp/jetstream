import { css } from '@emotion/react';
import { formatAnalysisJobStatusForDisplay, PermissionAnalysisHistoryModal } from '@jetstream/feature/manage-permissions';
import { logger } from '@jetstream/shared/client-logger';
import { getAnalysisJob } from '@jetstream/shared/data';
import { formatNumber } from '@jetstream/shared/ui-utils';
import { getErrorMessage } from '@jetstream/shared/utils';
import {
  AutoFullHeightContainer,
  Badge,
  ColumnWithFilter,
  DataTable,
  Icon,
  Modal,
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
import { selectedOrgState } from '@jetstream/ui/app-state';
import { useAtomValue } from 'jotai';
import { Fragment, FunctionComponent, useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { parseFieldUsageJobResult, type FieldUsageJobResultParsed, type WhereUsedDependencyRowParsed } from './field-usage-result-parse';

const HEIGHT_BUFFER = 170;

/** Custom fields at or below this fill rate appear on the **Low usage** tab. */
const LOW_USAGE_PCT_THRESHOLD = 5;

interface ObjectSummaryRow {
  _key: string;
  apiName: string;
  label: string;
  totalRecords: number;
  queryTruncated: boolean;
  customizable: boolean;
  error?: string;
}

interface FieldDetailRow {
  _key: string;
  fieldApiName: string;
  fieldLabel: string;
  type: string;
  custom: boolean;
  filled: number;
  pct: number;
  latestModified: string | null;
}

interface LowUsageRow {
  _key: string;
  objectApiName: string;
  fieldApiName: string;
  fieldLabel: string;
  type: string;
  filled: number;
  pct: number;
}

interface WhereUsedTableRow {
  _key: string;
  componentType: string;
  componentName: string;
  kindLabel: string;
}

function formatJobResultJson(result: unknown): string {
  try {
    return JSON.stringify(result, null, 2);
  } catch {
    return String(result);
  }
}

function badgeTypeForJobStatus(status: string): 'success' | 'error' | 'warning' | 'default' {
  const normalized = status.trim().toLowerCase();
  if (normalized === 'completed') {
    return 'success';
  }
  if (normalized === 'failed') {
    return 'error';
  }
  if (normalized === 'running' || normalized === 'pending') {
    return 'warning';
  }
  return 'default';
}

/**
 * Field usage results workspace: polls the analysis job created from {@link DataAnalysisSelection}.
 */
export const FieldUsageAnalysisView: FunctionComponent = () => {
  const selectedOrg = useAtomValue(selectedOrgState);
  const [searchParams, setSearchParams] = useSearchParams();
  const jobId = searchParams.get('job');

  const [jobRecord, setJobRecord] = useState<Record<string, unknown> | null>(null);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [selectedObjectApiName, setSelectedObjectApiName] = useState<string | null>(null);
  const [whereUsedForKey, setWhereUsedForKey] = useState<string | null>(null);

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
          logger.error('Failed to load field usage analysis job', ex);
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
      clearPolling();
      if (typeof document !== 'undefined') {
        document.removeEventListener('visibilitychange', onVisibilityChange);
      }
    };
  }, [selectedOrg, jobId]);

  const jobStatusNormalized = jobRecord?.status != null ? String(jobRecord.status).trim().toLowerCase() : '';
  const isTerminal = jobStatusNormalized === 'completed' || jobStatusNormalized === 'failed';

  const parsedResult: FieldUsageJobResultParsed | null =
    jobStatusNormalized === 'completed' && jobRecord?.result != null ? parseFieldUsageJobResult(jobRecord.result) : null;

  const objectSummaryRows: ObjectSummaryRow[] = useMemo(() => {
    if (!parsedResult) {
      return [];
    }
    return Object.keys(parsedResult.objects)
      .sort((a, b) => a.localeCompare(b))
      .map((apiName) => {
        const payload = parsedResult.objects[apiName];
        return {
          _key: apiName,
          apiName,
          label: payload.label,
          totalRecords: payload.totalRecords,
          queryTruncated: payload.queryTruncated,
          customizable: payload.customizable,
          ...(payload.error ? { error: payload.error } : {}),
        };
      });
  }, [parsedResult]);

  const fieldRowsForSelection: FieldDetailRow[] = useMemo(() => {
    if (!parsedResult || !selectedObjectApiName) {
      return [];
    }
    const payload = parsedResult.objects[selectedObjectApiName];
    if (!payload || payload.error) {
      return [];
    }
    return Object.keys(payload.fieldUsage)
      .sort((a, b) => a.localeCompare(b))
      .map((fieldApiName) => {
        const stat = payload.fieldUsage[fieldApiName];
        const meta = payload.fieldMeta[fieldApiName];
        return {
          _key: `${selectedObjectApiName}.${fieldApiName}`,
          fieldApiName,
          fieldLabel: meta?.label ?? fieldApiName,
          type: meta?.type ?? '',
          custom: meta?.custom ?? false,
          filled: stat.filled,
          pct: stat.pct,
          latestModified: stat.latestFilledRowModified,
        };
      });
  }, [parsedResult, selectedObjectApiName]);

  const lowUsageRows: LowUsageRow[] = useMemo(() => {
    if (!parsedResult) {
      return [];
    }
    const rows: LowUsageRow[] = [];
    for (const objectApiName of Object.keys(parsedResult.objects).sort()) {
      const payload = parsedResult.objects[objectApiName];
      if (!payload || payload.error) {
        continue;
      }
      for (const fieldApiName of Object.keys(payload.fieldUsage)) {
        const stat = payload.fieldUsage[fieldApiName];
        const meta = payload.fieldMeta[fieldApiName];
        if (!meta?.custom) {
          continue;
        }
        if (stat.pct > LOW_USAGE_PCT_THRESHOLD) {
          continue;
        }
        rows.push({
          _key: `${objectApiName}.${fieldApiName}`,
          objectApiName,
          fieldApiName,
          fieldLabel: meta.label ?? fieldApiName,
          type: meta.type ?? '',
          filled: stat.filled,
          pct: stat.pct,
        });
      }
    }
    rows.sort((a, b) => a.pct - b.pct || a.objectApiName.localeCompare(b.objectApiName));
    return rows;
  }, [parsedResult]);

  const whereUsedRows: WhereUsedTableRow[] = useMemo(() => {
    if (!parsedResult || !whereUsedForKey) {
      return [];
    }
    const deps: WhereUsedDependencyRowParsed[] = parsedResult.whereUsed[whereUsedForKey] ?? [];
    return deps.map((row, index) => ({
      _key: `${row.type}:${row.name}:${String(index)}`,
      componentType: row.type,
      componentName: row.name,
      kindLabel: row.kind === 'automation' ? 'Automation' : 'Other',
    }));
  }, [parsedResult, whereUsedForKey]);

  const objectColumns: ColumnWithFilter<ObjectSummaryRow>[] = useMemo(
    () => [
      {
        name: 'Object API',
        key: 'apiName',
        type: 'text',
        width: 200,
      },
      {
        name: 'Label',
        key: 'label',
        type: 'text',
        width: 200,
      },
      {
        name: 'Records scanned',
        key: 'totalRecords',
        type: 'number',
        width: 140,
        renderCell: (p) => <span>{formatNumber(p.row.totalRecords)}</span>,
      },
      {
        name: 'Truncated',
        key: 'queryTruncated',
        type: 'text',
        width: 100,
        renderCell: (p) => <span>{p.row.queryTruncated ? 'Yes' : 'No'}</span>,
      },
      {
        name: 'Customizable',
        key: 'customizable',
        type: 'text',
        width: 120,
        renderCell: (p) => <span>{p.row.customizable ? 'Yes' : 'No'}</span>,
      },
      {
        name: 'Error',
        key: 'error',
        type: 'text',
        width: 220,
        renderCell: (p) => (
          <span className="slds-truncate" title={p.row.error}>
            {p.row.error ?? ''}
          </span>
        ),
      },
      {
        name: '',
        key: 'openFields',
        type: 'text',
        width: 130,
        sortable: false,
        renderCell: (p) => (
          <button
            type="button"
            className="slds-button slds-button_neutral slds-button_stretch"
            onClick={() => setSelectedObjectApiName(p.row.apiName)}
          >
            Fields
          </button>
        ),
      },
    ],
    [],
  );

  const fieldColumns: ColumnWithFilter<FieldDetailRow>[] = useMemo(
    () => [
      { name: 'Field API', key: 'fieldApiName', type: 'text', width: 200 },
      { name: 'Label', key: 'fieldLabel', type: 'text', width: 180 },
      { name: 'Type', key: 'type', type: 'text', width: 120 },
      {
        name: 'Custom',
        key: 'custom',
        type: 'text',
        width: 90,
        renderCell: (p) => <span>{p.row.custom ? 'Yes' : 'No'}</span>,
      },
      {
        name: 'Filled',
        key: 'filled',
        type: 'number',
        width: 100,
        renderCell: (p) => <span>{formatNumber(p.row.filled)}</span>,
      },
      {
        name: '% Filled',
        key: 'pct',
        type: 'number',
        width: 100,
        renderCell: (p) => <span>{p.row.pct.toFixed(1)}%</span>,
      },
      {
        name: 'Latest value row mod',
        key: 'latestModified',
        type: 'text',
        width: 200,
        renderCell: (p) => <span>{p.row.latestModified ?? '—'}</span>,
      },
      {
        name: '',
        key: 'whereUsed',
        type: 'text',
        width: 110,
        sortable: false,
        renderCell: (p) =>
          p.row.fieldApiName.endsWith('__c') ? (
            <button
              type="button"
              className="slds-button slds-button_neutral slds-button_stretch"
              onClick={() => setWhereUsedForKey(`${selectedObjectApiName}.${p.row.fieldApiName}`)}
            >
              Where used
            </button>
          ) : (
            <span className="slds-text-color_weak">—</span>
          ),
      },
    ],
    [selectedObjectApiName],
  );

  const lowUsageColumns: ColumnWithFilter<LowUsageRow>[] = useMemo(
    () => [
      { name: 'Object', key: 'objectApiName', type: 'text', width: 180 },
      { name: 'Field', key: 'fieldApiName', type: 'text', width: 200 },
      { name: 'Label', key: 'fieldLabel', type: 'text', width: 180 },
      { name: 'Type', key: 'type', type: 'text', width: 120 },
      {
        name: 'Filled',
        key: 'filled',
        type: 'number',
        width: 100,
        renderCell: (p) => <span>{formatNumber(p.row.filled)}</span>,
      },
      {
        name: '% Filled',
        key: 'pct',
        type: 'number',
        width: 100,
        renderCell: (p) => <span>{p.row.pct.toFixed(1)}%</span>,
      },
      {
        name: '',
        key: 'wu',
        type: 'text',
        width: 110,
        sortable: false,
        renderCell: (p) => (
          <button
            type="button"
            className="slds-button slds-button_neutral slds-button_stretch"
            onClick={() => setWhereUsedForKey(`${p.row.objectApiName}.${p.row.fieldApiName}`)}
          >
            Where used
          </button>
        ),
      },
    ],
    [],
  );

  const whereUsedColumns: ColumnWithFilter<WhereUsedTableRow>[] = useMemo(
    () => [
      { name: 'Metadata type', key: 'componentType', type: 'text', width: 200 },
      { name: 'Name', key: 'componentName', type: 'text', width: 280 },
      { name: 'Kind', key: 'kindLabel', type: 'text', width: 120 },
    ],
    [],
  );

  const resultTabs = useMemo(() => {
    if (!parsedResult) {
      return null;
    }
    return [
      {
        id: 'objects',
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
            Objects & fields
          </Fragment>
        ),
        titleText: 'Objects and fields',
        content: (
          <div className="slds-p-around_small">
            {parsedResult.truncated && (
              <div className="slds-m-bottom_small">
                <ScopedNotification theme="warning">
                  At least one object hit the row scan cap; percentages reflect scanned rows only.
                </ScopedNotification>
              </div>
            )}
            <h3 className="slds-text-heading_small slds-m-bottom_x-small">Objects</h3>
            <div
              css={css`
                min-height: 200px;
              `}
            >
              <DataTable columns={objectColumns} data={objectSummaryRows} getRowKey={(row) => row._key} includeQuickFilter rowHeight={32} />
            </div>
            {selectedObjectApiName && (
              <div className="slds-m-top_medium">
                <div className="slds-grid slds-grid_align-spread slds-m-bottom_x-small">
                  <h3 className="slds-text-heading_small">Fields — {selectedObjectApiName}</h3>
                  <button
                    type="button"
                    className="slds-button slds-button_reset slds-text-link"
                    onClick={() => setSelectedObjectApiName(null)}
                  >
                    Clear selection
                  </button>
                </div>
                <div
                  css={css`
                    min-height: 200px;
                  `}
                >
                  <DataTable
                    columns={fieldColumns}
                    data={fieldRowsForSelection}
                    getRowKey={(row) => row._key}
                    includeQuickFilter
                    initialSortColumns={[{ columnKey: 'pct', direction: 'ASC' }]}
                    rowHeight={32}
                  />
                </div>
              </div>
            )}
          </div>
        ),
      },
      {
        id: 'low-usage',
        title: (
          <Fragment>
            <span className="slds-tabs__left-icon">
              <Icon
                type="standard"
                icon="metrics"
                containerClassname="slds-icon_container slds-icon-standard-metrics"
                className="slds-icon slds-icon_small"
              />
            </span>
            Low usage (≤{LOW_USAGE_PCT_THRESHOLD}%)
          </Fragment>
        ),
        titleText: 'Low usage custom fields',
        content: (
          <div className="slds-p-around_small">
            <p className="slds-text-body_small slds-text-color_weak slds-m-bottom_small">
              Custom fields (`__c`) at or below {LOW_USAGE_PCT_THRESHOLD}% population across scanned rows.
            </p>
            <div
              css={css`
                min-height: 240px;
              `}
            >
              <DataTable
                columns={lowUsageColumns}
                data={lowUsageRows}
                getRowKey={(row) => row._key}
                includeQuickFilter
                initialSortColumns={[{ columnKey: 'pct', direction: 'ASC' }]}
                rowHeight={32}
              />
            </div>
          </div>
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
              {formatJobResultJson(jobRecord?.result)}
            </pre>
          </div>
        ),
      },
    ];
  }, [
    parsedResult,
    objectSummaryRows,
    objectColumns,
    fieldColumns,
    fieldRowsForSelection,
    selectedObjectApiName,
    lowUsageRows,
    lowUsageColumns,
    jobRecord?.result,
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
            `}
          />
          <div
            css={css`
              flex: 0 0 auto;
            `}
          >
            <ToolbarItemActions>
              <Tooltip ariaRole="label" content="View past field usage runs for this org">
                <button
                  type="button"
                  aria-label="Field usage history"
                  className="slds-button slds-button_neutral collapsible-button collapsible-button-xs"
                  css={css`
                    padding: 0.5rem;
                  `}
                  disabled={!selectedOrg?.uniqueId}
                  onClick={() => setIsHistoryOpen(true)}
                >
                  <Icon type="utility" icon="date_time" className="slds-button__icon" omitContainer title="Field usage history" />
                </button>
              </Tooltip>
            </ToolbarItemActions>
          </div>
        </div>
      </Toolbar>
      {isHistoryOpen && selectedOrg && (
        <PermissionAnalysisHistoryModal
          selectedOrg={selectedOrg}
          analysisJobType="field_usage"
          currentJobId={jobId}
          onClose={() => setIsHistoryOpen(false)}
          onSelectJob={(nextJobId) => {
            setSearchParams({ job: nextJobId }, { replace: true });
          }}
        />
      )}
      {whereUsedForKey && (
        <Modal
          header={`Where used — ${whereUsedForKey}`}
          tagline="Tooling MetadataComponentDependency references (custom fields)."
          size="lg"
          onClose={() => setWhereUsedForKey(null)}
          footer={
            <button type="button" className="slds-button slds-button_neutral" onClick={() => setWhereUsedForKey(null)}>
              Close
            </button>
          }
        >
          {whereUsedRows.length === 0 ? (
            <p className="slds-text-body_regular slds-text-color_weak slds-p-around_small">
              No dependency rows were returned for this field (or where-used could not be computed for this org).
            </p>
          ) : (
            <div className="slds-p-around_small">
              <DataTable columns={whereUsedColumns} data={whereUsedRows} getRowKey={(row) => row._key} includeQuickFilter rowHeight={30} />
            </div>
          )}
        </Modal>
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
              No analysis job is linked to this page. Start a field usage job from Data Analysis, then you will be redirected here
              automatically.
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
            <div className="slds-grid slds-grid_vertical-align-center slds-gutters_x-small slds-m-bottom_small">
              <Spinner />
              <span className="slds-text-body_regular">
                Job status:{' '}
                <Badge type={badgeTypeForJobStatus(jobStatusNormalized)}>{formatAnalysisJobStatusForDisplay(jobRecord?.status)}</Badge>
              </span>
            </div>
          </div>
        )}
        {jobId && !fetchError && isTerminal && jobStatusNormalized === 'completed' && !parsedResult && (
          <div className="slds-p-around_medium">
            <Toast type="warning">
              This job completed but the result payload is not a recognized field usage envelope (missing `phase: field_usage_v1`).
            </Toast>
          </div>
        )}
        {jobId && !fetchError && isTerminal && jobStatusNormalized === 'completed' && parsedResult && resultTabs && (
          <Fragment>
            <div className="slds-p-horizontal_medium slds-p-top_x-small slds-grid slds-grid_vertical-align-center slds-gutters_x-small">
              <span className="slds-text-body_small slds-text-color_weak">Job</span>
              <Badge type={badgeTypeForJobStatus('completed')}>{formatAnalysisJobStatusForDisplay('completed')}</Badge>
              <span className="slds-text-body_small slds-m-left_small slds-text-color_weak">Summary</span>
              <span className="slds-text-body_small">{parsedResult.summary}</span>
            </div>
            {parsedResult.failedObjects.length > 0 && (
              <div className="slds-p-horizontal_medium slds-p-top_x-small">
                <ScopedNotification theme="error">Objects with errors: {parsedResult.failedObjects.join(', ')}.</ScopedNotification>
              </div>
            )}
            <Tabs key={resultTabs.map((tab) => tab.id).join('|')} initialActiveId="objects" tabs={resultTabs} />
          </Fragment>
        )}
      </AutoFullHeightContainer>
    </div>
  );
};

export default FieldUsageAnalysisView;
