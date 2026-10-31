import { css } from '@emotion/react';
import { formatNumber } from '@jetstream/shared/ui-utils';
import { pluralizeFromNumber } from '@jetstream/shared/utils';
import { AutomationControlHistoryEntry, AutomationControlRestoreAction } from '@jetstream/types';
import type { Column } from '@jetstream/ui';
import { Badge, DataTable, DisabledReasonButton, Grid, Icon, Tooltip } from '@jetstream/ui';
import { FunctionComponent, MutableRefObject, useMemo } from 'react';
import { getAutomationTypeLabel } from './automation-control-data-utils';
import { formatHistoryDate, getHistoryActionLabel, getHistoryStatus } from './automation-control-history-utils';
import { AutomationPackageVariant } from './automation-control-package-utils';
import { HistoryActivationStateRenderer, HistoryItemStatusRenderer } from './automation-control-table-renderers';
import { HistoryItemRow } from './automation-control-types';
import { AutomationPackageDropDown } from './AutomationControlPackageDownload';

const COLUMNS: Column<HistoryItemRow>[] = [
  {
    name: 'Object',
    key: 'sobject',
    width: 130,
  },
  {
    name: 'Type',
    key: 'typeLabel',
    width: 130,
  },
  {
    name: 'Name',
    key: 'label',
    width: 230,
  },
  {
    name: 'Before',
    key: 'previous',
    renderCell: HistoryActivationStateRenderer,
    width: 110,
    cellClass: 'bg-color-gray',
  },
  {
    name: 'After',
    key: 'deployed',
    renderCell: HistoryActivationStateRenderer,
    width: 110,
  },
  {
    name: 'Result',
    key: 'status',
    renderCell: HistoryItemStatusRenderer,
    width: 150,
  },
];

const getRowKey = ({ key }: HistoryItemRow) => key;

export interface AutomationControlHistoryEntryDetailProps {
  entry: AutomationControlHistoryEntry;
  isPreparingPackage: boolean;
  packageTriggerRef: MutableRefObject<HTMLButtonElement | null>;
  onRestore: (entry: AutomationControlHistoryEntry, action: AutomationControlRestoreAction) => void;
  onDownloadPackage: (entry: AutomationControlHistoryEntry, variant: AutomationPackageVariant) => void;
}

export const AutomationControlHistoryEntryDetail: FunctionComponent<AutomationControlHistoryEntryDetailProps> = ({
  entry,
  isPreparingPackage,
  packageTriggerRef,
  onRestore,
  onDownloadPackage,
}) => {
  const rows = useMemo<HistoryItemRow[]>(
    () => entry.items.map((item) => ({ ...item, typeLabel: getAutomationTypeLabel(item.type) })),
    [entry.items],
  );
  const status = getHistoryStatus(entry);
  const canRollBack = entry.successCount + entry.incompleteCount > 0;
  const outcomeSummary = [
    entry.errorCount > 0 && `${formatNumber(entry.errorCount)} failed`,
    entry.incompleteCount > 0 && `${formatNumber(entry.incompleteCount)} not confirmed`,
  ].filter(Boolean);

  return (
    <Grid vertical className="h-100">
      <Grid align="spread" verticalAlign="start" wrap gutters guttersSize="small" className="slds-p-bottom_small">
        <div className="slds-col">
          <Grid verticalAlign="center">
            <h2 className="slds-text-heading_small slds-m-right_x-small">{formatHistoryDate(entry.createdAt)}</h2>
            <Badge type={status.badgeType}>{status.label}</Badge>
          </Grid>
          <p className="slds-text-body_small slds-m-top_xx-small">
            {getHistoryActionLabel(entry.action)} {formatNumber(entry.items.length)} {pluralizeFromNumber('item', entry.items.length)}
            {outcomeSummary.length > 0 && ` (${outcomeSummary.join(', ')})`} on {entry.sobjects.join(', ')}
          </p>
          {entry.source && (
            <p className="slds-text-body_small slds-text-color_weak">
              {entry.action === 'rollback' ? 'Rollback' : 'Re-deploy'} of the changes deployed {formatHistoryDate(entry.source.createdAt)}
            </p>
          )}
        </div>
        <Grid className="slds-col slds-no-flex" verticalAlign="center">
          <AutomationPackageDropDown
            className="slds-m-right_x-small"
            isPreparing={isPreparingPackage}
            triggerRef={packageTriggerRef}
            onSelected={(variant) => onDownloadPackage(entry, variant)}
          />
          <DisabledReasonButton
            className="slds-button slds-button_brand"
            tooltip="Restore the active state from before these changes were deployed."
            disabled={!canRollBack}
            disabledReason="Nothing was deployed successfully, so there is nothing to roll back."
            onClick={() => onRestore(entry, 'rollback')}
          >
            <Icon type="utility" icon="undo" className="slds-button__icon slds-button__icon_left" omitContainer />
            Roll Back
          </DisabledReasonButton>
          <Tooltip content="Apply these changes again. Items that failed are retried.">
            <button className="slds-button slds-button_neutral slds-m-left_x-small" onClick={() => onRestore(entry, 'redeploy')}>
              <Icon type="utility" icon="upload" className="slds-button__icon slds-button__icon_left" omitContainer />
              Re-deploy
            </button>
          </Tooltip>
        </Grid>
      </Grid>
      <p className="slds-text-body_small slds-text-color_weak slds-p-bottom_x-small">
        Roll Back and Re-deploy load the current state from Salesforce and stage only the items that differ, so you can review every change
        before anything is deployed. Downloaded packages use the current metadata in Salesforce with the active state from before or after
        these changes, and can be deployed from Deploy Metadata.
      </p>
      <div
        className="slds-grow"
        css={css`
          min-height: 200px;
        `}
      >
        <DataTable columns={COLUMNS} data={rows} getRowKey={getRowKey} />
      </div>
    </Grid>
  );
};

export default AutomationControlHistoryEntryDetail;
