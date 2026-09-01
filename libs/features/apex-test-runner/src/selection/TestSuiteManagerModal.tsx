import { css } from '@emotion/react';
import { ANALYTICS_KEYS } from '@jetstream/shared/constants';
import { getErrorMessage, multiWordObjectFilter } from '@jetstream/shared/utils';
import {
  Checkbox,
  ConfirmationModalPromise,
  Grid,
  Icon,
  Input,
  List,
  Modal,
  ScopedNotification,
  SearchInput,
  Spinner,
} from '@jetstream/ui';
import { useAmplitude } from '@jetstream/ui-core';
import { FunctionComponent, useEffect, useMemo, useRef, useState } from 'react';
import { validateTestSuiteName } from '../apex-test-runner-data.utils';
import type { TestClassListItem } from '../apex-test-runner-types';
import type { useApexTestSuites } from '../useApexTestSuites';

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
    if (
      await ConfirmationModalPromise({
        content: `Are you sure you want to delete the suite "${selectedSuite.TestSuiteName}"?`,
        confirm: 'Delete Suite',
      })
    ) {
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
                    <button className="slds-button slds-button_brand" disabled={saving} onClick={handleSaveMembership}>
                      Save Suite Classes
                    </button>
                  </div>
                </Grid>
                <Checkbox
                  id="suite-class-select-all"
                  checked={allVisibleSelected}
                  indeterminate={someVisibleSelected}
                  disabled={filteredClasses.length === 0}
                  label="Select All"
                  onChange={handleSelectAllVisible}
                />
                <div
                  css={css`
                    max-height: 45vh;
                    overflow-y: auto;
                  `}
                >
                  <ul>
                    {filteredClasses.map((item) => (
                      <li key={item.classId}>
                        <Checkbox
                          id={`suite-class-${item.classId}`}
                          checked={memberClassIds.has(item.classId)}
                          label={item.name}
                          onChange={() => handleToggleMemberClass(item.classId)}
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
