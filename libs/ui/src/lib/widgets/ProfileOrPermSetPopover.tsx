import { css } from '@emotion/react';
import { query } from '@jetstream/shared/data';
import { formatNumber, useDebounce, useNonInitialEffect } from '@jetstream/shared/ui-utils';
import { pluralizeFromNumber } from '@jetstream/shared/utils';
import { PermissionSetNoProfileRecord, PermissionSetWithProfileRecord, SalesforceOrgUi } from '@jetstream/types';
import classNames from 'classnames';
import { FunctionComponent, ReactNode, useCallback, useEffect, useRef, useState } from 'react';
import SearchInput from '../form/search-input/SearchInput';
import Grid from '../grid/Grid';
import { Popover } from '../popover/Popover';
import ScopedNotification from '../scoped-notification/ScopedNotification';
import Icon from './Icon';
import { KeyboardShortcut } from './KeyboardShortcut';
import SalesforceLogin, { salesforceLoginAndRedirect } from './SalesforceLogin';
import Spinner from './Spinner';

const ID_ALLOWED = /^[a-zA-Z0-9]{15,18}$/;

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
}

export function getProfileOrPermSetSetupUrl(recordType: ProfileOrPermSetRecordType, recordId: string) {
  const basePath = recordType === 'Profile' ? 'EnhancedProfiles' : 'PermSets';
  return `/lightning/setup/${basePath}/page?address=${encodeURIComponent(`/${recordId}?noredirect=1`)}`;
}

// Escape backslash, single quote, percent, and underscore in one pass so SOQL LIKE treats user input literally.
function escapeSoqlLike(value: string): string {
  if (!value) {
    return value;
  }
  return value.replace(/['\\%_]/g, (char) => '\\' + char);
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
  org,
  serverUrl,
  skipFrontDoorAuth,
  recordId,
  recordType,
  meta,
  displayValue,
  buttonTitle,
}) => {
  const isMounted = useRef(true);
  const currentRequestRef = useRef(0);
  const [isOpen, setIsOpen] = useState(false);
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

  return (
    <Popover
      size="medium"
      onChange={setIsOpen}
      panelProps={{
        onClick: (event) => event.stopPropagation(),
        onDoubleClick: (event) => event.stopPropagation(),
      }}
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
        className: classNames('slds-button', { 'slds-button_icon slds-button_icon-container': !displayValue }),
        title: buttonTitle ?? `View ${recordType === 'Profile' ? 'profile' : 'permission set'} details`,
        onClick: (event) => event.stopPropagation(),
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
        {displayValue ?? <Icon type="utility" icon="info" description="View details" className="slds-button__icon" omitContainer />}
      </span>
    </Popover>
  );
};

export default ProfileOrPermSetPopover;
