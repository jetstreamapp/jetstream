import { css } from '@emotion/react';
import { formatNumber } from '@jetstream/shared/ui-utils';
import { OrgAlignmentSavedComparison, SalesforceOrgUi } from '@jetstream/types';
import { Badge, EmptyState, Grid, Icon, Input, Modal, ScopedNotification, Textarea, UpgradeToProButton } from '@jetstream/ui';
import { OrgLabelBadge, ProBadge } from '@jetstream/ui-core';
import { formatDistanceToNow } from 'date-fns/formatDistanceToNow';
import { FunctionComponent, useState } from 'react';

export const FREE_ORG_ALIGNMENT_SAVED_LIMIT = 1;

export interface OrgAlignmentSavedComparisonsModalProps {
  mode: 'BROWSE' | 'SAVE';
  savedComparisons: OrgAlignmentSavedComparison[];
  orgsById: Record<string, SalesforceOrgUi>;
  hasProAccess: boolean;
  showUpgradeToPro: boolean;
  activeSavedKey: string | null;
  currentSourceOrg: SalesforceOrgUi | null;
  currentTargetOrg: SalesforceOrgUi | null;
  /** Why a saved comparison cannot be run right now, e.g. another comparison is in progress */
  rerunDisabledReason?: string | null;
  onSave: (payload: { key?: string; name: string; description?: string }) => Promise<void>;
  onLoad: (comparison: OrgAlignmentSavedComparison, autoRun: boolean) => void;
  onDelete: (key: string) => Promise<void>;
  onClose: () => void;
}

export const OrgAlignmentSavedComparisonsModal: FunctionComponent<OrgAlignmentSavedComparisonsModalProps> = ({
  mode,
  savedComparisons,
  orgsById,
  hasProAccess,
  showUpgradeToPro,
  activeSavedKey,
  currentSourceOrg,
  currentTargetOrg,
  rerunDisabledReason,
  onSave,
  onLoad,
  onDelete,
  onClose,
}) => {
  const activeSaved = savedComparisons.find(({ key }) => key === activeSavedKey);
  const defaultName =
    activeSaved?.name ||
    (currentSourceOrg && currentTargetOrg ? `${currentSourceOrg.label} vs ${currentTargetOrg.label}` : 'Org Comparison');

  const [name, setName] = useState(defaultName);
  const [description, setDescription] = useState(activeSaved?.description || '');
  const [saving, setSaving] = useState(false);

  const isUpdatingExisting = Boolean(activeSaved);
  const reachedFreeSaveLimit = !hasProAccess && !isUpdatingExisting && savedComparisons.length >= FREE_ORG_ALIGNMENT_SAVED_LIMIT;

  async function handleSaveSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!name.trim() || reachedFreeSaveLimit) {
      return;
    }
    setSaving(true);
    try {
      await onSave({
        key: isUpdatingExisting ? activeSaved?.key : undefined,
        name: name.trim(),
        description: description.trim() || undefined,
      });
      onClose();
    } finally {
      setSaving(false);
    }
  }

  if (mode === 'SAVE') {
    return (
      <Modal
        header={isUpdatingExisting ? 'Update Saved Comparison' : 'Save Comparison Definition'}
        tagline="Saved locally on this device so you can re-run the same org pair and metadata scope anytime."
        size="sm"
        footer={
          <Grid align="end">
            <button type="button" className="slds-button slds-button_neutral" onClick={onClose}>
              Cancel
            </button>
            <button
              type="submit"
              form="org-alignment-save-form"
              className="slds-button slds-button_brand"
              disabled={!name.trim() || saving || reachedFreeSaveLimit}
            >
              {isUpdatingExisting ? 'Update Comparison' : 'Save Comparison'}
            </button>
          </Grid>
        }
        onClose={onClose}
      >
        {reachedFreeSaveLimit && (
          <ScopedNotification theme="warning" className="slds-m-bottom_small">
            <div className="slds-m-bottom_x-small">
              Free accounts can save {FREE_ORG_ALIGNMENT_SAVED_LIMIT} Org Alignment definition. Upgrade to Jetstream Pro for unlimited saved
              comparisons.
            </div>
            {showUpgradeToPro && <UpgradeToProButton />}
          </ScopedNotification>
        )}
        <form id="org-alignment-save-form" onSubmit={handleSaveSubmit}>
          <Input id="org-alignment-save-name" label="Comparison Name" isRequired className="slds-m-bottom_small">
            <input
              id="org-alignment-save-name"
              type="text"
              className="slds-input"
              maxLength={120}
              value={name}
              disabled={reachedFreeSaveLimit}
              onChange={(event) => setName(event.target.value)}
              placeholder="e.g. UAT vs Production (Core Metadata)"
            />
          </Input>
          <Textarea id="org-alignment-save-description" label="Notes (optional)">
            <textarea
              id="org-alignment-save-description"
              className="slds-textarea"
              rows={3}
              maxLength={250}
              value={description}
              disabled={reachedFreeSaveLimit}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="e.g. Pre-release weekly drift check"
            />
          </Textarea>
        </form>
      </Modal>
    );
  }

  return (
    <Modal
      header={
        <Grid verticalAlign="center">
          <span>Saved Comparisons ({formatNumber(savedComparisons.length)})</span>
          {!hasProAccess && <ProBadge className="slds-m-left_x-small" />}
        </Grid>
      }
      tagline="Locally stored org alignment definitions. Load a definition or re-run it on demand."
      size="md"
      footer={
        <Grid align="end">
          <button type="button" className="slds-button slds-button_neutral" onClick={onClose}>
            Close
          </button>
        </Grid>
      }
      onClose={onClose}
    >
      {!hasProAccess && (
        <ScopedNotification theme="light" className="slds-m-bottom_small">
          <Grid align="spread" verticalAlign="center" wrap>
            <div className="slds-m-right_small">
              Free accounts include {FREE_ORG_ALIGNMENT_SAVED_LIMIT} saved comparison. Upgrade to Jetstream Pro for unlimited saved
              comparisons and drift reports.
            </div>
            {showUpgradeToPro && <UpgradeToProButton />}
          </Grid>
        </ScopedNotification>
      )}
      {savedComparisons.length === 0 ? (
        <EmptyState
          headline="No saved comparisons yet"
          subHeading="Configure two orgs and save the comparison to quickly re-run drift checks before releases."
        />
      ) : (
        <div
          className="slds-scrollable_y"
          css={css`
            max-height: 55vh;
          `}
        >
          <ul className="slds-has-dividers_bottom-space">
            {savedComparisons.map((comparison) => {
              const sourceOrg = orgsById[comparison.sourceOrgId];
              const targetOrg = orgsById[comparison.targetOrgId];
              const missingOrg = !sourceOrg || !targetOrg;
              const isActive = comparison.key === activeSavedKey;

              return (
                <li key={comparison.key} className="slds-item slds-p-vertical_small">
                  <Grid align="spread" verticalAlign="start" wrap>
                    <div className="slds-grow slds-m-right_small">
                      <Grid verticalAlign="center" className="slds-m-bottom_xx-small">
                        <strong className="slds-text-heading_small">{comparison.name}</strong>
                        {isActive && (
                          <Badge type="inverse" className="slds-m-left_x-small">
                            Loaded
                          </Badge>
                        )}
                      </Grid>
                      {comparison.description && (
                        <div className="slds-text-body_small slds-text-color_weak slds-m-bottom_xx-small">{comparison.description}</div>
                      )}
                      <div className="slds-grid slds-grid_vertical-align-center slds-wrap slds-m-bottom_xx-small">
                        {sourceOrg ? (
                          <OrgLabelBadge org={sourceOrg} />
                        ) : (
                          <Badge type="warning">{comparison.sourceOrgLabel} (disconnected)</Badge>
                        )}
                        <Icon
                          type="utility"
                          icon="switch"
                          className="slds-icon slds-icon-text-default slds-icon_xx-small slds-m-horizontal_xx-small"
                          omitContainer
                        />
                        {targetOrg ? (
                          <OrgLabelBadge org={targetOrg} />
                        ) : (
                          <Badge type="warning">{comparison.targetOrgLabel} (disconnected)</Badge>
                        )}
                      </div>
                      <div className="slds-text-body_small slds-text-color_weak">
                        Scope:{' '}
                        {comparison.selectionMode === 'common'
                          ? 'Common types'
                          : comparison.selectionMode === 'all'
                            ? 'All comparable types'
                            : `${formatNumber(comparison.selectedMetadataTypes.length)} custom types`}
                        {comparison.lastRunAt && (
                          <span>, last run {formatDistanceToNow(new Date(comparison.lastRunAt), { addSuffix: true })}</span>
                        )}
                      </div>
                      {comparison.lastRunSummary && (
                        <div className="slds-m-top_xx-small">
                          <Badge type="warning" className="slds-m-right_xx-small">
                            {formatNumber(comparison.lastRunSummary.different)} different
                          </Badge>
                          <Badge type="light" className="slds-m-right_xx-small">
                            {formatNumber(comparison.lastRunSummary.onlyInSource)} only in source
                          </Badge>
                          <Badge type="light" className="slds-m-right_xx-small">
                            {formatNumber(comparison.lastRunSummary.onlyInTarget)} only in target
                          </Badge>
                          <Badge type="success">{formatNumber(comparison.lastRunSummary.same)} same</Badge>
                        </div>
                      )}
                    </div>
                    <div className="slds-grid slds-grid_vertical-align-center">
                      <button
                        type="button"
                        className="slds-button slds-button_brand slds-m-right_xx-small"
                        disabled={missingOrg || Boolean(rerunDisabledReason)}
                        title={missingOrg ? 'Reconnect missing orgs before running' : rerunDisabledReason || 'Load and run comparison now'}
                        onClick={() => {
                          onLoad(comparison, true);
                          onClose();
                        }}
                      >
                        Re-run
                      </button>
                      <button
                        type="button"
                        className="slds-button slds-button_neutral slds-m-right_xx-small"
                        onClick={() => {
                          onLoad(comparison, false);
                          onClose();
                        }}
                      >
                        Load
                      </button>
                      <button
                        type="button"
                        className="slds-button slds-button_icon slds-button_icon-border-filled"
                        title="Delete saved comparison"
                        aria-label={`Delete ${comparison.name}`}
                        onClick={() => onDelete(comparison.key)}
                      >
                        <Icon type="utility" icon="delete" className="slds-button__icon" omitContainer />
                      </button>
                    </div>
                  </Grid>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </Modal>
  );
};

export default OrgAlignmentSavedComparisonsModal;
