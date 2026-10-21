import { ANALYTICS_KEYS } from '@jetstream/shared/constants';
import { AutomationControlHistoryEntry, AutomationControlRestoreAction, SalesforceOrgUi } from '@jetstream/types';
import { ConfirmationModalPromise, Icon } from '@jetstream/ui';
import { fromAutomationControlState, useAmplitude } from '@jetstream/ui-core';
import classNames from 'classnames';
import { useSetAtom } from 'jotai';
import { Fragment, FunctionComponent, useState } from 'react';
import { getRestoreSnapshot } from './automation-control-history-utils';
import AutomationControlHistoryModal from './AutomationControlHistoryModal';

export interface AutomationControlHistoryButtonProps {
  className?: string;
  selectedOrg: SalesforceOrgUi;
  /** Restoring replaces the editor contents, so undeployed changes are confirmed before they are discarded */
  hasUnsavedChanges?: boolean;
  /** Called once a restore is queued, e.g. to navigate to the editor */
  onRestore?: () => void;
}

export const AutomationControlHistoryButton: FunctionComponent<AutomationControlHistoryButtonProps> = ({
  className,
  selectedOrg,
  hasUnsavedChanges,
  onRestore,
}) => {
  const { trackEvent } = useAmplitude();
  const [isOpen, setIsOpen] = useState(false);
  const setSelectedSObjects = useSetAtom(fromAutomationControlState.selectedSObjectsState);
  const setSelectedAutomationTypes = useSetAtom(fromAutomationControlState.selectedAutomationTypes);
  const setPendingHistoryRestore = useSetAtom(fromAutomationControlState.pendingHistoryRestore);

  function handleOpen() {
    setIsOpen(true);
    trackEvent(ANALYTICS_KEYS.automation_history_opened);
  }

  async function handleRestore(entry: AutomationControlHistoryEntry, action: AutomationControlRestoreAction) {
    if (
      hasUnsavedChanges &&
      !(await ConfirmationModalPromise({
        header: 'Discard unsaved changes?',
        content: 'You have changes that have not been deployed. They will be discarded when the changes from history are loaded.',
        confirm: 'Discard and Continue',
      }))
    ) {
      return;
    }
    const snapshot = getRestoreSnapshot(entry, action);
    // The editor shows exactly the objects and types being restored. These are always new arrays, which
    // is also what makes an already-open editor refetch the current state before the restore is staged.
    setSelectedSObjects(Array.from(new Set(snapshot.map(({ sobject }) => sobject))).sort());
    setSelectedAutomationTypes(Array.from(new Set(snapshot.map(({ type }) => type))));
    setPendingHistoryRestore({ entry, action, requestedAt: Date.now() });
    setIsOpen(false);
    trackEvent(ANALYTICS_KEYS.automation_history_restore, { action, items: snapshot.length });
    onRestore?.();
  }

  return (
    <Fragment>
      <button className={classNames('slds-button slds-button_neutral', className)} title="View deployment history" onClick={handleOpen}>
        <Icon type="utility" icon="date_time" className="slds-button__icon slds-button__icon_left" omitContainer />
        <span>History</span>
      </button>
      {isOpen && <AutomationControlHistoryModal selectedOrg={selectedOrg} onRestore={handleRestore} onClose={() => setIsOpen(false)} />}
    </Fragment>
  );
};

export default AutomationControlHistoryButton;
