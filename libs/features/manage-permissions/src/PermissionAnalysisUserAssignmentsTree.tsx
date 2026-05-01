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
  getPermissionSetGroupSetupUrl,
  getProfileOrPermSetSetupUrl,
  getSalesforceUserManageSetupUrl,
  Icon,
  SalesforceLogin,
  ScopedNotification,
  setColumnFromType,
  Spinner,
} from '@jetstream/ui';
import groupBy from 'lodash/groupBy';
import { Fragment, FunctionComponent, useCallback, useEffect, useLayoutEffect, useMemo, useState } from 'react';
import type { RenderCellProps, RenderGroupCellProps } from 'react-data-grid';
import { PermissionAnalysisFindingsModal } from './PermissionAnalysisFindingsModal';
import { permissionAnalysisAssignmentTypeLabelCss } from './permission-analysis-viewer-badge.styles';
import {
  buildContainerIdFindingSeverity,
  buildPermissionSetGroupLabelMap,
  buildPermissionSetIdLabelMap,
  buildUserAssignmentsTreeRows,
  listFindingsForExportContainer,
  sortUserAssignmentsTreeRowsByUserDisplay,
  type PermissionAnalysisFinding,
  type PermissionExportRow,
  type UserAssignmentsTreeRow,
  type UserLicenseLeafRecord,
} from './permission-export-result-view';

const TREE_GROUP_BY = ['_treeUserGroupKey'] as const;

const TREE_USER_GROUP_MIN_PX = 200;
const TREE_USER_GROUP_MAX_PX = 420;
const TREE_COL_USER = `minmax(${TREE_USER_GROUP_MIN_PX}px, min(${TREE_USER_GROUP_MAX_PX}px, 1.35fr))`;

const ASSIGNMENT_COL_MIN_PX = 220;
const TREE_COL_ASSIGNMENT = `minmax(${ASSIGNMENT_COL_MIN_PX}px, 1fr)`;

const USER_SOQL_CHUNK_SIZE = 200;

const TREE_ROW_HEIGHT_LEAF_PX = 48;
const TREE_ROW_HEIGHT_GROUP_PX = 48;

const OBJECT_TYPE_ACTION_BUTTON_CLASSNAME = 'slds-button slds-button_icon slds-button_icon-bare';

interface UserTreeDisplay {
  name: string;
  username: string;
  isActive: boolean;
  profileId: string | null;
  profileName: string | null;
}

function userRecordIsActive(record: { IsActive?: unknown }): boolean {
  const value = record.IsActive;
  if (value === false || value === 'false') {
    return false;
  }
  return true;
}

function readProfileFromUserRecord(record: { ProfileId?: unknown; Profile?: unknown }): {
  profileId: string | null;
  profileName: string | null;
} {
  const profileId = typeof record.ProfileId === 'string' && record.ProfileId.trim() ? record.ProfileId.trim() : null;
  const profileBlock = record.Profile;
  const profileName =
    profileBlock &&
    typeof profileBlock === 'object' &&
    profileBlock !== null &&
    'Name' in profileBlock &&
    typeof (profileBlock as { Name?: unknown }).Name === 'string'
      ? String((profileBlock as { Name: string }).Name).trim()
      : null;
  return { profileId, profileName: profileName && profileName.length > 0 ? profileName : null };
}

function collectUniqueUserIdsFromAssignments(assignments: PermissionExportRow[]): string[] {
  const ids = new Set<string>();
  for (const row of assignments) {
    const assigneeId = row.AssigneeId;
    if (typeof assigneeId === 'string' && assigneeId.trim().startsWith('005')) {
      ids.add(assigneeId.trim());
    }
  }
  return [...ids].sort((a, b) => a.localeCompare(b));
}

type ContainerFindingsModalState = {
  containerId: string;
  columnLabel: string;
  matches: PermissionAnalysisFinding[];
};

function renderUserGroupCell(
  userDisplayById: Map<string, UserTreeDisplay>,
  setupLogin: { org: SalesforceOrgUi; serverUrl: string; skipFrontDoorAuth: boolean },
  { groupKey, childRows, isExpanded, toggleGroup }: RenderGroupCellProps<UserAssignmentsTreeRow>,
) {
  const userId = String(groupKey);
  const display = userDisplayById.get(userId);
  const titleLabel = display ? `${display.name} — ${display.username}` : userId;

  return (
    <div
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
          <span
            css={css`
              flex: 1;
              min-width: 0;
              text-align: left;
            `}
          >
            {display ? (
              <Fragment>
                <div
                  css={css`
                    display: flex;
                    align-items: center;
                    column-gap: 0.35rem;
                    flex-wrap: wrap;
                    min-width: 0;
                  `}
                >
                  <span
                    className="text-bold slds-truncate"
                    css={css`
                      flex: 1;
                      min-width: 0;
                    `}
                  >
                    {display.name}
                  </span>
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
                  <span className="slds-text-body_small slds-text-color_weak slds-no-flex">({childRows.length})</span>
                </div>
                <p className="slds-text-body_small slds-text-color_weak slds-truncate">{display.username}</p>
              </Fragment>
            ) : (
              <span
                css={css`
                  display: inline-flex;
                  align-items: center;
                  column-gap: 0.35rem;
                  flex-wrap: wrap;
                  min-width: 0;
                `}
              >
                <code className="slds-text-body_small slds-truncate">{userId}</code>
                <span className="slds-text-body_small slds-text-color_weak slds-no-flex">({childRows.length})</span>
              </span>
            )}
          </span>
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
          returnUrl={getSalesforceUserManageSetupUrl(userId)}
          title="Open this user in Salesforce Setup"
          omitIcon
          className={OBJECT_TYPE_ACTION_BUTTON_CLASSNAME}
          onClick={(event) => {
            event.stopPropagation();
          }}
        >
          <Icon type="utility" icon="new_window" className="slds-button__icon" omitContainer />
        </SalesforceLogin>
      </div>
    </div>
  );
}

export interface PermissionAnalysisUserAssignmentsTreeProps {
  permissionSetAssignments: PermissionExportRow[];
  permissionSets: PermissionExportRow[];
  permissionSetGroupComponents: PermissionExportRow[];
  permissionSetGroups: PermissionExportRow[];
  org: SalesforceOrgUi;
  serverUrl: string;
  skipFrontdoorLogin: boolean;
  defaultApiVersion: string;
  findings?: PermissionAnalysisFinding[];
  containerLabelById?: Map<string, string>;
}

/**
 * Assignments from the export, grouped by user: permission sets (from assignments), inferred permission set groups,
 * Salesforce profile, and permission set licenses (from {@link UserPermissionSetLicense} when available).
 */
export const PermissionAnalysisUserAssignmentsTree: FunctionComponent<PermissionAnalysisUserAssignmentsTreeProps> = ({
  permissionSetAssignments,
  permissionSets,
  permissionSetGroupComponents,
  permissionSetGroups,
  org,
  serverUrl,
  skipFrontdoorLogin,
  defaultApiVersion,
  findings = [],
  containerLabelById,
}) => {
  const [licensesByUserId, setLicensesByUserId] = useState<Map<string, UserLicenseLeafRecord[]>>(() => new Map());

  const baseTreeRows = useMemo(
    () =>
      buildUserAssignmentsTreeRows({
        assignments: permissionSetAssignments,
        permissionSets,
        groupComponents: permissionSetGroupComponents,
        groups: permissionSetGroups,
        licensesByUserId,
      }),
    [permissionSetAssignments, permissionSets, permissionSetGroupComponents, permissionSetGroups, licensesByUserId],
  );

  const labelByPermissionSetId = useMemo(() => buildPermissionSetIdLabelMap(permissionSets), [permissionSets]);
  const labelByGroupId = useMemo(() => buildPermissionSetGroupLabelMap(permissionSetGroups), [permissionSetGroups]);
  const permissionSetRowById = useMemo(() => {
    const map = new Map<string, PermissionExportRow>();
    for (const row of permissionSets) {
      const id = typeof row.Id === 'string' ? row.Id.trim() : '';
      if (id) {
        map.set(id, row);
      }
    }
    return map;
  }, [permissionSets]);

  const [userDisplayById, setUserDisplayById] = useState<Map<string, UserTreeDisplay>>(() => new Map());
  const [userDisplayLoading, setUserDisplayLoading] = useState(false);

  useEffect(() => {
    if (!org?.uniqueId) {
      setUserDisplayById(new Map());
      setUserDisplayLoading(false);
      return;
    }
    const ids = collectUniqueUserIdsFromAssignments(permissionSetAssignments);
    if (ids.length === 0) {
      setUserDisplayById(new Map());
      setUserDisplayLoading(false);
      return;
    }

    let cancelled = false;
    setUserDisplayLoading(true);

    void (async () => {
      try {
        const merged = new Map<string, UserTreeDisplay>();
        for (let index = 0; index < ids.length; index += USER_SOQL_CHUNK_SIZE) {
          const chunk = ids.slice(index, index + USER_SOQL_CHUNK_SIZE);
          const inList = chunk.map((id) => `'${escapeSoqlString(id)}'`).join(', ');
          const soql = `SELECT Id, Name, Username, IsActive, ProfileId, Profile.Name FROM User WHERE Id IN (${inList})`;
          const response = await query<{
            Id: string;
            Name?: string;
            Username?: string;
            IsActive?: boolean;
            ProfileId?: string;
            Profile?: { Name?: string };
          }>(org, soql);
          for (const record of response.queryResults.records ?? []) {
            const recordId = typeof record.Id === 'string' ? record.Id.trim() : '';
            if (!recordId) {
              continue;
            }
            const { profileId, profileName } = readProfileFromUserRecord(record);
            merged.set(recordId, {
              name: typeof record.Name === 'string' && record.Name.trim() ? record.Name.trim() : recordId,
              username: typeof record.Username === 'string' && record.Username.trim() ? record.Username.trim() : '',
              isActive: userRecordIsActive(record),
              profileId,
              profileName,
            });
          }
        }
        if (!cancelled) {
          setUserDisplayById(merged);
        }
      } catch (error) {
        logger.warn('Failed to load User rows for assignments tree', error);
        if (!cancelled) {
          setUserDisplayById(new Map());
        }
      } finally {
        if (!cancelled) {
          setUserDisplayLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [org, permissionSetAssignments]);

  useEffect(() => {
    if (!org?.uniqueId) {
      setLicensesByUserId(new Map());
      return;
    }
    const ids = collectUniqueUserIdsFromAssignments(permissionSetAssignments);
    if (ids.length === 0) {
      setLicensesByUserId(new Map());
      return;
    }

    let cancelled = false;

    void (async () => {
      try {
        const merged = new Map<string, UserLicenseLeafRecord[]>();
        const seenKeys = new Set<string>();
        for (let index = 0; index < ids.length; index += USER_SOQL_CHUNK_SIZE) {
          const chunk = ids.slice(index, index + USER_SOQL_CHUNK_SIZE);
          const inList = chunk.map((id) => `'${escapeSoqlString(id)}'`).join(', ');
          const soql = `SELECT UserId, PermissionSetLicenseId, PermissionSetLicense.MasterLabel, PermissionSetLicense.DeveloperName FROM UserPermissionSetLicense WHERE UserId IN (${inList})`;
          const response = await query<{
            UserId?: string;
            PermissionSetLicenseId?: string;
            PermissionSetLicense?: { MasterLabel?: string; DeveloperName?: string };
          }>(org, soql);
          for (const record of response.queryResults.records ?? []) {
            const userId = typeof record.UserId === 'string' ? record.UserId.trim() : '';
            const licenseId = typeof record.PermissionSetLicenseId === 'string' ? record.PermissionSetLicenseId.trim() : '';
            if (!userId || !licenseId) {
              continue;
            }
            const dedupeKey = `${userId}::${licenseId}`;
            if (seenKeys.has(dedupeKey)) {
              continue;
            }
            seenKeys.add(dedupeKey);
            const licBlock = record.PermissionSetLicense;
            const master =
              licBlock && typeof licBlock.MasterLabel === 'string' && licBlock.MasterLabel.trim() ? licBlock.MasterLabel.trim() : '';
            const dev =
              licBlock && typeof licBlock.DeveloperName === 'string' && licBlock.DeveloperName.trim() ? licBlock.DeveloperName.trim() : '';
            const label = master || dev || licenseId;
            const list = merged.get(userId) ?? [];
            list.push({ permissionSetLicenseId: licenseId, label });
            merged.set(userId, list);
          }
        }
        if (!cancelled) {
          setLicensesByUserId(merged);
        }
      } catch (error) {
        logger.warn('Failed to load UserPermissionSetLicense rows for assignments tree', error);
        if (!cancelled) {
          setLicensesByUserId(new Map());
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [org, permissionSetAssignments]);

  const displayLabelByUserId = useMemo(() => {
    const map = new Map<string, string>();
    for (const [userId, display] of userDisplayById) {
      map.set(userId, display.name);
    }
    return map;
  }, [userDisplayById]);

  const treeRows = useMemo(() => {
    const sorted = sortUserAssignmentsTreeRowsByUserDisplay(baseTreeRows, displayLabelByUserId);
    return sorted.map((row) => {
      if (row._leafKind !== 'profile') {
        return row;
      }
      const profileId = userDisplayById.get(row._treeUserGroupKey)?.profileId ?? null;
      if (!profileId) {
        return row;
      }
      return { ...row, _profileId: profileId };
    });
  }, [baseTreeRows, displayLabelByUserId, userDisplayById]);

  const containerSeverity = useMemo(() => {
    if (findings.length === 0) {
      return null;
    }
    return buildContainerIdFindingSeverity(findings);
  }, [findings]);

  const allExpandedGroupIds = useMemo(() => {
    const ids = new Set<unknown>();
    for (const row of treeRows) {
      ids.add(row._treeUserGroupKey);
    }
    return ids;
  }, [treeRows]);

  const [expandedGroupIds, setExpandedGroupIds] = useState<Set<unknown>>(() => new Set());
  useLayoutEffect(() => {
    setExpandedGroupIds(new Set(allExpandedGroupIds));
  }, [allExpandedGroupIds]);

  const [findingsModal, setFindingsModal] = useState<ContainerFindingsModalState | null>(null);

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

  const columns = useMemo((): ColumnWithFilter<UserAssignmentsTreeRow>[] => {
    if (!treeRows.length) {
      return [];
    }

    const userCol: ColumnWithFilter<UserAssignmentsTreeRow> = {
      ...setColumnFromType<UserAssignmentsTreeRow>('_treeUserGroupKey', 'text'),
      name: 'User',
      key: '_treeUserGroupKey',
      field: '_treeUserGroupKey',
      resizable: true,
      width: TREE_COL_USER,
      minWidth: TREE_USER_GROUP_MIN_PX,
      maxWidth: TREE_USER_GROUP_MAX_PX,
      renderGroupCell: (props) => renderUserGroupCell(userDisplayById, setupLogin, props),
      getValue: ({ row }) => {
        const userId = row._treeUserGroupKey;
        const display = userDisplayById.get(userId);
        if (display) {
          return `${display.name} ${display.username} ${userId}`.trim();
        }
        return userId;
      },
    } as ColumnWithFilter<UserAssignmentsTreeRow>;

    const assignmentCol: ColumnWithFilter<UserAssignmentsTreeRow> = {
      ...setColumnFromType<UserAssignmentsTreeRow>('Id', 'text'),
      name: 'Assignment',
      key: 'Id',
      field: 'Id',
      resizable: true,
      width: TREE_COL_ASSIGNMENT,
      minWidth: ASSIGNMENT_COL_MIN_PX,
      getValue: ({ row }) => {
        const userId = row._treeUserGroupKey;
        if (row._leafKind === 'permission_set' && row._permissionSetId) {
          const label = labelByPermissionSetId.get(row._permissionSetId) ?? row._permissionSetId;
          return `${label} ${row._permissionSetId} ${userId}`.trim();
        }
        if (row._leafKind === 'permission_set_group' && row._permissionSetGroupId) {
          const label = labelByGroupId.get(row._permissionSetGroupId) ?? row._permissionSetGroupId;
          return `${label} permission set group ${userId}`.trim();
        }
        if (row._leafKind === 'profile') {
          const profileName = userDisplayById.get(userId)?.profileName ?? '';
          return `profile ${profileName} ${userId}`.trim();
        }
        if (row._leafKind === 'permission_set_license') {
          return `${row._licenseLabel ?? ''} license ${userId}`.trim();
        }
        return '';
      },
      renderCell: (props: RenderCellProps<UserAssignmentsTreeRow, unknown>) => {
        const row = props.row;
        if (!row) {
          return null;
        }

        if (userDisplayLoading && row._leafKind === 'profile') {
          return <Spinner size="small" hasContainer={false} inline />;
        }

        if (row._leafKind === 'permission_set' && row._permissionSetId) {
          const permissionSetId = row._permissionSetId;
          const label = labelByPermissionSetId.get(permissionSetId) ?? permissionSetId;
          const permSetRow = permissionSetRowById.get(permissionSetId);
          const isProfileOwned = permSetRow?.IsOwnedByProfile === true;
          const profileIdForSetup =
            permSetRow && typeof permSetRow.ProfileId === 'string' && permSetRow.ProfileId.trim().length > 0 && isProfileOwned
              ? permSetRow.ProfileId.trim()
              : null;
          const recordType = isProfileOwned && profileIdForSetup ? 'Profile' : 'PermissionSet';
          const setupTargetId = recordType === 'Profile' && profileIdForSetup ? profileIdForSetup : permissionSetId;
          const returnUrl = getProfileOrPermSetSetupUrl(recordType, setupTargetId);
          const severity = containerSeverity?.get(permissionSetId);
          const openUserButton = (
            <SalesforceLogin
              org={setupLogin.org}
              serverUrl={setupLogin.serverUrl}
              skipFrontDoorAuth={setupLogin.skipFrontDoorAuth}
              returnUrl={returnUrl}
              title={recordType === 'Profile' ? 'Open this profile in Salesforce Setup' : 'Open this permission set in Salesforce Setup'}
              omitIcon
              className={OBJECT_TYPE_ACTION_BUTTON_CLASSNAME}
              onClick={(event) => {
                event.stopPropagation();
              }}
            >
              <Icon type="utility" icon="new_window" className="slds-button__icon" omitContainer />
            </SalesforceLogin>
          );

          return (
            <div
              css={css`
                display: flex;
                align-items: flex-start;
                column-gap: 0.25rem;
                width: 100%;
                height: 100%;
                padding-top: 0.125rem;
              `}
            >
              <div
                className="slds-truncate"
                title={label}
                css={css`
                  flex: 1;
                  min-width: 0;
                `}
              >
                <p className="slds-text-body_small slds-m-bottom_xx-small">
                  <span css={permissionAnalysisAssignmentTypeLabelCss('permission_set')}>Permission set</span>
                </p>
                <p className="text-bold slds-truncate">{label}</p>
              </div>
              <div
                className="slds-no-flex"
                css={css`
                  display: flex;
                  align-items: center;
                  column-gap: 0.125rem;
                `}
              >
                {openUserButton}
                {severity && (
                  <button
                    type="button"
                    className="slds-button slds-button_icon slds-button_icon-bare"
                    title="View findings for this permission set"
                    onClick={(event) => {
                      event.stopPropagation();
                      openFindingsForPermissionSet(permissionSetId);
                    }}
                  >
                    <Icon
                      type="utility"
                      icon={severity === 'error' ? 'error' : 'warning'}
                      className={
                        severity === 'error' ? 'slds-button__icon slds-icon-text-error' : 'slds-button__icon slds-icon-text-warning'
                      }
                      omitContainer
                      description="View findings"
                    />
                  </button>
                )}
              </div>
            </div>
          );
        }

        if (row._leafKind === 'permission_set_group' && row._permissionSetGroupId) {
          const groupId = row._permissionSetGroupId;
          const label = labelByGroupId.get(groupId) ?? groupId;
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
                title={label}
                css={css`
                  flex: 1;
                  min-width: 0;
                `}
              >
                <p className="slds-text-body_small slds-m-bottom_xx-small">
                  <span css={permissionAnalysisAssignmentTypeLabelCss('permission_set_group')}>Permission set group</span>
                </p>
                <p className="text-bold slds-truncate">{label}</p>
              </div>
              <div className="slds-no-flex">
                <SalesforceLogin
                  org={setupLogin.org}
                  serverUrl={setupLogin.serverUrl}
                  skipFrontDoorAuth={setupLogin.skipFrontDoorAuth}
                  returnUrl={getPermissionSetGroupSetupUrl(groupId)}
                  title="Open this permission set group in Salesforce Setup"
                  omitIcon
                  className={OBJECT_TYPE_ACTION_BUTTON_CLASSNAME}
                  onClick={(event) => {
                    event.stopPropagation();
                  }}
                >
                  <Icon type="utility" icon="new_window" className="slds-button__icon" omitContainer />
                </SalesforceLogin>
              </div>
            </div>
          );
        }

        if (row._leafKind === 'profile') {
          const userId = row._treeUserGroupKey;
          const display = userDisplayById.get(userId);
          const profileName = display?.profileName ?? '—';
          const profileId = row._profileId ?? display?.profileId ?? null;
          const returnUrl = profileId ? getProfileOrPermSetSetupUrl('Profile', profileId) : null;
          return (
            <div
              css={css`
                display: flex;
                align-items: flex-start;
                column-gap: 0.25rem;
                width: 100%;
                height: 100%;
                padding-top: 0.125rem;
              `}
            >
              <div
                className="slds-truncate"
                title={profileName}
                css={css`
                  flex: 1;
                  min-width: 0;
                `}
              >
                <p className="slds-text-body_small slds-m-bottom_xx-small">
                  <span css={permissionAnalysisAssignmentTypeLabelCss('profile')}>Profile</span>
                </p>
                <p className="text-bold slds-truncate">{profileName}</p>
              </div>
              {returnUrl && (
                <div className="slds-no-flex">
                  <SalesforceLogin
                    org={setupLogin.org}
                    serverUrl={setupLogin.serverUrl}
                    skipFrontDoorAuth={setupLogin.skipFrontDoorAuth}
                    returnUrl={returnUrl}
                    title="Open this profile in Salesforce Setup"
                    omitIcon
                    className={OBJECT_TYPE_ACTION_BUTTON_CLASSNAME}
                    onClick={(event) => {
                      event.stopPropagation();
                    }}
                  >
                    <Icon type="utility" icon="new_window" className="slds-button__icon" omitContainer />
                  </SalesforceLogin>
                </div>
              )}
            </div>
          );
        }

        if (row._leafKind === 'permission_set_license') {
          const label = row._licenseLabel ?? row._permissionSetLicenseId ?? '';
          const licenseId = row._permissionSetLicenseId;
          const returnUrl = licenseId ? `/${licenseId}` : null;
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
                title={label}
                css={css`
                  flex: 1;
                  min-width: 0;
                `}
              >
                <p className="slds-text-body_small slds-text-color_weak">Permission set license</p>
                <p className="text-bold slds-truncate">{label}</p>
              </div>
              {returnUrl && (
                <div className="slds-no-flex">
                  <SalesforceLogin
                    org={setupLogin.org}
                    serverUrl={setupLogin.serverUrl}
                    skipFrontDoorAuth={setupLogin.skipFrontDoorAuth}
                    returnUrl={returnUrl}
                    title="Open this permission set license in Salesforce"
                    omitIcon
                    className={OBJECT_TYPE_ACTION_BUTTON_CLASSNAME}
                    onClick={(event) => {
                      event.stopPropagation();
                    }}
                  >
                    <Icon type="utility" icon="new_window" className="slds-button__icon" omitContainer />
                  </SalesforceLogin>
                </div>
              )}
            </div>
          );
        }

        return null;
      },
    } as ColumnWithFilter<UserAssignmentsTreeRow>;

    return [userCol, assignmentCol];
  }, [
    treeRows,
    userDisplayById,
    userDisplayLoading,
    labelByPermissionSetId,
    labelByGroupId,
    permissionSetRowById,
    containerSeverity,
    setupLogin,
    openFindingsForPermissionSet,
  ]);

  const getRowKey = useCallback((row: UserAssignmentsTreeRow) => row.Id, []);

  if (!permissionSetAssignments.length) {
    return (
      <div className="slds-p-around_medium">
        <ScopedNotification theme="info">No permission set assignments in this export slice.</ScopedNotification>
      </div>
    );
  }

  if (!collectUniqueUserIdsFromAssignments(permissionSetAssignments).length) {
    return (
      <div className="slds-p-around_medium">
        <ScopedNotification theme="info">No user assignments (User Ids) were found in this export.</ScopedNotification>
      </div>
    );
  }

  if (!treeRows.length) {
    return (
      <div className="slds-p-around_medium">
        <ScopedNotification theme="info">No rows were available to build the assignments tree.</ScopedNotification>
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
          testId="permission-analysis-user-assignments-tree-findings"
          open
          title="Findings for this permission set"
          tagline="From this job's permission export analysis, scoped to the permission set you selected."
          onClose={() => setFindingsModal(null)}
          findings={findingsModal.matches}
          summaryLine={
            <Fragment>
              <strong>{findingsModal.columnLabel}</strong>
              {' · '}
              {containerLabelById?.get(findingsModal.containerId) ?? findingsModal.containerId} — {findingsModal.matches.length}{' '}
              {findingsModal.matches.length === 1 ? 'finding' : 'findings'}
            </Fragment>
          }
        />
      )}
    </AutoFullHeightContainer>
  );
};
