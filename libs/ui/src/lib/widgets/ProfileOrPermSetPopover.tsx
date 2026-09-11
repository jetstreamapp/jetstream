import { css } from '@emotion/react';
import { ANALYTICS_KEYS } from '@jetstream/shared/constants';
import { query } from '@jetstream/shared/data';
import { formatNumber, useDebounce, useNonInitialEffect } from '@jetstream/shared/ui-utils';
import { pluralizeFromNumber } from '@jetstream/shared/utils';
import { PermissionSetNoProfileRecord, PermissionSetWithProfileRecord, SalesforceOrgUi } from '@jetstream/types';
import classNames from 'classnames';
import { Fragment, FunctionComponent, ReactNode, useCallback, useEffect, useRef, useState } from 'react';
import SearchInput from '../form/search-input/SearchInput';
import Grid from '../grid/Grid';
import { Popover } from '../popover/Popover';
import ScopedNotification from '../scoped-notification/ScopedNotification';
import AssistiveStatus from './AssistiveStatus';
import Icon from './Icon';
import { KeyboardShortcut } from './KeyboardShortcut';
import { ManagePermissionSetAssignmentsModal } from './ManagePermissionSetAssignmentsModal';
import { escapeSoqlLike, ID_ALLOWED } from './permission-set-assignment-utils';
import SalesforceLogin, { salesforceLoginAndRedirect } from './SalesforceLogin';
import Spinner from './Spinner';

export type ProfileOrPermSetRecordType = 'Profile' | 'PermissionSet';

interface AssignedUser {
  Id: string;
  Name: string;
  Username: string;
}

interface PermissionSetAssignmentQueryRecord {
  Assignee: AssignedUser;
}

export interface ProfileOrPermSetPopoverProps {
  /** Keep the trigger in the page tab order even inside a data-table grid (column-group headers). */
  keepGridTabStop?: boolean;
  org: SalesforceOrgUi;
  serverUrl: string;
  skipFrontDoorAuth?: boolean;
  recordId: string;
  recordType: ProfileOrPermSetRecordType;
  /** Optional metadata — when provided, the header renders without waiting for a fetch. */
  meta?: PermissionSetWithProfileRecord | PermissionSetNoProfileRecord;
  /** Custom content to render as the popover trigger. Defaults to an info icon. */
  displayValue?: ReactNode;
  buttonTitle?: string;
  /** Opt-in: renders a "Manage Assignments" footer button. Honored only for standalone Permission Sets. */
  allowManageAssignments?: boolean;
  /** Amplitude tracker (from the host's useAmplitude). Optional — defaults to a no-op. */
  trackEvent?: (key: string, value?: Record<string, any>) => void;
}

export function getProfileOrPermSetSetupUrl(recordType: ProfileOrPermSetRecordType, recordId: string) {
  const basePath = recordType === 'Profile' ? 'EnhancedProfiles' : 'PermSets';
  return `/lightning/setup/${basePath}/page?address=${encodeURIComponent(`/${recordId}?noredirect=1`)}`;
}

/** Setup → Permission Set Groups → group detail. */
export function getPermissionSetGroupSetupUrl(permissionSetGroupId: string): string {
  const trimmed = permissionSetGroupId.trim();
  return `/lightning/setup/PermSetGroups/page?address=${encodeURIComponent(`/${trimmed}?noredirect=1`)}`;
}

/** Setup → Users → user detail (expects a Salesforce User Id, prefix `005`). */
export function getSalesforceUserManageSetupUrl(userId: string): string {
  const trimmed = userId.trim();
  return `/lightning/setup/ManageUsers/page?address=${encodeURIComponent(`/${trimmed}?noredirect=1`)}`;
}

function getAssignedUsersQuery(recordType: ProfileOrPermSetRecordType, recordId: string, searchTerm: string): string | null {
  if (!ID_ALLOWED.test(recordId)) {
    return null;
  }
  const trimmed = searchTerm.trim();
  const userPrefix = recordType === 'Profile' ? '' : 'Assignee.';
  const searchClause = trimmed
    ? ` AND (${userPrefix}Name LIKE '%${escapeSoqlLike(trimmed)}%' OR ${userPrefix}Username LIKE '%${escapeSoqlLike(trimmed)}%')`
    : '';

  if (recordType === 'Profile') {
    return `SELECT Id, Name, Username FROM User WHERE ProfileId = '${recordId}' AND IsActive = true${searchClause} ORDER BY Name`;
  }
  return `SELECT Assignee.Id, Assignee.Name, Assignee.Username FROM PermissionSetAssignment WHERE PermissionSetId = '${recordId}' AND Assignee.IsActive = true${searchClause} ORDER BY Assignee.Name`;
}

function getHeaderInfo(recordType: ProfileOrPermSetRecordType, meta?: ProfileOrPermSetPopoverProps['meta']) {
  if (!meta) {
    return { label: null, name: null, badge: recordType === 'Profile' ? 'Profile' : 'Permission Set' };
  }
  if (recordType === 'Profile') {
    return {
      label: meta.Profile?.Name ?? meta.Label,
      // For profile-owned permission sets, `Name` is a Salesforce-generated string (e.g. `X00ex...`) that is not useful to display.
      name: null,
      badge: meta.IsCustom ? 'Custom Profile' : 'Standard Profile',
    };
  }
  return {
    label: meta.Label,
    name: meta.Name,
    badge: null,
  };
}

function getEffectiveRecordId(
  recordType: ProfileOrPermSetRecordType,
  recordId: string,
  meta?: ProfileOrPermSetPopoverProps['meta'],
): string {
  // When coming from useProfilesAndPermSets, the list item id is the PermissionSet id (0PS...) even for profile rows;
  // navigation and user-assignment lookups need the actual Profile id (00e...) stored on meta.ProfileId.
  if (recordType === 'Profile' && meta && 'ProfileId' in meta && meta.ProfileId) {
    return meta.ProfileId;
  }
  return recordId;
}

export const ProfileOrPermSetPopover: FunctionComponent<ProfileOrPermSetPopoverProps> = ({
  keepGridTabStop,
  org,
  serverUrl,
  skipFrontDoorAuth,
  recordId,
  recordType,
  meta,
  displayValue,
  buttonTitle,
  allowManageAssignments = false,
  trackEvent,
}) => {
  const isMounted = useRef(true);
  const currentRequestRef = useRef(0);
  const [isOpen, setIsOpen] = useState(false);
  const [isAssignmentModalOpen, setIsAssignmentModalOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [users, setUsers] = useState<AssignedUser[]>([]);
  const [totalSize, setTotalSize] = useState<number | null>(null);
  const [isComplete, setIsComplete] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const searchTermDebounced = useDebounce(searchTerm, 400);

  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);

  const effectiveRecordId = getEffectiveRecordId(recordType, recordId, meta);
  const returnUrl = getProfileOrPermSetSetupUrl(recordType, effectiveRecordId);

  // Reset state when we're pointing at a different record
  useNonInitialEffect(() => {
    setLoading(false);
    setErrorMessage(null);
    setUsers([]);
    setTotalSize(null);
    setIsComplete(true);
    setSearchTerm('');
  }, [effectiveRecordId, recordType]);

  const fetchAssignedUsers = useCallback(
    async (searchValue: string) => {
      const soql = getAssignedUsersQuery(recordType, effectiveRecordId, searchValue);
      if (!soql) {
        setErrorMessage(`Invalid ${recordType === 'Profile' ? 'profile' : 'permission set'} id.`);
        return;
      }
      const requestId = ++currentRequestRef.current;
      try {
        setLoading(true);
        setErrorMessage(null);
        const queryResults = await query<AssignedUser | PermissionSetAssignmentQueryRecord>(org, soql);
        if (!isMounted.current || currentRequestRef.current !== requestId) {
          return;
        }
        const { records, totalSize: total, done } = queryResults.queryResults;
        const parsed =
          recordType === 'Profile'
            ? (records as AssignedUser[])
            : (records as PermissionSetAssignmentQueryRecord[]).map((record) => record.Assignee);
        setUsers(parsed);
        setTotalSize(total);
        setIsComplete(done);
      } catch {
        if (isMounted.current && currentRequestRef.current === requestId) {
          setErrorMessage('There was an error loading assigned users.');
        }
      } finally {
        if (isMounted.current && currentRequestRef.current === requestId) {
          setLoading(false);
        }
      }
    },
    [org, effectiveRecordId, recordType],
  );

  // Fetch when popover opens, or when the debounced search term changes while open.
  useEffect(() => {
    if (!isOpen) {
      return;
    }
    fetchAssignedUsers(searchTermDebounced);
  }, [isOpen, searchTermDebounced, fetchAssignedUsers]);

  if (!recordId) {
    return null;
  }

  const headerInfo = getHeaderInfo(recordType, meta);
  const hiddenCount = isComplete || totalSize === null ? 0 : Math.max(totalSize - users.length, 0);
  // Profile-owned permission sets are granted through the profile, so they are never directly assignable.
  // Requires an explicit `false` rather than "not true" so a missing `meta` — callers may look it up from a
  // map that is momentarily empty, e.g. while org-scoped state resets — hides the action instead of offering it.
  const canManageAssignments =
    allowManageAssignments && recordType === 'PermissionSet' && meta?.IsOwnedByProfile === false && ID_ALLOWED.test(effectiveRecordId);

  function handleOpenAssignmentModal() {
    setIsAssignmentModalOpen(true);
    trackEvent?.(ANALYTICS_KEYS.permission_manager_assignments_opened, { recordType });
  }

  return (
    <Fragment>
      <Popover
        size="medium"
        // Rich dialog-like content (links, search, list) — without a trap, Tab tunnels out of the
        // portaled panel and strands keyboard users outside the page's flow
        trapFocus
        onChange={setIsOpen}
        panelProps={{
          'aria-label': headerInfo.label ? `${headerInfo.label} details` : 'Assignment details',
          onClick: (event) => event.stopPropagation(),
          onDoubleClick: (event) => event.stopPropagation(),
        }}
        footer={
          canManageAssignments ? (
            <footer className="slds-popover__footer">
              <button className="slds-button slds-button_neutral slds-button_stretch" onClick={handleOpenAssignmentModal}>
                <Icon type="utility" icon="people" className="slds-button__icon slds-button__icon_left" omitContainer />
                Manage Assignments
              </button>
            </footer>
          ) : undefined
        }
        content={
          <div
            css={css`
              display: flex;
              flex-direction: column;
            `}
          >
            <div className="slds-no-flex">
              <SalesforceLogin serverUrl={serverUrl} org={org} returnUrl={returnUrl} skipFrontDoorAuth={skipFrontDoorAuth}>
                View in Salesforce
              </SalesforceLogin>
              <div className="slds-m-top_x-small">
                {headerInfo.label && <div className="slds-text-heading_small slds-truncate">{headerInfo.label}</div>}
                <Grid align="spread" verticalAlign="center" className="slds-m-top_xx-small">
                  {headerInfo.name && (
                    <code
                      className="slds-text-body_small slds-text-color_weak slds-truncate"
                      css={css`
                        max-width: 70%;
                      `}
                      title={headerInfo.name}
                    >
                      {headerInfo.name}
                    </code>
                  )}
                  {headerInfo.badge && <span className="slds-badge">{headerInfo.badge}</span>}
                </Grid>
              </div>
              <hr className="slds-m-vertical_x-small" />
              <Grid align="spread" verticalAlign="center">
                <h3 className="slds-text-heading_small">Assigned Users{totalSize !== null ? ` (${totalSize})` : ''}</h3>
                <button
                  className="slds-button slds-button_icon slds-button_icon-container"
                  disabled={loading}
                  onClick={() => fetchAssignedUsers(searchTermDebounced)}
                  title="Reload assigned users"
                >
                  <Icon type="utility" icon="refresh" description="Reload assigned users" className="slds-button__icon" omitContainer />
                </button>
              </Grid>
              <div className="slds-m-top_xx-small">
                <SearchInput
                  id={`assigned-users-search-${effectiveRecordId}`}
                  placeholder="Filter users by name or username"
                  value={searchTerm}
                  loading={loading && !!searchTermDebounced}
                  onChange={setSearchTerm}
                />
              </div>
            </div>

            <div
              className="slds-is-relative slds-m-top_x-small"
              css={css`
                flex: 1 1 auto;
                max-height: 50vh;
                min-height: 60px;
                overflow-y: auto;
              `}
            >
              <AssistiveStatus
                message={
                  loading
                    ? 'Loading assigned users'
                    : errorMessage || (users.length > 0 ? `${users.length} assigned users listed` : 'No assigned users listed')
                }
              />
              {loading && users.length === 0 && <Spinner size="small" />}
              {errorMessage && (
                <ScopedNotification theme="error" className="slds-m-top_x-small">
                  {errorMessage}
                </ScopedNotification>
              )}
              {!loading && !errorMessage && users.length === 0 && (
                <p className="slds-text-body_small slds-text-color_weak">
                  {searchTermDebounced ? 'No users match this search.' : 'No active users assigned.'}
                </p>
              )}
              {users.length > 0 && (
                <ul className="slds-list_vertical-space">
                  {users.map((user) => (
                    <li key={user.Id} className="slds-truncate slds-m-bottom_xx-small" title={`${user.Name} — ${user.Username}`}>
                      <p className="text-bold">{user.Name}</p>
                      <p className="slds-text-body_small slds-text-color_weak">{user.Username}</p>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="slds-no-flex slds-m-top_x-small">
              {hiddenCount > 0 && (
                <p className="slds-text-body_small slds-text-color_weak">
                  {formatNumber(hiddenCount)} more {pluralizeFromNumber('user', hiddenCount)} not shown. Open in Salesforce to see all.
                </p>
              )}
              <div className="slds-grid slds-text-body_small slds-text-color_weak slds-m-top_xx-small">
                Use <KeyboardShortcut className="slds-m-left_x-small" keys={['shift', 'click']} /> to skip this popup
              </div>
            </div>
          </div>
        }
        buttonProps={{
          className: classNames('slds-button', { 'slds-button_icon': !displayValue }),
          title: buttonTitle ?? `View ${recordType === 'Profile' ? 'profile' : 'permission set'} details`,
          onClick: (event) => event.stopPropagation(),
          // Column-group headers sit outside the grid's cell navigation, so the trigger must stay a
          // real page tab stop (see useGridTabOrderContainment)
          ...(keepGridTabStop ? { 'data-grid-keep-tab-stop': 'true' } : {}),
        }}
      >
        <span
          onClick={(event) => {
            if (event.shiftKey || event.ctrlKey || event.metaKey) {
              event.stopPropagation();
              event.preventDefault();
              salesforceLoginAndRedirect({
                serverUrl,
                org,
                returnUrl,
                skipFrontDoorAuth,
              });
            }
          }}
        >
          {displayValue ?? (
            <Icon
              type="utility"
              icon="info"
              description={buttonTitle ?? `View ${recordType === 'Profile' ? 'profile' : 'permission set'} details`}
              className="slds-button__icon"
              omitContainer
            />
          )}
        </span>
      </Popover>
      {/*
        Rendered as a SIBLING of <Popover> so an in-flight save survives even if the popover closes.
        The modal does not dismiss the popover: Modal renders <FloatingFocusManager modal>, whose markOthers()
        stamps data-floating-ui-inert on every body child except the modal's own portal, and useDismiss treats
        a press whose root ancestor carries no marker as an element injected after the floating element
        rendered — so it bails instead of closing.
      */}
      {isAssignmentModalOpen && (
        <ManagePermissionSetAssignmentsModal
          org={org}
          permissionSetId={effectiveRecordId}
          permissionSetLabel={headerInfo.label ?? effectiveRecordId}
          permissionSetName={headerInfo.name ?? undefined}
          isOwnedByProfile={meta?.IsOwnedByProfile}
          trackEvent={trackEvent}
          onSaved={() => fetchAssignedUsers(searchTermDebounced)}
          onClose={() => setIsAssignmentModalOpen(false)}
        />
      )}
    </Fragment>
  );
};

export default ProfileOrPermSetPopover;
