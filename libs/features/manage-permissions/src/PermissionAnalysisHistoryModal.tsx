import { css } from '@emotion/react';
import { logger } from '@jetstream/shared/client-logger';
import { listAnalysisJobs } from '@jetstream/shared/data';
import { formatNumber } from '@jetstream/shared/ui-utils';
import { multiWordObjectFilter } from '@jetstream/shared/utils';
import { SalesforceOrgUi } from '@jetstream/types';
import { Badge, EmptyState, Grid, Icon, List, Modal, Popover, PopoverRef, SearchInput, Spinner } from '@jetstream/ui';
import classNames from 'classnames';
import { formatAnalysisJobStatusForDisplay } from './analysis-job-status-display';
import { permissionScopeBadgeCss } from './permission-analysis-viewer-badge.styles';
import { FunctionComponent, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';

const LIST_LIMIT = 50;

export type PermissionScopeKind = 'profile' | 'permission_set' | 'object';

export type PermissionAnalysisScopeBadge = {
  key: string;
  id: string;
  label: string;
  kind: PermissionScopeKind;
};

export type PermissionAnalysisHistoryRow = {
  key: string;
  id: string;
  status: string;
  jobType: string;
  startedLabel: string;
  profileScopeIds: string[];
  permissionSetScopeIds: string[];
  scopeBadges: PermissionAnalysisScopeBadge[];
  /** Space-delimited labels and ids for text search */
  scopeSearchText: string;
};

export type PermissionScopeFilterOption = {
  id: string;
  label: string;
  kind: PermissionScopeKind;
};

function formatJobStartedAt(value: unknown): string {
  if (value == null) {
    return '—';
  }
  const date = value instanceof Date ? value : new Date(typeof value === 'string' ? value : String(value));
  if (Number.isNaN(date.getTime())) {
    return '—';
  }
  return date.toLocaleString();
}

/** Short reference for list rows; full id stays in `title` for copy/paste and search still matches full `id`. */
function shortJobIdForDisplay(jobId: string): string {
  const normalized = jobId.trim();
  if (normalized.length <= 14) {
    return normalized;
  }
  return `${normalized.slice(0, 8)}…${normalized.slice(-4)}`;
}

function badgeTypeForStatus(status: string): 'success' | 'error' | 'warning' | 'default' {
  const normalized = status.trim().toLowerCase();
  if (normalized === 'completed') {
    return 'success';
  }
  if (normalized === 'failed') {
    return 'error';
  }
  if (normalized === 'running') {
    return 'warning';
  }
  return 'default';
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return null;
}

function stringIdArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter((id): id is string => typeof id === 'string');
}

function permissionSetRowsFromExport(result: Record<string, unknown> | null): Record<string, unknown>[] {
  if (!result) {
    return [];
  }
  const exportBlock = asRecord(result.export);
  const rows = exportBlock?.permissionSets;
  if (!Array.isArray(rows)) {
    return [];
  }
  return rows.filter((row): row is Record<string, unknown> => row && typeof row === 'object' && !Array.isArray(row));
}

function profileNameFromExportRow(row: Record<string, unknown>): string {
  const profile = row.Profile;
  if (profile && typeof profile === 'object' && !Array.isArray(profile)) {
    const nestedName = (profile as Record<string, unknown>).Name;
    if (nestedName != null && String(nestedName).trim()) {
      return String(nestedName).trim();
    }
  }
  return '';
}

/**
 * Matches selection UI: profile-owned permission sets use Profile.Name; others use Label/Name.
 */
function labelForPermissionSetRow(row: Record<string, unknown>, fallbackId: string): string {
  const ownedByProfile = row.IsOwnedByProfile === true;
  const profileName = profileNameFromExportRow(row);
  if (ownedByProfile && profileName) {
    return profileName;
  }
  const label = row.Label != null ? String(row.Label) : '';
  const name = row.Name != null ? String(row.Name) : '';
  const text = profileName || label.trim() || name.trim() || fallbackId;
  return text;
}

/** `profileIds` in the job payload are profile permission set parent Ids — prefer Profile.Name whenever the export includes it. */
function labelForProfileScopeBadge(row: Record<string, unknown>, fallbackId: string): string {
  const profileName = profileNameFromExportRow(row);
  if (profileName) {
    return profileName;
  }
  return labelForPermissionSetRow(row, fallbackId);
}

/**
 * Builds ordered scope badges: profiles (payload order) then permission sets (payload order).
 * Uses exported PermissionSet rows for labels when present.
 */
function buildScopeBadges(
  profileScopeIds: string[],
  permissionSetScopeIds: string[],
  exportRows: Record<string, unknown>[],
): PermissionAnalysisScopeBadge[] {
  const byId = new Map<string, Record<string, unknown>>();
  for (const row of exportRows) {
    const id = row.Id != null ? String(row.Id) : '';
    if (id) {
      byId.set(id, row);
    }
  }

  const badges: PermissionAnalysisScopeBadge[] = [];

  for (const id of profileScopeIds) {
    const row = byId.get(id);
    const label = row ? labelForProfileScopeBadge(row, id) : id;
    badges.push({
      key: `profile:${id}`,
      id,
      label,
      kind: 'profile',
    });
  }

  for (const id of permissionSetScopeIds) {
    const row = byId.get(id);
    const label = row ? labelForPermissionSetRow(row, id) : id;
    badges.push({
      key: `permset:${id}`,
      id,
      label,
      kind: 'permission_set',
    });
  }

  return badges;
}

function parseFieldUsageJobScopes(job: Record<string, unknown>): {
  profileScopeIds: string[];
  permissionSetScopeIds: string[];
  scopeBadges: PermissionAnalysisScopeBadge[];
  scopeSearchText: string;
} {
  const result = asRecord(job.result);
  const payload = result ? asRecord(result.requestPayload) : null;
  const rawNames = payload?.objectApiNames;
  const objectApiNames = Array.isArray(rawNames)
    ? rawNames.filter((name): name is string => typeof name === 'string' && name.trim().length > 0)
    : [];
  const scopeBadges: PermissionAnalysisScopeBadge[] = objectApiNames.map((name) => ({
    key: `object:${name}`,
    id: name,
    label: name,
    kind: 'object',
  }));
  const scopeSearchText = objectApiNames.join(' ');
  return { profileScopeIds: [], permissionSetScopeIds: [], scopeBadges, scopeSearchText };
}

function parseJobScopes(job: Record<string, unknown>): {
  profileScopeIds: string[];
  permissionSetScopeIds: string[];
  scopeBadges: PermissionAnalysisScopeBadge[];
  scopeSearchText: string;
} {
  const result = asRecord(job.result);
  const payload = result ? asRecord(result.requestPayload) : null;
  const profileScopeIds = payload ? stringIdArray(payload.profileIds) : [];
  const permissionSetScopeIds = payload ? stringIdArray(payload.permissionSetIds) : [];
  const exportRows = permissionSetRowsFromExport(result);
  const scopeBadges = buildScopeBadges(profileScopeIds, permissionSetScopeIds, exportRows);
  const scopeSearchText = [...scopeBadges.map((badge) => badge.label), ...profileScopeIds, ...permissionSetScopeIds].join(' ');

  return { profileScopeIds, permissionSetScopeIds, scopeBadges, scopeSearchText };
}

function mapApiJobsToRows(
  jobs: Record<string, unknown>[],
  analysisJobType: 'permission_export' | 'field_usage',
): PermissionAnalysisHistoryRow[] {
  return jobs
    .filter((job) => job.jobType === analysisJobType)
    .map((job) => {
      const id = typeof job.id === 'string' ? job.id : String(job.id ?? '');
      const status = job.status != null ? String(job.status) : '';
      const jobType = job.jobType != null ? String(job.jobType) : '';
      const { profileScopeIds, permissionSetScopeIds, scopeBadges, scopeSearchText } =
        analysisJobType === 'field_usage' ? parseFieldUsageJobScopes(job) : parseJobScopes(job);
      return {
        key: id,
        id,
        status,
        jobType,
        startedLabel: formatJobStartedAt(job.createdAt),
        profileScopeIds,
        permissionSetScopeIds,
        scopeBadges,
        scopeSearchText,
      };
    });
}

function sortScopeFilterOptions(options: PermissionScopeFilterOption[]): PermissionScopeFilterOption[] {
  return [...options].sort((a, b) => {
    if (a.kind !== b.kind) {
      return a.kind === 'profile' ? -1 : 1;
    }
    return a.label.localeCompare(b.label, undefined, { sensitivity: 'base' });
  });
}

function uniqueScopeOptionsFromRows(rows: PermissionAnalysisHistoryRow[]): PermissionScopeFilterOption[] {
  const byId = new Map<string, PermissionScopeFilterOption>();
  for (const row of rows) {
    for (const badge of row.scopeBadges) {
      if (!byId.has(badge.id)) {
        byId.set(badge.id, { id: badge.id, label: badge.label, kind: badge.kind });
      }
    }
  }
  return sortScopeFilterOptions(Array.from(byId.values()));
}

export interface PermissionAnalysisHistoryModalProps {
  selectedOrg: SalesforceOrgUi;
  /** Which analysis job family this modal lists (filters `listAnalysisJobs` rows client-side). */
  analysisJobType: 'permission_export' | 'field_usage';
  currentJobId: string | null;
  onClose: () => void;
  onSelectJob: (jobId: string) => void;
}

const scopeBadgeWrapCss = css`
  display: flex;
  flex-wrap: wrap;
  gap: 0.25rem;
  margin-top: 0.25rem;
  max-width: 100%;
`;

/** ~two lines of SLDS badges + flex gap; paired with overflow hidden when collapsed */
const scopeBadgeTwoRowClampCss = css`
  max-height: 4.5rem;
  overflow: hidden;
`;

type ScopeBadgesCollapsibleProps = {
  badges: PermissionAnalysisScopeBadge[];
};

/**
 * Renders scope badges collapsed to ~two rows by default; offers expand/collapse when content overflows.
 * Parent should pass `key={jobRowKey}` so expand state resets per run.
 */
const ScopeBadgesCollapsible: FunctionComponent<ScopeBadgesCollapsibleProps> = ({ badges }) => {
  const [expanded, setExpanded] = useState(false);
  const [canExpand, setCanExpand] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const el = wrapRef.current;
    if (!el) {
      return;
    }

    function measureCollapsedOverflow(): void {
      const node = wrapRef.current;
      if (!node || expanded) {
        return;
      }
      setCanExpand(node.scrollHeight > node.clientHeight + 1);
    }

    measureCollapsedOverflow();
    const observer = new ResizeObserver(() => {
      measureCollapsedOverflow();
    });
    observer.observe(el);
    return () => {
      observer.disconnect();
    };
  }, [badges, expanded]);

  const showToggle = canExpand || expanded;

  return (
    <div className="slds-m-top_xx-small">
      <div ref={wrapRef} css={[scopeBadgeWrapCss, !expanded && scopeBadgeTwoRowClampCss]}>
        {badges.map((badge) => (
          <Badge
            key={badge.key}
            type="default"
            title={`${badge.kind === 'profile' ? 'Profile' : badge.kind === 'permission_set' ? 'Permission set' : 'Object'} · ${badge.id}`}
            css={permissionScopeBadgeCss(badge.kind === 'object' ? 'object' : badge.kind)}
          >
            {badge.label}
          </Badge>
        ))}
      </div>
      {showToggle && (
        <button
          type="button"
          className="slds-button slds-button_reset slds-text-body_small slds-m-top_xx-small"
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            setExpanded((previous) => !previous);
          }}
        >
          {expanded ? 'Show less' : `Show all (${formatNumber(badges.length)})`}
        </button>
      )}
    </div>
  );
};

export const PermissionAnalysisHistoryModal: FunctionComponent<PermissionAnalysisHistoryModalProps> = ({
  selectedOrg,
  analysisJobType,
  currentJobId,
  onClose,
  onSelectJob,
}) => {
  const [rows, setRows] = useState<PermissionAnalysisHistoryRow[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [filterValue, setFilterValue] = useState('');
  const [scopeFilterParentId, setScopeFilterParentId] = useState<string | null>(null);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const scopePopoverRef = useRef<PopoverRef>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setLoadError(null);
      try {
        const { jobs } = await listAnalysisJobs(selectedOrg, { limit: LIST_LIMIT });
        if (cancelled) {
          return;
        }
        const nextRows = mapApiJobsToRows(Array.isArray(jobs) ? jobs : [], analysisJobType);
        setRows(nextRows);
        if (currentJobId && nextRows.some((row) => row.key === currentJobId)) {
          setSelectedKey(currentJobId);
        } else if (nextRows[0]) {
          setSelectedKey(nextRows[0].key);
        } else {
          setSelectedKey(null);
        }
      } catch (ex) {
        if (!cancelled) {
          setLoadError(ex instanceof Error ? ex.message : 'Failed to load job history');
          logger.error('Failed to list analysis jobs', ex);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [selectedOrg, currentJobId, analysisJobType]);

  const scopeFilterOptions = useMemo(() => uniqueScopeOptionsFromRows(rows), [rows]);

  const activeScopeFilterLabel = useMemo(() => {
    if (!scopeFilterParentId) {
      return null;
    }
    const match = scopeFilterOptions.find((option) => option.id === scopeFilterParentId);
    return match?.label ?? scopeFilterParentId;
  }, [scopeFilterOptions, scopeFilterParentId]);

  const filteredRows = useMemo(() => {
    let next = rows;
    if (analysisJobType === 'permission_export' && scopeFilterParentId) {
      next = next.filter(
        (row) => row.profileScopeIds.includes(scopeFilterParentId) || row.permissionSetScopeIds.includes(scopeFilterParentId),
      );
    }
    if (!filterValue.trim()) {
      return next;
    }
    return next.filter(multiWordObjectFilter(['id', 'status', 'startedLabel', 'scopeSearchText'], filterValue));
  }, [rows, filterValue, scopeFilterParentId, analysisJobType]);

  const handleListSelect = useCallback(
    (key: string) => {
      setSelectedKey(key);
      onSelectJob(key);
      onClose();
    },
    [onClose, onSelectJob],
  );

  const handleClearScopeFilter = useCallback(() => {
    setScopeFilterParentId(null);
    scopePopoverRef.current?.close();
  }, []);

  const handlePickScopeFilter = useCallback((parentId: string) => {
    setScopeFilterParentId(parentId);
    scopePopoverRef.current?.close();
  }, []);

  /**
   * Single padded surface inside `slds-popover__body` (body padding removed) so header/body
   * spacing is predictable and all rows share the same width.
   */
  const scopePopoverSurfaceCss = css`
    display: flex;
    flex-direction: column;
    align-items: stretch;
    gap: 0.25rem;
    width: 100%;
    max-width: 100%;
    min-width: 0;
    box-sizing: border-box;
    padding: 0.375rem 0.625rem 0.625rem;
    max-height: min(50vh, 280px);
    overflow-x: hidden;
    overflow-y: auto;

    /* SLDS adds margin-left between adjacent .slds-button; stack spacing comes from gap above. */
    .slds-button + .slds-button {
      margin-left: 0;
      margin-inline-start: 0;
    }
  `;

  const scopePopoverHeaderCss = css`
    margin: 0;
    padding: 0.5rem 0.625rem 0.375rem;
    box-sizing: border-box;
  `;

  /**
   * SLDS `slds-button_stretch` uses `justify-content: center`; neutral/brand borders differ by 1px.
   * Stretch inner grid, equal insets, explicit 1px border so rows align with "All Runs".
   */
  const scopeFilterPopoverButtonCss = css`
    &&.slds-button_stretch {
      justify-content: flex-start;
    }

    display: flex;
    align-items: center;
    align-self: stretch;
    width: 100%;
    max-width: 100%;
    min-width: 0;
    box-sizing: border-box;
    margin: 0;
    text-align: left;
    border-width: 1px;
    border-style: solid;
    --slds-c-button-spacing-inline-start: 0.625rem;
    --slds-c-button-spacing-inline-end: 0.625rem;
    --slds-c-button-neutral-spacing-inline-start: 0.625rem;
    --slds-c-button-neutral-spacing-inline-end: 0.625rem;

    > .slds-grid {
      flex: 1 1 auto;
      width: 100%;
      min-width: 0;
    }
  `;

  const scopePopoverOptionRowCss = css`
    width: 100%;
    max-width: 100%;
    min-width: 0;
    box-sizing: border-box;
    column-gap: 0.5rem;
  `;

  const scopePopoverLabelCellCss = css`
    min-width: 0;
  `;

  const scopePopoverContent = (
    <div css={scopePopoverSurfaceCss}>
      <button
        type="button"
        className={classNames('slds-button slds-button_stretch', {
          'slds-button_brand': scopeFilterParentId === null,
          'slds-button_neutral': scopeFilterParentId !== null,
        })}
        css={scopeFilterPopoverButtonCss}
        onClick={handleClearScopeFilter}
      >
        All Runs
      </button>
      {scopeFilterOptions.length === 0 && (
        <p className="slds-text-body_small slds-text-color_weak">No profiles or permission sets are recorded on these runs.</p>
      )}
      {scopeFilterOptions.map((option) => {
        const isSelected = scopeFilterParentId === option.id;
        return (
          <button
            key={option.id}
            type="button"
            className={classNames('slds-button slds-button_stretch', {
              'slds-button_brand': isSelected,
              'slds-button_neutral': !isSelected,
            })}
            css={scopeFilterPopoverButtonCss}
            onClick={() => handlePickScopeFilter(option.id)}
          >
            <Grid verticalAlign="center" flexiTruncate css={scopePopoverOptionRowCss}>
              <Badge type="default" className="slds-no-flex" css={permissionScopeBadgeCss(option.kind, isSelected ? 'onBrand' : 'default')}>
                {option.kind === 'profile' ? 'Profile' : 'Perm set'}
              </Badge>
              <span className="slds-truncate slds-col slds-grow" css={scopePopoverLabelCellCss} title={option.label}>
                {option.label}
              </span>
            </Grid>
          </button>
        );
      })}
    </div>
  );

  const modalHeader = analysisJobType === 'permission_export' ? 'Permission export history' : 'Field usage history';
  const modalTagline = 'Runs for this org, newest first.';
  const emptyHeadline = analysisJobType === 'permission_export' ? 'No export jobs yet' : 'No field usage jobs yet';
  const emptySubHeading =
    analysisJobType === 'permission_export'
      ? 'Start a run from Permission Analysis selection, then open history again.'
      : 'Start a run from Data Analysis selection, then open history again.';
  const searchPlaceholder =
    analysisJobType === 'permission_export'
      ? 'Filter by job id, status, time, or scope names'
      : 'Filter by job id, status, time, or object API names';
  const scopeEmptyDetail =
    analysisJobType === 'permission_export' ? 'No scope saved for this job.' : 'No objects recorded for this job payload.';

  return (
    <Modal
      header={modalHeader}
      tagline={modalTagline}
      size="md"
      onClose={onClose}
      footer={
        <Grid align="end">
          <button type="button" className="slds-button slds-button_neutral" onClick={onClose}>
            Close
          </button>
        </Grid>
      }
      directionalFooter
    >
      {loading && (
        <div className="slds-align_absolute-center slds-p-vertical_large">
          <Spinner />
        </div>
      )}
      {!loading && loadError && (
        <div className="slds-text-color_error slds-p-around_small" role="alert">
          {loadError}
        </div>
      )}
      {!loading && !loadError && rows.length === 0 && <EmptyState headline={emptyHeadline} subHeading={emptySubHeading} />}
      {!loading && !loadError && rows.length > 0 && (
        <div>
          <Grid verticalAlign="end" className="slds-p-bottom_x-small">
            <div className={analysisJobType === 'permission_export' ? 'slds-col slds-grow' : 'slds-col slds-size_1-of-1'}>
              <SearchInput
                id={analysisJobType === 'permission_export' ? 'permission-analysis-history-filter' : 'field-usage-history-filter'}
                placeholder={searchPlaceholder}
                value={filterValue}
                onChange={setFilterValue}
              />
            </div>
            {analysisJobType === 'permission_export' && (
              <div className="slds-col slds-no-flex slds-m-left_xx-small">
                <Popover
                  ref={scopePopoverRef}
                  placement="bottom-end"
                  size="medium"
                  panelStyle={{
                    maxWidth: 'min(18rem, calc(100vw - 2.5rem))',
                    width: 'min(18rem, calc(100vw - 2.5rem))',
                    boxSizing: 'border-box',
                    overflow: 'hidden',
                  }}
                  header={
                    <header className="slds-popover__header" css={scopePopoverHeaderCss}>
                      <h2 className="slds-text-heading_small slds-hyphenate" title="Filter by Scope">
                        Filter by Scope
                      </h2>
                    </header>
                  }
                  bodyClassName="slds-popover__body slds-p-around_none"
                  bodyStyle={css`
                    box-sizing: border-box;
                    max-width: 100%;
                    margin: 0;
                    padding: 0;
                    overflow-x: hidden;
                  `}
                  content={scopePopoverContent}
                  tooltipProps={{ content: 'Filter runs by profile or permission set included in the export' }}
                  buttonProps={{
                    className: 'slds-button slds-button_icon slds-button_icon-border-filled',
                    'aria-label': 'Filter by Scope',
                  }}
                >
                  <Icon type="utility" icon="filterList" className="slds-button__icon" omitContainer description="Open scope filter" />
                </Popover>
              </div>
            )}
          </Grid>
          {analysisJobType === 'permission_export' && scopeFilterParentId && activeScopeFilterLabel && (
            <div
              className="slds-m-bottom_x-small slds-text-body_small"
              css={css`
                display: flex;
                flex-wrap: wrap;
                align-items: baseline;
                column-gap: 0.35rem;
                row-gap: 0.125rem;
              `}
            >
              <span>
                <span className="slds-text-color_weak">Showing runs that include </span>
                <strong title={scopeFilterParentId}>{activeScopeFilterLabel}</strong>
              </span>
              <button
                type="button"
                className="slds-button slds-button_reset slds-text-link_reset slds-text-link"
                onClick={handleClearScopeFilter}
              >
                Clear
              </button>
            </div>
          )}
          <div className="slds-text-body_small slds-text-color_weak slds-p-left_xx-small slds-m-bottom_xx-small">
            Showing {formatNumber(filteredRows.length)} of {formatNumber(rows.length)} runs
          </div>
          <div
            className="slds-scrollable_y"
            css={css`
              max-height: min(55vh, 420px);
            `}
          >
            <List
              items={filteredRows}
              isActive={(item: PermissionAnalysisHistoryRow) => item.key === selectedKey}
              onSelected={handleListSelect}
              getContent={(item: PermissionAnalysisHistoryRow) => ({
                key: item.key,
                heading: (
                  <Grid verticalAlign="center" align="spread">
                    <span className="slds-truncate" title={`Started ${item.startedLabel} — job ${item.id}`}>
                      {item.startedLabel}
                    </span>
                    <Badge type={badgeTypeForStatus(item.status)}>{formatAnalysisJobStatusForDisplay(item.status)}</Badge>
                  </Grid>
                ),
                subheading: `Job ${shortJobIdForDisplay(item.id)}`,
                trailingHeader:
                  item.key === currentJobId ? (
                    <Icon type="utility" icon="check" className="slds-icon-text-success" omitContainer title="Current run" />
                  ) : undefined,
                children:
                  item.scopeBadges.length > 0 ? (
                    <ScopeBadgesCollapsible key={item.key} badges={item.scopeBadges} />
                  ) : (
                    <p className="slds-text-body_small slds-text-color_weak slds-m-top_xx-small">{scopeEmptyDetail}</p>
                  ),
              })}
            />
          </div>
          <p className="slds-text-body_small slds-text-color_weak slds-m-top_small">Select a row to open that run in this view.</p>
        </div>
      )}
    </Modal>
  );
};

export default PermissionAnalysisHistoryModal;
