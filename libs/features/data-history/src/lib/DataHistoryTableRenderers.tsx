import { Badge, DataTableGenericContext, DropDown, Grid, Icon, RenderCellProps } from '@jetstream/ui';
import { useContext } from 'react';
import {
  DATA_HISTORY_STATUS_LABELS,
  formatDataHistoryCounts,
  getDataHistoryExportTargets,
  getDataHistoryStatusBadgeType,
} from './data-history-page.utils';
import { DataHistoryExportTarget } from './data-history-payload-views';
import type { DataHistoryTableContext, DataHistoryTableRowItem } from './DataHistoryTable';

function useTableContext(): DataHistoryTableContext {
  return useContext(DataTableGenericContext) as DataHistoryTableContext;
}

export function OrgCellRenderer({ row }: RenderCellProps<DataHistoryTableRowItem>) {
  return (
    <Grid vertical className="slds-line-height_reset" divProps={{ title: row.item.org }}>
      <div>{row.orgLabel}</div>
      <div className="slds-text-body_small slds-text-color_weak">{row.orgId}</div>
    </Grid>
  );
}

export function StatusCellRenderer({ row }: RenderCellProps<DataHistoryTableRowItem>) {
  return <Badge type={getDataHistoryStatusBadgeType(row.item.status)}>{DATA_HISTORY_STATUS_LABELS[row.item.status]}</Badge>;
}

export function RecordsCellRenderer({ row }: RenderCellProps<DataHistoryTableRowItem>) {
  return <span>{formatDataHistoryCounts(row.item)}</span>;
}

export function PinnedCellRenderer({ row }: RenderCellProps<DataHistoryTableRowItem>) {
  const { onTogglePin } = useTableContext();
  const { item } = row;
  return (
    // Toggle-button semantics: constant name + aria-pressed state, so the cell announces
    // "Pin entry, pressed" instead of an unlabeled icon flip
    <button
      className="slds-button slds-button_icon slds-button_icon-border"
      title={item.pinned ? 'Unpin (allow automatic cleanup)' : 'Pin (exclude from automatic cleanup)'}
      aria-label="Pin entry"
      aria-pressed={item.pinned}
      // Arrow navigation focuses this button directly (APG single-widget cell) so its toggle role,
      // pressed state, and Enter/Space affordance are all announced; tabIndex -1 keeps the grid a
      // single page tab stop
      data-grid-inner-focus
      tabIndex={-1}
      onClick={() => onTogglePin(item)}
    >
      <Icon type="utility" icon={item.pinned ? 'pinned' : 'pin'} className="slds-button__icon" omitContainer />
    </button>
  );
}

export function ActionsCellRenderer({ row }: RenderCellProps<DataHistoryTableRowItem>) {
  const { onView, onDownload, onDelete } = useTableContext();
  const { item } = row;
  const targets = getDataHistoryExportTargets(item);
  return (
    <Grid verticalAlign="center" noWrap>
      <button className="slds-button slds-button_neutral slds-m-right_x-small" onClick={() => onView(item)}>
        View
      </button>
      {targets.length > 0 && (
        <DropDown
          className="slds-m-right_x-small"
          buttonClassName="slds-button slds-button_icon slds-button_icon-border"
          position="right"
          usePortal
          leadingIcon={{ type: 'utility', icon: 'download' }}
          actionText="Download saved data"
          description="Download saved data"
          items={targets.map((target) => ({
            id: `${target.kind}:${target.viewId ?? ''}`,
            value: `Download ${target.label}`,
            metadata: target,
          }))}
          onSelected={(_, target) => onDownload(item, target as DataHistoryExportTarget)}
        />
      )}
      <button className="slds-button slds-button_icon slds-button_icon-border" title="Delete this entry" onClick={() => onDelete(item)}>
        <Icon type="utility" icon="delete" className="slds-button__icon" omitContainer description="Delete" />
      </button>
    </Grid>
  );
}
