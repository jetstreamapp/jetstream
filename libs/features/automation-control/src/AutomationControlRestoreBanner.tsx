import { formatNumber } from '@jetstream/shared/ui-utils';
import { pluralizeFromNumber } from '@jetstream/shared/utils';
import { ScopedNotification, Spinner, Tooltip } from '@jetstream/ui';
import { fromAutomationControlState } from '@jetstream/ui-core';
import { Fragment, FunctionComponent } from 'react';
import { formatHistoryDate, getRestoreActionLabel } from './automation-control-history-utils';
import { StagedHistoryRestore } from './automation-control-types';

const MAX_MISSING_ITEMS_SHOWN = 10;

export interface AutomationControlRestoreBannerProps {
  pendingRestore: fromAutomationControlState.AutomationControlPendingRestore | null;
  stagedRestore: StagedHistoryRestore | null;
  /** Why the member cannot deploy, when their access profile excludes it */
  deployDeniedReason?: string;
  onReviewChanges: () => void;
}

/** Explains a rollback/re-deploy from history while it loads, and what was staged once it has */
export const AutomationControlRestoreBanner: FunctionComponent<AutomationControlRestoreBannerProps> = ({
  pendingRestore,
  stagedRestore,
  deployDeniedReason,
  onReviewChanges,
}) => {
  if (pendingRestore) {
    return (
      <ScopedNotification
        key="pending"
        theme="light"
        className="slds-m-around_x-small"
        icon={<Spinner className="slds-spinner slds-spinner_brand slds-spinner_x-small slds-spinner_inline" hasContainer={false} />}
      >
        Loading the current state from Salesforce to {getRestoreActionLabel(pendingRestore.action)} the changes deployed{' '}
        {formatHistoryDate(pendingRestore.entry.createdAt)}...
      </ScopedNotification>
    );
  }

  if (!stagedRestore) {
    return null;
  }

  const { action, source, result } = stagedRestore;
  const { stagedCount, unchangedCount, missingItems } = result;
  const actionLabel = getRestoreActionLabel(action);

  return (
    // keyed apart from the loading banner so a dismissed result does not hide the next restore
    <ScopedNotification key="staged" theme="light" className="slds-m-around_x-small" allowClose>
      {stagedCount > 0 ? (
        <Fragment>
          <p>
            <strong>
              {formatNumber(stagedCount)} {pluralizeFromNumber('change', stagedCount)} staged
            </strong>{' '}
            to {actionLabel} the changes deployed {formatHistoryDate(source.createdAt)}. Pending changes are highlighted below
            {deployDeniedReason
              ? ', but your access profile does not allow deploying them.'
              : ', review them and deploy when you are ready.'}
          </p>
          {unchangedCount > 0 && (
            <p>
              {formatNumber(unchangedCount)} {pluralizeFromNumber('item', unchangedCount)} already{' '}
              {unchangedCount === 1 ? 'matches' : 'match'} and {unchangedCount === 1 ? 'was' : 'were'} skipped.
            </p>
          )}
        </Fragment>
      ) : (
        <p>
          <strong>Nothing to {actionLabel}.</strong>{' '}
          {unchangedCount > 0
            ? `Everything from the changes deployed ${formatHistoryDate(source.createdAt)} already matches Salesforce.`
            : `None of the items from the changes deployed ${formatHistoryDate(source.createdAt)} could be staged.`}
        </p>
      )}
      {missingItems.length > 0 && (
        <Fragment>
          <p className="slds-m-top_x-small">
            {formatNumber(missingItems.length)} {pluralizeFromNumber('item', missingItems.length)} could not be staged:
          </p>
          <ul className="slds-list_dotted">
            {missingItems.slice(0, MAX_MISSING_ITEMS_SHOWN).map(({ key, label, reason }) => (
              <li key={key}>
                <strong>{label}</strong> - {reason}
              </li>
            ))}
            {missingItems.length > MAX_MISSING_ITEMS_SHOWN && (
              <li>and {formatNumber(missingItems.length - MAX_MISSING_ITEMS_SHOWN)} more</li>
            )}
          </ul>
        </Fragment>
      )}
      {stagedCount > 0 && (
        <Tooltip content={deployDeniedReason}>
          <button className="slds-button slds-button_brand slds-m-top_x-small" disabled={!!deployDeniedReason} onClick={onReviewChanges}>
            Review Changes
          </button>
        </Tooltip>
      )}
    </ScopedNotification>
  );
};

export default AutomationControlRestoreBanner;
