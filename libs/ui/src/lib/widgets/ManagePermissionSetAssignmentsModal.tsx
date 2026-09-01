import { css } from '@emotion/react';
import { ANALYTICS_KEYS } from '@jetstream/shared/constants';
import { queryAll, sobjectOperation } from '@jetstream/shared/data';
import { tracker } from '@jetstream/shared/ui-utils';
import { getErrorMessage, multiWordObjectFilter, pluralizeFromNumber, splitArrayToMaxSize } from '@jetstream/shared/utils';
import { ListItem, PermissionSetAssignmentRecord, RecordResult, SalesforceOrgUi } from '@jetstream/types';
import classNames from 'classnames';
import { Fragment, FunctionComponent, ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ariaDisabledButtonProps } from '../form/button/aria-disabled-button.utils';
import Checkbox from '../form/checkbox/Checkbox';
import { ComboboxWithItemsTypeAhead } from '../form/combobox/ComboboxWithItemsTypeAhead';
import SearchInput from '../form/search-input/SearchInput';
import Grid from '../grid/Grid';
import { ConfirmationModalPromise } from '../modal/ConfirmationModalPromise';
import Modal from '../modal/Modal';
import ScopedNotification from '../scoped-notification/ScopedNotification';
import { fireToast } from '../toast/AppToast';
import Icon from './Icon';
import { getPermissionSetAssignmentsQuery, getUserSearchQuery, ID_ALLOWED, MAX_ASSIGNMENTS } from './permission-set-assignment-utils';
import Spinner from './Spinner';

/** Salesforce composite record limit for a single create/delete request. */
const MAX_RECORDS_PER_REQUEST = 200;
/** Cap on how many individual failures we spell out before collapsing the rest into a count. */
const MAX_VISIBLE_FAILURES = 10;

interface AssignmentRow {
  assignmentId: string;
  userId: string;
  name: string;
  username: string;
  isActive: boolean;
}

interface UserSearchRecord {
  Id: string;
  Name: string;
  Username: string;
  Profile?: { Name: string } | null;
}

interface SaveFailure {
  label: string;
  message: string;
}

export interface ManagePermissionSetAssignmentsModalProps {
  org: SalesforceOrgUi;
  permissionSetId: string;
  permissionSetLabel: string;
  permissionSetName?: string;
  /** Profile-owned permission sets cannot be assigned — the modal renders an explanation instead of the editor. */
  isOwnedByProfile?: boolean;
  /** Amplitude tracker (from the host's useAmplitude). Optional — defaults to a no-op. */
  trackEvent?: (key: string, value?: Record<string, any>) => void;
  /** Assignments changed on the server — the host should refresh anything showing them. */
  onSaved: () => void;
  onClose: () => void;
}

/** Name / badges / username line, shared by both panels so staged additions read like existing assignments. */
function UserRowLabel({
  name,
  username,
  badges,
  strikeThrough,
}: {
  name: string;
  username: string;
  badges?: ReactNode;
  strikeThrough?: boolean;
}) {
  return (
    <span
      className="slds-truncate"
      css={
        strikeThrough
          ? css`
              text-decoration: line-through;
            `
          : undefined
      }
    >
      <span className="text-bold">{name}</span>
      {badges}
      <span className="slds-text-body_small slds-text-color_weak slds-m-left_xx-small">{username}</span>
    </span>
  );
}

function getRecordResultErrorMessage(result: RecordResult): string {
  if (result.success) {
    return '';
  }
  return result.errors.map(({ message }) => message).join(' ') || 'An unknown error occurred.';
}

export const ManagePermissionSetAssignmentsModal: FunctionComponent<ManagePermissionSetAssignmentsModalProps> = ({
  org,
  permissionSetId,
  permissionSetLabel,
  permissionSetName,
  isOwnedByProfile,
  trackEvent,
  onSaved,
  onClose,
}) => {
  const isMounted = useRef(true);
  const currentSearchRequestRef = useRef(0);
  const [loading, setLoading] = useState(false);
  const [loadErrorMessage, setLoadErrorMessage] = useState<string | null>(null);
  const [assignments, setAssignments] = useState<AssignmentRow[]>([]);
  const [isTruncated, setIsTruncated] = useState(false);

  const [removedAssignmentIds, setRemovedAssignmentIds] = useState<Set<string>>(() => new Set());
  const [addedUsers, setAddedUsers] = useState<Map<string, UserSearchRecord>>(() => new Map());

  const [assignmentFilter, setAssignmentFilter] = useState('');
  const [userSearchResults, setUserSearchResults] = useState<UserSearchRecord[]>([]);
  const [userSearchErrorMessage, setUserSearchErrorMessage] = useState<string | null>(null);

  const [saving, setSaving] = useState(false);
  const [saveErrorMessage, setSaveErrorMessage] = useState<string | null>(null);
  const [saveFailures, setSaveFailures] = useState<SaveFailure[]>([]);

  const isAssignable = !isOwnedByProfile && ID_ALLOWED.test(permissionSetId);

  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);

  const loadAssignments = useCallback(async () => {
    const soql = getPermissionSetAssignmentsQuery(permissionSetId);
    if (!soql) {
      setLoadErrorMessage('Invalid permission set id.');
      return;
    }
    try {
      setLoading(true);
      setLoadErrorMessage(null);
      const { queryResults } = await queryAll<PermissionSetAssignmentRecord>(org, soql);
      if (!isMounted.current) {
        return;
      }
      const records = queryResults.records;
      setIsTruncated(records.length > MAX_ASSIGNMENTS);
      setAssignments(
        records.slice(0, MAX_ASSIGNMENTS).map(({ Id, AssigneeId, Assignee }) => ({
          assignmentId: Id,
          userId: AssigneeId,
          name: Assignee?.Name || AssigneeId,
          username: Assignee?.Username || '',
          isActive: Assignee?.IsActive ?? true,
        })),
      );
    } catch (ex) {
      tracker.error('Error loading permission set assignments', ex, { permissionSetId });
      if (isMounted.current) {
        setLoadErrorMessage(getErrorMessage(ex));
      }
    } finally {
      if (isMounted.current) {
        setLoading(false);
      }
    }
  }, [org, permissionSetId]);

  useEffect(() => {
    if (isAssignable) {
      loadAssignments();
    }
  }, [isAssignable, loadAssignments]);

  /** Users who would be assigned if the current staged changes were saved — excluded from search results. */
  const effectivelyAssignedUserIds = useMemo(() => {
    const userIds = new Set(assignments.filter(({ assignmentId }) => !removedAssignmentIds.has(assignmentId)).map(({ userId }) => userId));
    addedUsers.forEach((_, userId) => userIds.add(userId));
    return userIds;
  }, [assignments, removedAssignmentIds, addedUsers]);

  const filteredAssignments = useMemo(() => {
    if (!assignmentFilter) {
      return assignments;
    }
    return assignments.filter(multiWordObjectFilter<AssignmentRow>(['name', 'username'], assignmentFilter));
  }, [assignments, assignmentFilter]);

  const userSearchItems = useMemo<ListItem[]>(
    () =>
      userSearchResults
        .filter(({ Id }) => !effectivelyAssignedUserIds.has(Id))
        .map((record) => ({
          id: record.Id,
          label: record.Name,
          value: record.Id,
          secondaryLabel: [record.Username, record.Profile?.Name].filter(Boolean).join(' • '),
          secondaryLabelOnNewLine: true,
          meta: record,
        })),
    [userSearchResults, effectivelyAssignedUserIds],
  );

  const handleUserSearch = useCallback(
    async (searchTerm: string) => {
      // The combobox debounces but does not serialize — a slow query for an earlier term can resolve after a
      // fast one for a later term, so only the most recently issued request is allowed to write results.
      const requestId = ++currentSearchRequestRef.current;
      try {
        setUserSearchErrorMessage(null);
        const { queryResults } = await queryAll<UserSearchRecord>(org, getUserSearchQuery(searchTerm));
        if (isMounted.current && currentSearchRequestRef.current === requestId) {
          setUserSearchResults(queryResults.records);
        }
      } catch {
        if (isMounted.current && currentSearchRequestRef.current === requestId) {
          setUserSearchResults([]);
          setUserSearchErrorMessage('There was an error searching for users.');
        }
      }
    },
    [org],
  );

  /**
   * Selecting a user who already has an assignment un-stages that removal instead of queuing an insert,
   * which makes a duplicate assignment impossible to create from this modal.
   */
  function handleSelectUser(item: ListItem | null) {
    const record = item?.meta as UserSearchRecord | undefined;
    if (!record) {
      return;
    }
    const existingAssignment = assignments.find(({ userId }) => userId === record.Id);
    if (existingAssignment) {
      setRemovedAssignmentIds((prior) => {
        const next = new Set(prior);
        next.delete(existingAssignment.assignmentId);
        return next;
      });
      return;
    }
    setAddedUsers((prior) => new Map(prior).set(record.Id, record));
  }

  function handleToggleRemoval(assignmentId: string, isRemoved: boolean) {
    setRemovedAssignmentIds((prior) => {
      const next = new Set(prior);
      if (isRemoved) {
        next.add(assignmentId);
      } else {
        next.delete(assignmentId);
      }
      return next;
    });
  }

  function handleRemoveStagedUser(userId: string) {
    setAddedUsers((prior) => {
      const next = new Map(prior);
      next.delete(userId);
      return next;
    });
  }

  async function handleSave() {
    const removedRows = assignments.filter(({ assignmentId }) => removedAssignmentIds.has(assignmentId));
    const usersToAdd = Array.from(addedUsers.values());

    if (org.userId && removedRows.some(({ userId }) => userId === org.userId)) {
      const confirmed = await ConfirmationModalPromise({
        header: 'Remove your own assignment?',
        content:
          'You are removing your own assignment to this permission set, which may remove your access to objects, fields, or features.',
        confirm: 'Remove anyway',
      });
      if (!confirmed) {
        return;
      }
    }

    try {
      setSaving(true);
      setSaveErrorMessage(null);
      setSaveFailures([]);
      const failures: SaveFailure[] = [];

      // Deletes run first so removing and re-adding the same user in one save can't collide on DUPLICATE_VALUE.
      if (removedRows.length) {
        const results = (
          await Promise.all(
            splitArrayToMaxSize(
              removedRows.map(({ assignmentId }) => assignmentId),
              MAX_RECORDS_PER_REQUEST,
            ).map((ids) => sobjectOperation(org, 'PermissionSetAssignment', 'delete', { ids }, { allOrNone: false })),
          )
        ).flat();
        results.forEach((result, index) => {
          if (!result.success) {
            failures.push({ label: removedRows[index]?.name || 'Unknown user', message: getRecordResultErrorMessage(result) });
          }
        });
      }

      if (usersToAdd.length) {
        const records = usersToAdd.map(({ Id }) => ({
          attributes: { type: 'PermissionSetAssignment' },
          PermissionSetId: permissionSetId,
          AssigneeId: Id,
        }));
        const results = (
          await Promise.all(
            splitArrayToMaxSize(records, MAX_RECORDS_PER_REQUEST).map((records) =>
              sobjectOperation(org, 'PermissionSetAssignment', 'create', { records }, { allOrNone: false }),
            ),
          )
        ).flat();
        results.forEach((result, index) => {
          if (!result.success) {
            failures.push({ label: usersToAdd[index]?.Name || 'Unknown user', message: getRecordResultErrorMessage(result) });
          }
        });
      }

      if (!isMounted.current) {
        return;
      }

      // Assignments changed even on a partial failure, so anything showing them is now stale either way.
      onSaved();

      if (failures.length) {
        setSaveFailures(failures);
        // Reload rather than reconcile — the server is the only reliable source of what actually applied.
        setRemovedAssignmentIds(new Set());
        setAddedUsers(new Map());
        await loadAssignments();
        return;
      }

      trackEvent?.(ANALYTICS_KEYS.permission_manager_assignments_saved, {
        added: usersToAdd.length,
        removed: removedRows.length,
      });
      fireToast({ type: 'success', message: 'Permission set assignments were saved.' });
      onClose();
    } catch (ex) {
      tracker.error('Error saving permission set assignments', ex, { permissionSetId });
      if (isMounted.current) {
        setSaveErrorMessage(getErrorMessage(ex));
      }
    } finally {
      if (isMounted.current) {
        setSaving(false);
      }
    }
  }

  const addedCount = addedUsers.size;
  const removedCount = removedAssignmentIds.size;
  const hasChanges = addedCount > 0 || removedCount > 0;

  return (
    <Modal
      testId="manage-permission-set-assignments-modal"
      size="lg"
      header="Manage Assignments"
      tagline={permissionSetName ? `${permissionSetLabel} (${permissionSetName})` : permissionSetLabel}
      closeDisabled={saving}
      closeOnEsc={!saving}
      closeOnBackdropClick={!saving}
      footer={
        <Grid align="spread" verticalAlign="center">
          <div className="slds-text-body_small slds-text-color_weak">
            {hasChanges
              ? `${addedCount} to add · ${removedCount} to remove`
              : 'Select users to add, or check assigned users to remove them.'}
          </div>
          <div>
            <button className="slds-button slds-button_neutral" onClick={onClose} disabled={saving}>
              Cancel
            </button>
            <button
              className="slds-button slds-button_brand slds-is-relative"
              {...ariaDisabledButtonProps(!hasChanges || saving, handleSave)}
            >
              Save Changes
              {saving && <Spinner className="slds-spinner slds-spinner_small" />}
            </button>
          </div>
        </Grid>
      }
      onClose={onClose}
    >
      {!isAssignable ? (
        <ScopedNotification theme="warning">
          {isOwnedByProfile
            ? 'This permission set is owned by a profile. Users receive it by having the profile assigned to them, so it cannot be assigned directly.'
            : 'Invalid permission set id.'}
        </ScopedNotification>
      ) : (
        <Fragment>
          {loadErrorMessage && (
            <ScopedNotification theme="error" className="slds-m-bottom_x-small">
              <Grid align="spread" verticalAlign="center">
                <span>There was an error loading assignments. {loadErrorMessage}</span>
                <button className="slds-button slds-button_neutral" {...ariaDisabledButtonProps(loading, () => loadAssignments())}>
                  Try Again
                </button>
              </Grid>
            </ScopedNotification>
          )}
          {saveErrorMessage && (
            <ScopedNotification theme="error" className="slds-m-bottom_x-small">
              There was an error saving assignments. {saveErrorMessage}
            </ScopedNotification>
          )}
          {saveFailures.length > 0 && (
            <ScopedNotification theme="error" className="slds-m-bottom_x-small">
              <p className="slds-m-bottom_xx-small">
                {saveFailures.length} {pluralizeFromNumber('change', saveFailures.length)} could not be saved. The list below has been
                reloaded from Salesforce.
              </p>
              <ul className="slds-list_dotted">
                {saveFailures.slice(0, MAX_VISIBLE_FAILURES).map(({ label, message }, index) => (
                  <li key={`${label}-${index}`}>
                    <strong>{label}</strong>: {message}
                  </li>
                ))}
              </ul>
              {saveFailures.length > MAX_VISIBLE_FAILURES && (
                <p className="slds-m-top_xx-small">and {saveFailures.length - MAX_VISIBLE_FAILURES} more.</p>
              )}
            </ScopedNotification>
          )}
          {isTruncated && (
            <ScopedNotification theme="info" className="slds-m-bottom_x-small">
              Showing the first {MAX_ASSIGNMENTS.toLocaleString()} assignments. Use the filter to narrow the list, or manage this permission
              set in Salesforce to see all of them. You can still add users.
            </ScopedNotification>
          )}

          <div className="slds-grid slds-gutters slds-wrap">
            <div className="slds-col slds-size_1-of-1 slds-medium-size_1-of-2">
              <h3 className="slds-text-heading_small slds-m-bottom_xx-small">Assigned Users ({assignments.length.toLocaleString()})</h3>
              <SearchInput
                id="assignment-filter"
                placeholder="Filter assigned users"
                value={assignmentFilter}
                onChange={setAssignmentFilter}
              />
              <div
                className="slds-is-relative slds-m-top_x-small slds-scrollable_y slds-p-right_x-small"
                css={css`
                  height: 45vh;
                  min-height: 250px;
                `}
              >
                {loading && <Spinner size="small" />}
                {!loading && assignments.length === 0 && !loadErrorMessage && (
                  <p className="slds-text-body_small slds-text-color_weak">No users are assigned to this permission set.</p>
                )}
                {!loading && assignments.length > 0 && filteredAssignments.length === 0 && (
                  <p className="slds-text-body_small slds-text-color_weak">No assigned users match this filter.</p>
                )}
                <ul>
                  {filteredAssignments.map(({ assignmentId, userId, name, username, isActive }) => {
                    const isRemoved = removedAssignmentIds.has(assignmentId);
                    return (
                      <li
                        key={assignmentId}
                        className={classNames('slds-p-vertical_xx-small slds-p-horizontal_xx-small', {
                          'active-item-yellow-bg': isRemoved,
                        })}
                      >
                        <Checkbox
                          id={`remove-assignment-${assignmentId}`}
                          checked={isRemoved}
                          disabled={saving}
                          label={
                            <UserRowLabel
                              name={name}
                              username={username}
                              strikeThrough={isRemoved}
                              badges={
                                <Fragment>
                                  {!isActive && <span className="slds-badge slds-m-left_xx-small">Inactive</span>}
                                  {org.userId === userId && <span className="slds-badge slds-m-left_xx-small">You</span>}
                                </Fragment>
                              }
                            />
                          }
                          onChange={(value) => handleToggleRemoval(assignmentId, value)}
                        />
                      </li>
                    );
                  })}
                </ul>
              </div>
            </div>

            <div className="slds-col slds-size_1-of-1 slds-medium-size_1-of-2">
              <h3 className="slds-text-heading_small slds-m-bottom_xx-small">Add Users</h3>
              <ComboboxWithItemsTypeAhead
                comboboxProps={{
                  label: 'Search for users',
                  hideLabel: true,
                  placeholder: 'Search by name, username, or email',
                  noItemsPlaceholder: 'No unassigned users match this search',
                  disabled: saving || loading,
                }}
                items={userSearchItems}
                selectedItemId={null}
                onSearch={handleUserSearch}
                onSelected={handleSelectUser}
              />
              {userSearchErrorMessage && (
                <ScopedNotification theme="error" className="slds-m-top_x-small">
                  {userSearchErrorMessage}
                </ScopedNotification>
              )}
              <div
                className="slds-m-top_x-small slds-scrollable_y"
                css={css`
                  height: 45vh;
                  min-height: 250px;
                `}
              >
                {addedCount === 0 ? (
                  <p className="slds-text-body_small slds-text-color_weak">
                    Users you select will appear here and are assigned when you save.
                  </p>
                ) : (
                  <ul>
                    {Array.from(addedUsers.values()).map(({ Id, Name, Username }) => (
                      <li key={Id} className="active-item-yellow-bg slds-p-vertical_xx-small slds-p-horizontal_xx-small">
                        <Grid align="spread" verticalAlign="center">
                          <UserRowLabel name={Name} username={Username} />
                          <button
                            className="slds-button slds-button_icon slds-button_icon-container slds-shrink-none"
                            disabled={saving}
                            onClick={() => handleRemoveStagedUser(Id)}
                            title={`Don't assign ${Name}`}
                          >
                            <Icon
                              type="utility"
                              icon="close"
                              description={`Don't assign ${Name}`}
                              className="slds-button__icon"
                              omitContainer
                            />
                          </button>
                        </Grid>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </div>
        </Fragment>
      )}
    </Modal>
  );
};

export default ManagePermissionSetAssignmentsModal;
