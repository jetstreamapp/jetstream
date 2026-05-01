import { css } from '@emotion/react';
import { logger } from '@jetstream/shared/client-logger';
import { query } from '@jetstream/shared/data';
import { escapeSoqlString } from '@jetstream/shared/ui-utils';
import type { SalesforceOrgUi } from '@jetstream/types';
import {
  AutoFullHeightContainer,
  Badge,
  ColumnWithFilter,
  DataTree,
  dataTableDateFormatter,
  getProfileOrPermSetSetupUrl,
  getSalesforceUserManageSetupUrl,
  Icon,
  SalesforceLogin,
  ScopedNotification,
  setColumnFromType,
  Spinner,
  Tooltip,
} from '@jetstream/ui';
import groupBy from 'lodash/groupBy';
import { Fragment, FunctionComponent, useCallback, useEffect, useLayoutEffect, useMemo, useState } from 'react';
import type { RenderCellProps, RenderGroupCellProps } from 'react-data-grid';
import { PermissionAnalysisFindingsModal } from './PermissionAnalysisFindingsModal';
import {
  buildContainerIdFindingSeverity,
  buildPermissionSetAssignmentsTreeRows,
  buildPermissionSetIdLabelMap,
  isPermissionSetAssignmentsTreePlaceholderLeaf,
  isPermissionSetAssignmentsTreeUserLeaf,
  listFindingsForExportContainer,
  type PermissionAnalysisFinding,
  type PermissionExportRow,
  type PermissionSetAssignmentsTreeRow,
} from './permission-export-result-view';

const TREE_GROUP_BY = ['_treePermissionSetGroupKey'] as const;

const TREE_PERM_SET_MIN_PX = 140;
const TREE_PERM_SET_MAX_PX = 420;
const TREE_COL_PERM_SET = `minmax(${TREE_PERM_SET_MIN_PX}px, min(${TREE_PERM_SET_MAX_PX}px, 1.35fr))`;

const USER_COL_MIN_PX = 200;
const TREE_COL_USER = `minmax(${USER_COL_MIN_PX}px, 1fr)`;

/** Chunk size for `User` Id IN queries (Salesforce SOQL limits). */
const USER_SOQL_CHUNK_SIZE = 200;

const TREE_ROW_HEIGHT_LEAF_PX = 48;
/** Taller group rows so permission set label + created / last modified lines fit. */
const TREE_ROW_HEIGHT_GROUP_PX = 60;

const OBJECT_TYPE_ACTION_BUTTON_CLASSNAME = 'slds-button slds-button_icon slds-button_icon-bare';

interface AssigneeDisplay {
  name: string;
  username: string;
  /** When `false`, an inactive badge is shown next to the name. */
  isActive: boolean;
}

function userRecordIsActive(record: { IsActive?: unknown }): boolean {
  const value = record.IsActive;
  if (value === false || value === 'false') {
    return false;
  }
  return true;
}

function collectUniqueUserAssigneeIds(assignments: PermissionExportRow[]): string[] {
  const ids = new Set<string>();
  for (const row of assignments) {
    const assigneeId = row.AssigneeId;
    if (typeof assigneeId === 'string' && assigneeId.trim().startsWith('005')) {
      ids.add(assigneeId.trim());
    }
  }
  return [...ids].sort((a, b) => a.localeCompare(b));
}

interface PermissionSetTooltipFields {
  label: string;
  name: string;
  description: string | null;
  createdWhen: string | null;
  createdByName: string | null;
  lastModifiedWhen: string | null;
  lastModifiedByName: string | null;
}

function readSalesforceRelationshipName(value: unknown): string | null {
  if (value && typeof value === 'object' && value !== null && 'Name' in value) {
    const name = (value as { Name?: unknown }).Name;
    if (typeof name === 'string' && name.trim()) {
      return name.trim();
    }
  }
  return null;
}

function readIsoDatetimeDisplay(value: unknown): string | null {
  if (typeof value !== 'string' || !value.trim()) {
    return null;
  }
  return dataTableDateFormatter(value.trim());
}

function formatAuditLine(prefix: string, when: string | null, by: string | null): string | null {
  if (!when && !by) {
    return null;
  }
  if (when && by) {
    return `${prefix} ${when} · ${by}`;
  }
  if (when) {
    return `${prefix} ${when}`;
  }
  return `${prefix} · ${by}`;
}

function permissionSetTooltipBlock(fields: Pick<PermissionSetTooltipFields, 'label' | 'name' | 'description'>) {
  return (
    <div
      css={css`
        max-width: 22rem;
        text-align: left;
      `}
    >
      <div className="slds-text-title_caps slds-text-color_inverse-weak">Label</div>
      <div className="slds-text-body_regular slds-text-color_inverse slds-hyphenate slds-m-bottom_x-small">{fields.label}</div>
      <div className="slds-text-title_caps slds-text-color_inverse-weak">Name</div>
      <div className="slds-text-body_regular slds-text-color_inverse slds-hyphenate slds-m-bottom_x-small">
        <code>{fields.name}</code>
      </div>
      <div className="slds-text-title_caps slds-text-color_inverse-weak">Description</div>
      <div className="slds-text-body_regular slds-text-color_inverse slds-hyphenate slds-m-bottom_x-small">{fields.description ?? '—'}</div>
    </div>
  );
}

function buildPermissionSetTooltipFieldsById(rows: PermissionExportRow[]): Map<string, PermissionSetTooltipFields> {
  const map = new Map<string, PermissionSetTooltipFields>();
  for (const row of rows) {
    const id = row.Id;
    if (typeof id !== 'string' || !id.trim()) {
      continue;
    }
    const trimmedId = id.trim();
    const label = typeof row.Label === 'string' && row.Label.trim() ? row.Label.trim() : '';
    const name = typeof row.Name === 'string' && row.Name.trim() ? row.Name.trim() : '';
    const rawDescription = row.Description;
    const description = rawDescription != null && String(rawDescription).trim().length > 0 ? String(rawDescription).trim() : null;
    map.set(trimmedId, {
      label: label || name || trimmedId,
      name: name || '—',
      description,
      createdWhen: readIsoDatetimeDisplay(row.CreatedDate),
      createdByName: readSalesforceRelationshipName(row.CreatedBy),
      lastModifiedWhen: readIsoDatetimeDisplay(row.LastModifiedDate),
      lastModifiedByName: readSalesforceRelationshipName(row.LastModifiedBy),
    });
  }
  return map;
}

type ContainerFindingsModalState = {
  containerId: string;
  columnLabel: string;
  matches: PermissionAnalysisFinding[];
};

function renderPermissionSetGroupCell(
  labelByPermissionSetId: Map<string, string>,
  tooltipByPermissionSetId: Map<string, PermissionSetTooltipFields>,
  containerSeverity: Map<string, 'error' | 'warning'> | null,
  setupLogin: { org: SalesforceOrgUi; serverUrl: string; skipFrontDoorAuth: boolean },
  onOpenFindings: (permissionSetId: string) => void,
  { groupKey, childRows, isExpanded, toggleGroup }: RenderGroupCellProps<PermissionSetAssignmentsTreeRow>,
) {
  const permissionSetId = String(groupKey);
  const titleLabel = labelByPermissionSetId.get(permissionSetId) ?? permissionSetId;
  const tooltipFields = tooltipByPermissionSetId.get(permissionSetId) ?? {
    label: titleLabel,
    name: '—',
    description: null,
    createdWhen: null,
    createdByName: null,
    lastModifiedWhen: null,
    lastModifiedByName: null,
  };
  const createdLine = formatAuditLine('Created', tooltipFields.createdWhen, tooltipFields.createdByName);
  const modifiedLine = formatAuditLine('Last modified', tooltipFields.lastModifiedWhen, tooltipFields.lastModifiedByName);
  const severity = containerSeverity?.get(permissionSetId);
  const returnUrl = getProfileOrPermSetSetupUrl('PermissionSet', permissionSetId);

  return (
    <div
      className={
        severity === 'error'
          ? 'permission-finding-cell--error'
          : severity === 'warning'
            ? 'permission-finding-severity-cell--warning'
            : undefined
      }
      css={css`
        display: flex;
        align-items: flex-start;
        column-gap: 0.25rem;
        width: 100%;
        height: 100%;
        padding: 0.25rem 0.35rem;
      `}
    >
      <button
        type="button"
        className="slds-button slds-button_reset slds-text-align_left"
        css={css`
          flex: 1;
          min-width: 0;
          line-height: 1.35;
          overflow-wrap: anywhere;
          white-space: normal;
          word-break: break-word;
        `}
        onClick={toggleGroup}
        title={titleLabel}
      >
        <span
          css={css`
            column-gap: 0.25rem;
            display: flex;
            align-items: flex-start;
          `}
        >
          <Icon
            type="utility"
            icon={isExpanded ? 'chevrondown' : 'chevronright'}
            className="slds-icon slds-icon-text-default slds-icon_x-small"
            css={css`
              flex-shrink: 0;
              margin-top: 0.125rem;
            `}
            omitContainer
            description={isExpanded ? 'Collapse' : 'Expand'}
          />
          <Tooltip content={permissionSetTooltipBlock(tooltipFields)}>
            <span
              css={css`
                flex: 1;
                min-width: 0;
                text-align: left;
              `}
            >
              <span className="slds-truncate" title={titleLabel}>
                <span>{titleLabel}</span>
                <span className="slds-text-body_small slds-text-color_weak slds-m-left_xx-small">({childRows.length})</span>
              </span>
              {(createdLine || modifiedLine) && (
                <div
                  className="slds-text-body_small slds-text-color_weak"
                  css={css`
                    margin-top: 0.125rem;
                    line-height: 1.25;
                  `}
                >
                  {createdLine && (
                    <div className="slds-truncate" title={createdLine}>
                      {createdLine}
                    </div>
                  )}
                  {modifiedLine && (
                    <div className="slds-truncate" title={modifiedLine}>
                      {modifiedLine}
                    </div>
                  )}
                </div>
              )}
            </span>
          </Tooltip>
        </span>
      </button>
      <div
        className="slds-no-flex"
        css={css`
          display: flex;
          align-items: center;
          column-gap: 0.125rem;
        `}
      >
        <SalesforceLogin
          org={setupLogin.org}
          serverUrl={setupLogin.serverUrl}
          skipFrontDoorAuth={setupLogin.skipFrontDoorAuth}
          returnUrl={returnUrl}
          title="Open this permission set in Salesforce Setup"
          omitIcon
          className={OBJECT_TYPE_ACTION_BUTTON_CLASSNAME}
          onClick={(event) => {
            event.stopPropagation();
          }}
        >
          <Icon type="utility" icon="new_window" className="slds-button__icon" omitContainer />
        </SalesforceLogin>
        {severity && (
          <button
            type="button"
            className="slds-button slds-button_icon slds-button_icon-bare"
            title="View issues for this permission set"
            onClick={(event) => {
              event.stopPropagation();
              onOpenFindings(permissionSetId);
            }}
          >
            <Icon
              type="utility"
              icon={severity === 'error' ? 'error' : 'warning'}
              className={severity === 'error' ? 'slds-button__icon slds-icon-text-error' : 'slds-button__icon slds-icon-text-warning'}
              omitContainer
              description="View issues"
            />
          </button>
        )}
      </div>
    </div>
  );
}

export interface PermissionAnalysisPermissionSetsTreeProps {
  permissionSetRows: PermissionExportRow[];
  permissionSetAssignments: PermissionExportRow[];
  org: SalesforceOrgUi;
  serverUrl: string;
  skipFrontdoorLogin: boolean;
  defaultApiVersion: string;
  findings?: PermissionAnalysisFinding[];
  containerLabelById?: Map<string, string>;
}

/**
 * Permission sets from the export, grouped by permission set with tooltip metadata and expandable user assignment leaves.
 * Groups start expanded.
 */
export const PermissionAnalysisPermissionSetsTree: FunctionComponent<PermissionAnalysisPermissionSetsTreeProps> = ({
  permissionSetRows,
  permissionSetAssignments,
  org,
  serverUrl,
  skipFrontdoorLogin,
  defaultApiVersion,
  findings = [],
  containerLabelById,
}) => {
  const treeRows = useMemo(
    () => buildPermissionSetAssignmentsTreeRows(permissionSetRows, permissionSetAssignments),
    [permissionSetRows, permissionSetAssignments],
  );
  const labelByPermissionSetId = useMemo(() => buildPermissionSetIdLabelMap(permissionSetRows), [permissionSetRows]);
  const tooltipByPermissionSetId = useMemo(() => buildPermissionSetTooltipFieldsById(permissionSetRows), [permissionSetRows]);
  const containerSeverity = useMemo(() => {
    if (findings.length === 0) {
      return null;
    }
    return buildContainerIdFindingSeverity(findings);
  }, [findings]);

  const allExpandedGroupIds = useMemo(() => {
    const ids = new Set<unknown>();
    for (const row of treeRows) {
      ids.add(row._treePermissionSetGroupKey);
    }
    return ids;
  }, [treeRows]);

  const [expandedGroupIds, setExpandedGroupIds] = useState<Set<unknown>>(() => new Set());
  useLayoutEffect(() => {
    setExpandedGroupIds(new Set(allExpandedGroupIds));
  }, [allExpandedGroupIds]);

  const [findingsModal, setFindingsModal] = useState<ContainerFindingsModalState | null>(null);
  const [assigneeDisplayById, setAssigneeDisplayById] = useState<Map<string, AssigneeDisplay>>(() => new Map());
  const [assigneeDisplayLoading, setAssigneeDisplayLoading] = useState(false);

  useEffect(() => {
    if (!org?.uniqueId) {
      setAssigneeDisplayById(new Map());
      setAssigneeDisplayLoading(false);
      return;
    }
    const ids = collectUniqueUserAssigneeIds(permissionSetAssignments);
    if (ids.length === 0) {
      setAssigneeDisplayById(new Map());
      setAssigneeDisplayLoading(false);
      return;
    }

    let cancelled = false;
    setAssigneeDisplayLoading(true);

    void (async () => {
      try {
        const merged = new Map<string, AssigneeDisplay>();
        for (let index = 0; index < ids.length; index += USER_SOQL_CHUNK_SIZE) {
          const chunk = ids.slice(index, index + USER_SOQL_CHUNK_SIZE);
          const inList = chunk.map((id) => `'${escapeSoqlString(id)}'`).join(', ');
          const soql = `SELECT Id, Name, Username, IsActive FROM User WHERE Id IN (${inList})`;
          const response = await query<{ Id: string; Name?: string; Username?: string; IsActive?: boolean }>(org, soql);
          for (const record of response.queryResults.records ?? []) {
            const recordId = typeof record.Id === 'string' ? record.Id.trim() : '';
            if (!recordId) {
              continue;
            }
            merged.set(recordId, {
              name: typeof record.Name === 'string' && record.Name.trim() ? record.Name.trim() : recordId,
              username: typeof record.Username === 'string' && record.Username.trim() ? record.Username.trim() : '',
              isActive: userRecordIsActive(record),
            });
          }
        }
        if (!cancelled) {
          setAssigneeDisplayById(merged);
        }
      } catch (error) {
        logger.warn('Failed to load User rows for permission set tree assignees', error);
        if (!cancelled) {
          setAssigneeDisplayById(new Map());
        }
      } finally {
        if (!cancelled) {
          setAssigneeDisplayLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [org, permissionSetAssignments]);

  const setupLogin = useMemo(() => ({ org, serverUrl, skipFrontDoorAuth: skipFrontdoorLogin }), [org, serverUrl, skipFrontdoorLogin]);

  const openFindingsForPermissionSet = useCallback(
    (permissionSetId: string) => {
      const id = permissionSetId.trim();
      if (!id || !containerSeverity?.has(id)) {
        return;
      }
      const matches = listFindingsForExportContainer(findings, id);
      if (matches.length === 0) {
        return;
      }
      setFindingsModal({
        containerId: id,
        columnLabel: 'Permission Set',
        matches,
      });
    },
    [containerSeverity, findings],
  );

  const columns = useMemo((): ColumnWithFilter<PermissionSetAssignmentsTreeRow>[] => {
    if (!treeRows.length) {
      return [];
    }
    const groupCol: ColumnWithFilter<PermissionSetAssignmentsTreeRow> = {
      ...setColumnFromType<PermissionSetAssignmentsTreeRow>('_treePermissionSetGroupKey', 'text'),
      name: 'Permission Set',
      key: '_treePermissionSetGroupKey',
      field: '_treePermissionSetGroupKey',
      resizable: true,
      width: TREE_COL_PERM_SET,
      minWidth: TREE_PERM_SET_MIN_PX,
      maxWidth: TREE_PERM_SET_MAX_PX,
      renderGroupCell: (props) =>
        renderPermissionSetGroupCell(
          labelByPermissionSetId,
          tooltipByPermissionSetId,
          containerSeverity,
          setupLogin,
          openFindingsForPermissionSet,
          props,
        ),
      getValue: ({ row }) => {
        const id = row._treePermissionSetGroupKey;
        return labelByPermissionSetId.get(id) ?? id;
      },
    } as ColumnWithFilter<PermissionSetAssignmentsTreeRow>;

    const userCol: ColumnWithFilter<PermissionSetAssignmentsTreeRow> = {
      ...setColumnFromType<PermissionSetAssignmentsTreeRow>('AssigneeId', 'salesforceId'),
      name: 'Assigned User',
      key: 'AssigneeId',
      field: 'AssigneeId',
      resizable: true,
      width: TREE_COL_USER,
      minWidth: USER_COL_MIN_PX,
      getValue: ({ row }) => {
        if (isPermissionSetAssignmentsTreeUserLeaf(row)) {
          const userLeaf = row;
          const userId = typeof userLeaf.AssigneeId === 'string' ? userLeaf.AssigneeId.trim() : '';
          const display = userId ? assigneeDisplayById.get(userId) : undefined;
          if (display) {
            const inactiveTag = display.isActive ? '' : ' inactive';
            return `${display.name} ${display.username}${inactiveTag} ${userId}`.trim();
          }
          return userId;
        }
        if (isPermissionSetAssignmentsTreePlaceholderLeaf(row)) {
          return 'No direct user assignments';
        }
        return '';
      },
      renderCell: (props: RenderCellProps<PermissionSetAssignmentsTreeRow, unknown>) => {
        const row = props.row;
        if (!row) {
          return null;
        }
        if (isPermissionSetAssignmentsTreeUserLeaf(row)) {
          const userId = typeof row.AssigneeId === 'string' ? row.AssigneeId.trim() : '';
          if (!userId) {
            return null;
          }
          const userReturnUrl = getSalesforceUserManageSetupUrl(userId);
          const openUserButton = (
            <SalesforceLogin
              org={setupLogin.org}
              serverUrl={setupLogin.serverUrl}
              skipFrontDoorAuth={setupLogin.skipFrontDoorAuth}
              returnUrl={userReturnUrl}
              title="Open this user in Salesforce Setup"
              omitIcon
              className={OBJECT_TYPE_ACTION_BUTTON_CLASSNAME}
              onClick={(event) => {
                event.stopPropagation();
              }}
            >
              <Icon type="utility" icon="new_window" className="slds-button__icon" omitContainer />
            </SalesforceLogin>
          );
          if (assigneeDisplayLoading) {
            return (
              <div
                css={css`
                  display: flex;
                  align-items: center;
                  column-gap: 0.25rem;
                  width: 100%;
                  height: 100%;
                `}
              >
                <Spinner size="small" hasContainer={false} inline />
                {openUserButton}
              </div>
            );
          }
          const display = assigneeDisplayById.get(userId);
          if (display) {
            const nameTitle = `${display.name} — ${display.username}${display.isActive ? '' : ' (inactive)'}`;
            return (
              <div
                css={css`
                  display: flex;
                  align-items: flex-start;
                  column-gap: 0.25rem;
                  width: 100%;
                  height: 100%;
                `}
              >
                <div
                  className="slds-truncate"
                  title={nameTitle}
                  css={css`
                    flex: 1;
                    min-width: 0;
                  `}
                >
                  <div
                    css={css`
                      display: flex;
                      align-items: center;
                      column-gap: 0.35rem;
                      flex-wrap: wrap;
                      min-width: 0;
                    `}
                  >
                    <span className="text-bold slds-truncate">{display.name}</span>
                    {!display.isActive && (
                      <span
                        className="slds-no-flex"
                        css={css`
                          padding-top: 0.125rem;
                        `}
                      >
                        <Badge type="default" title="This user is inactive in Salesforce">
                          Inactive
                        </Badge>
                      </span>
                    )}
                  </div>
                  <p className="slds-text-body_small slds-text-color_weak">{display.username}</p>
                </div>
                <div className="slds-no-flex">{openUserButton}</div>
              </div>
            );
          }
          return (
            <div
              css={css`
                display: flex;
                align-items: flex-start;
                column-gap: 0.25rem;
                width: 100%;
                height: 100%;
              `}
            >
              <div
                className="slds-truncate"
                title={userId}
                css={css`
                  flex: 1;
                  min-width: 0;
                `}
              >
                <code className="slds-text-body_small">{userId}</code>
              </div>
              <div className="slds-no-flex">{openUserButton}</div>
            </div>
          );
        }
        if (isPermissionSetAssignmentsTreePlaceholderLeaf(row)) {
          return <div className="slds-text-color_weak slds-truncate">No direct user assignments</div>;
        }
        return null;
      },
    } as ColumnWithFilter<PermissionSetAssignmentsTreeRow>;

    return [groupCol, userCol];
  }, [
    treeRows,
    labelByPermissionSetId,
    tooltipByPermissionSetId,
    containerSeverity,
    setupLogin,
    openFindingsForPermissionSet,
    assigneeDisplayById,
    assigneeDisplayLoading,
  ]);

  const getRowKey = useCallback((row: PermissionSetAssignmentsTreeRow) => {
    if (typeof row.Id === 'string' && row.Id.length > 0) {
      return row.Id;
    }
    return row._treePermissionSetGroupKey;
  }, []);

  if (!permissionSetRows.length) {
    return (
      <div className="slds-p-around_medium">
        <ScopedNotification theme="info">No permission sets in this export slice.</ScopedNotification>
      </div>
    );
  }

  if (!treeRows.length) {
    return (
      <div className="slds-p-around_medium">
        <ScopedNotification theme="info">No permission set rows with Ids were available to build this tree.</ScopedNotification>
      </div>
    );
  }

  return (
    <AutoFullHeightContainer
      fillHeight
      bottomBuffer={24}
      baseCss={css`
        min-height: 200px;
      `}
    >
      <DataTree
        org={org}
        serverUrl={serverUrl}
        skipFrontdoorLogin={skipFrontdoorLogin}
        columns={columns}
        data={treeRows}
        getRowKey={getRowKey}
        includeQuickFilter
        context={{ defaultApiVersion }}
        groupBy={[...TREE_GROUP_BY]}
        rowGrouper={groupBy}
        expandedGroupIds={expandedGroupIds}
        onExpandedGroupIdsChange={setExpandedGroupIds}
        rowHeight={({ type }) => (type === 'GROUP' ? TREE_ROW_HEIGHT_GROUP_PX : TREE_ROW_HEIGHT_LEAF_PX)}
      />

      {findingsModal && (
        <PermissionAnalysisFindingsModal
          testId="permission-analysis-perm-set-tree-issues"
          open
          title="Issues for this permission set"
          tagline="From this job's permission export analysis, scoped to the permission set you selected."
          onClose={() => setFindingsModal(null)}
          findings={findingsModal.matches}
          summaryLine={
            <Fragment>
              <strong>{findingsModal.columnLabel}</strong>
              {' · '}
              {containerLabelById?.get(findingsModal.containerId) ?? findingsModal.containerId} — {findingsModal.matches.length}{' '}
              {findingsModal.matches.length === 1 ? 'issue' : 'issues'}
            </Fragment>
          }
        />
      )}
    </AutoFullHeightContainer>
  );
};
