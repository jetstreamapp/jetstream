import { css } from '@emotion/react';
import { ANALYTICS_KEYS } from '@jetstream/shared/constants';
import { getErrorMessage, multiWordObjectFilter } from '@jetstream/shared/utils';
import { Checkbox, ConfirmationModalPromise, Grid, Icon, Input, Modal, ScopedNotification, SearchInput, Spinner } from '@jetstream/ui';
import { useAmplitude } from '@jetstream/ui-core';
import { FunctionComponent, useEffect, useMemo, useState } from 'react';
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

  // Re-initialize the editor whenever a different suite is chosen or fresh data arrives
  useEffect(() => {
    if (selectedSuite) {
      setRenameValue(selectedSuite.TestSuiteName);
      setMemberClassIds(new Set((membershipsBySuiteId.get(selectedSuite.Id) ?? []).map(({ ApexClassId }) => ApexClassId)));
    } else {
      setRenameValue('');
      setMemberClassIds(new Set());
    }
  }, [selectedSuite, membershipsBySuiteId]);

  const filteredClasses = useMemo(
    () => (searchTerm ? testClasses.filter(multiWordObjectFilter(['name'], searchTerm)) : testClasses),
    [testClasses, searchTerm],
  );

  async function handleCreateSuite() {
    if (!newSuiteName.trim()) {
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
    if (!selectedSuite || !renameValue.trim() || renameValue.trim() === selectedSuite.TestSuiteName) {
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
              <Input label="New Suite Name" className="slds-grow">
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
                disabled={!newSuiteName.trim() || saving}
                onClick={handleCreateSuite}
              >
                Create
              </button>
            </Grid>
            <ul className="slds-has-dividers_bottom-space slds-m-top_small">
              {suites.map((suite) => (
                <li
                  key={suite.Id}
                  className={`slds-item ${suite.Id === selectedSuiteId ? 'slds-is-selected' : ''}`}
                  css={css`
                    cursor: pointer;
                  `}
                >
                  <button
                    className={`slds-button ${suite.Id === selectedSuiteId ? 'slds-text-heading_small' : ''}`}
                    onClick={() => setSelectedSuiteId(suite.Id)}
                  >
                    {suite.TestSuiteName}
                    <span className="slds-m-left_x-small slds-text-body_small slds-text-color_weak">
                      ({(membershipsBySuiteId.get(suite.Id) ?? []).length})
                    </span>
                  </button>
                </li>
              ))}
            </ul>
            {!suites.length && !loading && <p className="slds-m-top_small">No test suites exist in this org yet.</p>}
          </div>
          <div className="slds-col slds-size_2-of-3">
            {!selectedSuite && <p className="slds-m-top_large slds-text-align_center">Select a suite to edit it, or create a new one.</p>}
            {selectedSuite && (
              <div>
                <Grid verticalAlign="end" className="slds-m-bottom_small">
                  <Input label="Suite Name" className="slds-grow">
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
                    disabled={saving || !renameValue.trim() || renameValue.trim() === selectedSuite.TestSuiteName}
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
