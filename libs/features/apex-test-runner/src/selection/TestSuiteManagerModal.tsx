import { css } from '@emotion/react';
import { ANALYTICS_KEYS } from '@jetstream/shared/constants';
import { usePrimaryActionShortcut } from '@jetstream/shared/ui-utils';
import { getErrorMessage, multiWordObjectFilter } from '@jetstream/shared/utils';
import {
  ariaDisabledButtonProps,
  Checkbox,
  ConfirmationModalPromise,
  getAriaKeyshortcuts,
  getModifierKey,
  Grid,
  Icon,
  Input,
  KeyboardShortcut,
  List,
  Modal,
  ScopedNotification,
  SearchInput,
  Spinner,
  Tooltip,
} from '@jetstream/ui';
import { useAmplitude } from '@jetstream/ui-core';
import { FunctionComponent, useEffect, useMemo, useRef, useState } from 'react';
import { validateTestSuiteName } from '../apex-test-runner-data.utils';
import type { TestClassListItem } from '../apex-test-runner-types';
import type { useApexTestSuites } from '../useApexTestSuites';
import { useRovingCheckboxList } from './useRovingCheckboxList';

export interface TestSuiteManagerModalProps {
  suitesState: ReturnType<typeof useApexTestSuites>;
  testClasses: TestClassListItem[];
  onClose: () => void;
}

export const TestSuiteManagerModal: FunctionComponent<TestSuiteManagerModalProps> = ({ suitesState, testClasses, onClose }) => {
  const { trackEvent } = useAmplitude();
  const { suites, membershipsBySuiteId, loading, errorMessage, createSuite, renameSuite, removeSuite, saveSuiteMembership } = suitesState;
  const [selectedSuiteId, setSelectedSuiteId] = useState<string | null>(null);
  const [newSuiteName, setNewSuiteName] = useState('');
  const [renameValue, setRenameValue] = useState('');
  const [memberClassIds, setMemberClassIds] = useState<Set<string>>(() => new Set());
  const [searchTerm, setSearchTerm] = useState('');
  const [saving, setSaving] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [newSuiteNameFocused, setNewSuiteNameFocused] = useState(false);

  const selectedSuite = suites.find(({ Id }) => Id === selectedSuiteId) ?? null;

  const existingSuiteNames = useMemo(() => suites.map(({ TestSuiteName }) => TestSuiteName), [suites]);
  const newSuiteNameError = newSuiteName ? validateTestSuiteName(newSuiteName, existingSuiteNames) : null;
  const renameError =
    renameValue && renameValue !== selectedSuite?.TestSuiteName
      ? validateTestSuiteName(
          renameValue,
          existingSuiteNames.filter((name) => name !== selectedSuite?.TestSuiteName),
        )
      : null;

  // Auto-select the first suite so the editor is immediately useful
  useEffect(() => {
    if (!selectedSuiteId && suites.length > 0) {
      setSelectedSuiteId(suites[0].Id);
    }
  }, [selectedSuiteId, suites]);

  // Re-initialize the editor whenever a different suite is chosen. Membership checkboxes are only
  // initialized when the suite id changes so unrelated refreshes (e.g. a rename, or the reload after
  // a failed save) don't silently discard unsaved checkbox edits.
  const initializedMembershipSuiteId = useRef<string | null>(null);
  useEffect(() => {
    if (selectedSuite) {
      setRenameValue(selectedSuite.TestSuiteName);
      if (initializedMembershipSuiteId.current !== selectedSuite.Id) {
        initializedMembershipSuiteId.current = selectedSuite.Id;
        setMemberClassIds(new Set((membershipsBySuiteId.get(selectedSuite.Id) ?? []).map(({ ApexClassId }) => ApexClassId)));
      }
    } else {
      initializedMembershipSuiteId.current = null;
      setRenameValue('');
      setMemberClassIds(new Set());
    }
  }, [selectedSuite, membershipsBySuiteId]);

  const filteredClasses = useMemo(
    () => (searchTerm ? testClasses.filter(multiWordObjectFilter(['name'], searchTerm)) : testClasses),
    [testClasses, searchTerm],
  );

  const visibleSelectedCount = filteredClasses.filter(({ classId }) => memberClassIds.has(classId)).length;
  const allVisibleSelected = filteredClasses.length > 0 && visibleSelectedCount === filteredClasses.length;
  const someVisibleSelected = visibleSelectedCount > 0 && !allVisibleSelected;

  // The membership list is one tab stop — ArrowUp/Down (and Home/End) move between the checkboxes
  const memberClassList = useRovingCheckboxList({
    ids: useMemo(() => filteredClasses.map(({ classId }) => classId), [filteredClasses]),
  });

  // Cmd/Ctrl+Enter saves the suite membership — the page-level run shortcut is suspended while
  // this modal is open, so the two cannot both fire. It is also held off while the New Suite Name
  // input has focus (the keystroke there reads as "create", not "save the other suite's classes")
  // and while the delete confirmation is open above this modal.
  usePrimaryActionShortcut(() => handleSaveMembership(), {
    disabled: saving || !selectedSuite || confirmingDelete || newSuiteNameFocused,
  });

  async function handleCreateSuite() {
    if (!newSuiteName.trim() || newSuiteNameError) {
      return;
    }
    try {
      setSaving(true);
      setActionError(null);
      const suiteId = await createSuite(newSuiteName.trim());
      trackEvent(ANALYTICS_KEYS.apex_tests_suite_created);
      setNewSuiteName('');
      setSelectedSuiteId(suiteId);
    } catch (ex) {
      setActionError(getErrorMessage(ex));
    } finally {
      setSaving(false);
    }
  }

  async function handleRename() {
    if (!selectedSuite || !renameValue.trim() || renameValue.trim() === selectedSuite.TestSuiteName || renameError) {
      return;
    }
    try {
      setSaving(true);
      setActionError(null);
      await renameSuite(selectedSuite.Id, renameValue.trim());
      trackEvent(ANALYTICS_KEYS.apex_tests_suite_updated, { action: 'rename' });
    } catch (ex) {
      setActionError(getErrorMessage(ex));
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!selectedSuite) {
      return;
    }
    setConfirmingDelete(true);
    const confirmed = await ConfirmationModalPromise({
      content: `Are you sure you want to delete the suite "${selectedSuite.TestSuiteName}"?`,
      confirm: 'Delete Suite',
    });
    setConfirmingDelete(false);
    if (confirmed) {
      try {
        setSaving(true);
        setActionError(null);
        await removeSuite(selectedSuite.Id);
        trackEvent(ANALYTICS_KEYS.apex_tests_suite_deleted);
        setSelectedSuiteId(null);
      } catch (ex) {
        setActionError(getErrorMessage(ex));
      } finally {
        setSaving(false);
      }
    }
  }

  async function handleSaveMembership() {
    if (!selectedSuite) {
      return;
    }
    try {
      setSaving(true);
      setActionError(null);
      await saveSuiteMembership(selectedSuite.Id, memberClassIds);
      trackEvent(ANALYTICS_KEYS.apex_tests_suite_updated, { action: 'membership', classCount: memberClassIds.size });
    } catch (ex) {
      setActionError(getErrorMessage(ex));
    } finally {
      setSaving(false);
    }
  }

  function handleToggleMemberClass(classId: string) {
    setMemberClassIds((prior) => {
      const updated = new Set(prior);
      updated.has(classId) ? updated.delete(classId) : updated.add(classId);
      return updated;
    });
  }

  function handleSelectAllVisible() {
    setMemberClassIds((prior) => {
      const updated = new Set(prior);
      for (const { classId } of filteredClasses) {
        allVisibleSelected ? updated.delete(classId) : updated.add(classId);
      }
      return updated;
    });
  }

  return (
    <Modal
      size="lg"
      header="Manage Test Suites"
      onClose={onClose}
      footer={
        <button className="slds-button slds-button_neutral" onClick={onClose}>
          Close
        </button>
      }
    >
      <div
        className="slds-is-relative slds-p-around_small"
        css={css`
          min-height: 400px;
        `}
      >
        {(loading || saving) && <Spinner size="small" />}
        {errorMessage && (
          <ScopedNotification theme="error" className="slds-m-bottom_x-small">
            {errorMessage}
          </ScopedNotification>
        )}
        {actionError && (
          <ScopedNotification theme="error" className="slds-m-bottom_x-small">
            {actionError}
          </ScopedNotification>
        )}
        <Grid gutters>
          <div className="slds-col slds-size_1-of-3">
            <Grid verticalAlign="end">
              <Input
                label="New Suite Name"
                className="slds-grow"
                hasError={!!newSuiteNameError}
                errorMessage={newSuiteNameError}
                errorMessageId="new-suite-name-error"
                labelHelp="Can only contain letters, numbers, and underscores. Must begin with a letter, cannot end with an underscore, and cannot contain two consecutive underscores."
              >
                <input
                  id="new-suite-name"
                  className="slds-input"
                  value={newSuiteName}
                  maxLength={255}
                  onChange={(event) => setNewSuiteName(event.target.value)}
                  onFocus={() => setNewSuiteNameFocused(true)}
                  onBlur={() => setNewSuiteNameFocused(false)}
                />
              </Input>
              <button
                className="slds-button slds-button_neutral slds-m-left_x-small"
                disabled={!newSuiteName.trim() || !!newSuiteNameError || saving}
                onClick={handleCreateSuite}
              >
                Create
              </button>
            </Grid>
            <div className="slds-m-top_small">
              <List
                ariaLabel="Test suites"
                items={suites}
                isActive={(suite) => suite.Id === selectedSuiteId}
                onSelected={setSelectedSuiteId}
                getContent={(suite) => ({
                  key: suite.Id,
                  testId: suite.TestSuiteName,
                  heading: suite.TestSuiteName,
                  subheading: `${(membershipsBySuiteId.get(suite.Id) ?? []).length} ${
                    (membershipsBySuiteId.get(suite.Id) ?? []).length === 1 ? 'class' : 'classes'
                  }`,
                })}
              />
            </div>
            {!suites.length && !loading && <p className="slds-m-top_small">No test suites exist in this org yet.</p>}
          </div>
          <div className="slds-col slds-size_2-of-3">
            {!selectedSuite && <p className="slds-m-top_large slds-text-align_center">Select a suite to edit it, or create a new one.</p>}
            {selectedSuite && (
              <div>
                <Grid verticalAlign="end" className="slds-m-bottom_small">
                  <Input
                    label="Suite Name"
                    className="slds-grow"
                    hasError={!!renameError}
                    errorMessage={renameError}
                    errorMessageId="rename-suite-error"
                  >
                    <input
                      id="rename-suite"
                      className="slds-input"
                      value={renameValue}
                      maxLength={255}
                      onChange={(event) => setRenameValue(event.target.value)}
                    />
                  </Input>
                  <button
                    className="slds-button slds-button_neutral slds-m-left_x-small"
                    disabled={saving || !renameValue.trim() || renameValue.trim() === selectedSuite.TestSuiteName || !!renameError}
                    onClick={handleRename}
                  >
                    Rename
                  </button>
                  <button className="slds-button slds-button_text-destructive" disabled={saving} onClick={handleDelete}>
                    <Icon type="utility" icon="delete" className="slds-button__icon slds-button__icon_left" omitContainer />
                    Delete
                  </button>
                </Grid>
                <Grid verticalAlign="center" className="slds-m-bottom_x-small">
                  <SearchInput id="suite-class-search" placeholder="Filter test classes" onChange={setSearchTerm} />
                  <span className="slds-m-left_small">{memberClassIds.size} selected</span>
                  <div className="slds-col_bump-left">
                    <Tooltip
                      openDelay={500}
                      content={
                        <div className="slds-p-bottom_small">
                          <KeyboardShortcut inverse keys={[getModifierKey(), 'enter']} />
                        </div>
                      }
                    >
                      {/* Stays focusable while disabled so the shortcut tooltip stays reachable and
                          focus survives the save */}
                      <button
                        type="button"
                        className="slds-button slds-button_brand"
                        aria-keyshortcuts={getAriaKeyshortcuts([getModifierKey(), 'enter'])}
                        {...ariaDisabledButtonProps(saving, () => handleSaveMembership())}
                      >
                        Save Suite Classes
                      </button>
                    </Tooltip>
                  </div>
                </Grid>
                <div className="slds-p-bottom_xx-small slds-m-bottom_xx-small slds-border_bottom">
                  <Checkbox
                    id="suite-class-select-all"
                    checked={allVisibleSelected}
                    indeterminate={someVisibleSelected}
                    disabled={filteredClasses.length === 0}
                    label="Select All"
                    onChange={handleSelectAllVisible}
                  />
                </div>
                <div
                  css={css`
                    max-height: 45vh;
                    overflow-y: auto;
                    /* The scroll container clipped the checkbox focus rings at its left and top
                       edges — pad the rings back into view; the negative margin keeps the rows
                       aligned with the Select All checkbox above */
                    padding: 0.25rem 0 0 0.25rem;
                    margin-left: -0.25rem;
                  `}
                >
                  {/* Composite-widget pattern: the ul delegates keyboard handling for its checkboxes */}
                  {/* eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions */}
                  <ul {...memberClassList.containerProps}>
                    {filteredClasses.map((item) => (
                      <li key={item.classId}>
                        <Checkbox
                          id={`suite-class-${item.classId}`}
                          checked={memberClassIds.has(item.classId)}
                          label={item.name}
                          onChange={() => handleToggleMemberClass(item.classId)}
                          {...memberClassList.getItemProps(item.classId)}
                        />
                      </li>
                    ))}
                  </ul>
                  {!filteredClasses.length && <p className="slds-m-vertical_medium slds-text-align_center">No test classes found</p>}
                </div>
              </div>
            )}
          </div>
        </Grid>
      </div>
    </Modal>
  );
};

export default TestSuiteManagerModal;
