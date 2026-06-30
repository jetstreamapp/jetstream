/* eslint-disable @typescript-eslint/no-explicit-any */
import { css } from '@emotion/react';
import { isValidSalesforceRecordId } from '@jetstream/shared/ui-utils';
import { getIdFromRecordUrl } from '@jetstream/shared/utils';
import { SalesforceOrgUi } from '@jetstream/types';
import lodashGet from 'lodash/get';
import isBoolean from 'lodash/isBoolean';
import isFunction from 'lodash/isFunction';
import isString from 'lodash/isString';
import { Fragment, memo, ReactNode, useContext, useRef, useState } from 'react';
import Checkbox from '../../../form/checkbox/Checkbox';
import Modal from '../../../modal/Modal';
import { Popover } from '../../../popover/Popover';
import CopyToClipboard from '../../../widgets/CopyToClipboard';
import Icon from '../../../widgets/Icon';
import RecordLookupPopover from '../../../widgets/RecordLookupPopover';
import Spinner from '../../../widgets/Spinner';
import Tooltip from '../../../widgets/Tooltip';
import { dataTableDateFormatter } from '../../data-table-formatters';
import { ACTION_COLUMN_KEY, DEFAULT_ROW_HEIGHT, SELECT_COLUMN_KEY } from '../grid-constants';
import { GridRecordActionContext, GridRuntimeContext } from '../grid-context';
import { getRowId, getSfdcRetUrl, selectRowRange } from '../grid-row-utils';
import { ColumnWithFilter, DataTableCellProps, DataTableGroupCellProps, RowWithKey } from '../grid-types';
import { getRowErrorMessages } from '../validate-cell-value';

/**
 * Cell renderers ported from the legacy DataTableRenderers to the new `DataTableCellProps` contract.
 * Salesforce org/serverUrl/onRecordAction come from GridRecordActionContext (kept separate from the
 * volatile GridGenericContext bag for render stability) instead of module globals.
 */

export function GenericRenderer(props: DataTableCellProps<RowWithKey>): ReactNode {
  const { column, row } = props;
  if (!row) {
    return <div />;
  }
  let value: any = row[column.key];
  if (value instanceof Date) {
    value = dataTableDateFormatter(value);
  } else if (isBoolean(value)) {
    return <BooleanRenderer {...props} />;
  } else if (value && typeof value === 'object') {
    return <ComplexDataRenderer {...props} />;
  }
  return <div className="slds-truncate">{value}</div>;
}

export function BooleanRenderer({ column, row }: DataTableCellProps<any>): ReactNode {
  const value = row[column.key];
  return (
    <Checkbox
      className="slds-align_absolute-center"
      id={`${column.key}-${getRowId(row)}`}
      checked={value}
      label="value"
      hideLabel
      readOnly
    />
  );
}

export function ValueOrLoadingRenderer<T extends { loading: boolean }>({ column, row }: DataTableCellProps<T>): ReactNode {
  if (!row) {
    return <div />;
  }
  const value = (row as Record<string, any>)[column.key];
  if (row.loading) {
    return <Spinner size="x-small" />;
  }
  return <div>{value}</div>;
}

export function ComplexDataRenderer({ column, row }: DataTableCellProps<RowWithKey>): ReactNode {
  const value = row[column.key];
  const [isActive, setIsActive] = useState(false);
  const [jsonValue] = useState(JSON.stringify(value || '', null, 2));

  return (
    <div>
      {isActive && (
        <Modal
          size="lg"
          header={typeof column.name === 'string' ? column.name : column.key}
          closeOnBackdropClick
          onClose={() => setIsActive(false)}
          footer={<CopyToClipboard type="button" className="slds-button_neutral" content={jsonValue} />}
        >
          <pre>
            <code>{jsonValue}</code>
          </pre>
        </Modal>
      )}
      <button className="slds-button" tabIndex={-1} onClick={() => setIsActive((prev) => !prev)}>
        <Icon type="utility" icon="search" className="slds-button__icon slds-button__icon_left" omitContainer />
        View Data
      </button>
    </div>
  );
}

export function IdLinkRenderer({ column, row }: DataTableCellProps<RowWithKey>): ReactNode {
  const { org, serverUrl, skipFrontdoorLogin, onRecordAction } = useContext(GridRecordActionContext);
  const recordId = row[column.key];
  const { skipFrontDoorAuth, url } = getSfdcRetUrl(row, recordId, skipFrontdoorLogin);
  return (
    <RecordLookupPopover
      org={org as SalesforceOrgUi}
      serverUrl={serverUrl as string}
      recordId={recordId}
      skipFrontDoorAuth={skipFrontDoorAuth}
      returnUrl={url}
      isTooling={false}
      removeFromTabOrder
      onRecordAction={onRecordAction}
    />
  );
}

export function NameLinkRenderer({ column, row }: DataTableCellProps<RowWithKey>): ReactNode {
  const { org, serverUrl, skipFrontdoorLogin, onRecordAction } = useContext(GridRecordActionContext);
  const nameValue = row[column.key];
  const parentPath = column.key.includes('.') ? column.key.split('.').slice(0, -1).join('.') : '';
  const relatedRecord = parentPath ? lodashGet(row._record, parentPath) : row._record;
  const relatedRecordUrl = relatedRecord?.attributes?.url;
  const recordId: string | undefined = relatedRecord?.Id || (relatedRecordUrl ? getIdFromRecordUrl(relatedRecordUrl) : undefined);

  if (nameValue == null || !recordId) {
    return <div className="slds-truncate">{nameValue}</div>;
  }
  const { skipFrontDoorAuth, url } = getSfdcRetUrl(relatedRecord, recordId, skipFrontdoorLogin);
  return (
    <RecordLookupPopover
      org={org as SalesforceOrgUi}
      serverUrl={serverUrl as string}
      recordId={recordId}
      skipFrontDoorAuth={skipFrontDoorAuth}
      returnUrl={url}
      isTooling={false}
      removeFromTabOrder
      onRecordAction={onRecordAction}
      displayValue={<span className="slds-truncate">{nameValue}</span>}
    />
  );
}

export function TextOrIdLinkRenderer(props: DataTableCellProps<RowWithKey>): ReactNode {
  const { column, row } = props;
  const { org } = useContext(GridRecordActionContext);
  if (!row) {
    return <div />;
  }
  const maybeSalesforceId = row[column.key];
  if (org && isString(maybeSalesforceId) && maybeSalesforceId.length === 18 && isValidSalesforceRecordId(maybeSalesforceId, false)) {
    return <IdLinkRenderer {...props} />;
  }
  return GenericRenderer(props);
}

export function ActionRenderer({ row }: DataTableCellProps<any>): ReactNode {
  if (!isFunction(row?._action)) {
    return null;
  }
  const isDeleted = !!row.IsDeleted;
  return (
    <Fragment>
      <ErrorMessageRenderer row={row} />
      <Tooltip ariaRole="label" content="View full record">
        <button className="slds-button slds-button_icon slds-m-right_xx-small" tabIndex={-1} onClick={() => row._action(row, 'view')}>
          <Icon type="utility" icon="preview" className="slds-button__icon" omitContainer title="View Record" />
        </button>
      </Tooltip>
      <Tooltip ariaRole="label" content="Edit">
        <button className="slds-button slds-button_icon slds-m-right_xx-small" tabIndex={-1} onClick={() => row._action(row, 'edit')}>
          <Icon type="utility" icon="edit" className="slds-button__icon" omitContainer title="Edit Record" />
        </button>
      </Tooltip>
      <Tooltip ariaRole="label" content="Clone">
        <button className="slds-button slds-button_icon slds-m-right_xx-small" tabIndex={-1} onClick={() => row._action(row, 'clone')}>
          <Icon type="utility" icon="copy" className="slds-button__icon" omitContainer title="Clone Record" />
        </button>
      </Tooltip>
      {isDeleted ? (
        <Tooltip ariaRole="label" content="Restore from Recycle Bin">
          <button className="slds-button slds-button_icon slds-m-right_xx-small" tabIndex={-1} onClick={() => row._action(row, 'undelete')}>
            <Icon type="utility" icon="undelete" className="slds-button__icon" omitContainer title="Restore from Recycle Bin" />
          </button>
        </Tooltip>
      ) : (
        <Tooltip ariaRole="label" content="Delete">
          <button className="slds-button slds-button_icon slds-m-right_xx-small" tabIndex={-1} onClick={() => row._action(row, 'delete')}>
            <Icon type="utility" icon="delete" className="slds-button__icon" omitContainer title="Delete Record" />
          </button>
        </Tooltip>
      )}
      <Tooltip ariaRole="label" content="Turn Into Apex">
        <button className="slds-button slds-button_icon" tabIndex={-1} onClick={() => row._action(row, 'apex')}>
          <Icon type="utility" icon="apex" className="slds-button__icon" omitContainer title="Turn Into Apex" />
        </button>
      </Tooltip>
    </Fragment>
  );
}

/**
 * Memoized `ActionRenderer` for use as a column `renderCell`. The action column renders ~5 tooltipped
 * buttons per row; `ActionRenderer` depends only on `row`, so memoizing on row identity keeps an
 * unrelated grid commit (which re-renders the cell) from reconciling hundreds of floating-ui tooltips.
 * Must be rendered as a fiber — `renderCell: (props) => <ActionRendererMemo {...props} />` — for the
 * memo boundary to take effect (a bare `renderCell: ActionRenderer` is invoked as a plain function).
 */
export const ActionRendererMemo = memo(ActionRenderer, (prev, next) => prev.row === next.row);

export function ErrorMessageRenderer({ row }: { row: any }): ReactNode {
  const messages = getRowErrorMessages(row);
  if (!messages.length) {
    return null;
  }
  return (
    <Popover
      containerClassName="slds-popover_error"
      inverseIcons
      header={
        <header className="slds-popover__header">
          <div className="slds-media slds-media_center slds-has-flexi-truncate">
            <div className="slds-media__figure">
              <Icon
                type="utility"
                icon="error"
                className="slds-icon slds-icon_x-small"
                containerClassname="slds-icon_container slds-icon-utility-error"
              />
            </div>
            <div className="slds-media__body">
              <h2 className="slds-truncate slds-text-heading_medium" title="Resolve error">
                {messages.length > 1 ? 'Save Errors' : 'Save Error'}
              </h2>
            </div>
          </div>
        </header>
      }
      content={
        <div
          css={css`
            max-height: 80vh;
            white-space: pre-line;
          `}
        >
          {messages.length === 1 ? (
            <p>{messages[0]}</p>
          ) : (
            <ul className="slds-list_dotted">
              {messages.map((message, index) => (
                <li key={index}>{message}</li>
              ))}
            </ul>
          )}
        </div>
      }
      buttonProps={{ className: 'slds-button slds-button_icon slds-button_icon-error', tabIndex: -1 }}
    >
      <Icon type="utility" icon="error" className="slds-button__icon" omitContainer />
    </Popover>
  );
}

/** Row shape read by the inline record-error column: a combined error/warning message plus its severity. */
export interface RowWithRecordError extends RowWithKey {
  status?: string;
  severity?: 'error' | 'warning' | 'none';
}

/** Column id for the standalone record-error column, shared by the column factory and the height lookup. */
const INLINE_ERROR_COLUMN_KEY = 'errorMessage';
/** Default width of the standalone record-error column; the fallback when a live width isn't available. */
export const RECORD_ERROR_COLUMN_WIDTH = 300;
// Horizontal cell padding (0.5rem each side ≈ 16px) removed before estimating how many chars fit per line.
const RECORD_ERROR_CELL_PADDING = 16;
// Approx character width at the grid's 13px font — intentionally generous so we round toward a taller row.
const RECORD_ERROR_CHAR_WIDTH = 7;
// `line-height: normal` at 13px, rounded up for breathing room.
const RECORD_ERROR_LINE_HEIGHT = 17;
// Cap so one huge message can't balloon the row; the full text stays available via the title tooltip.
const RECORD_ERROR_MAX_LINES = 6;

/**
 * Inline record-level error/warning message for a standalone "Error" column. Wraps onto multiple lines
 * (honoring embedded newlines) rather than truncating — pair it with `getRecordErrorRowHeight` as the
 * table's `rowHeight` so the row grows to fit. Renders nothing for rows without a message.
 */
export function RecordErrorMessageRenderer({ row }: DataTableCellProps<RowWithKey>): ReactNode {
  const { status, severity } = row as RowWithRecordError;
  if (!status) {
    return null;
  }
  return (
    <div
      className={severity === 'error' ? 'slds-text-color_error' : undefined}
      title={status}
      css={css`
        white-space: pre-wrap;
        overflow-wrap: anywhere;
        line-height: normal;
        overflow: hidden;
      `}
    >
      {status}
    </div>
  );
}

/**
 * Estimate the row height needed to show a row's full (wrapped) record-error message. Grid rows are
 * pinned to a fixed height (never DOM-measured), so approximate the wrapped line count from the message
 * length and the error column's current width, then clamp. Pass the grid's live `columnWidths` map so the
 * estimate tracks resizes; falls back to the default width when omitted. Returns `defaultRowHeight` for
 * rows without a message.
 */
export function getRecordErrorRowHeight(
  row: RowWithKey,
  columnWidths?: Record<string, number>,
  defaultRowHeight = DEFAULT_ROW_HEIGHT,
): number {
  const { status } = row as RowWithRecordError;
  if (!status) {
    return defaultRowHeight;
  }
  const columnWidth = columnWidths?.[INLINE_ERROR_COLUMN_KEY] ?? RECORD_ERROR_COLUMN_WIDTH;
  const charsPerLine = Math.max(1, Math.floor((columnWidth - RECORD_ERROR_CELL_PADDING) / RECORD_ERROR_CHAR_WIDTH));
  const lineCount = status.split('\n').reduce((total, segment) => total + Math.max(1, Math.ceil(segment.length / charsPerLine)), 0);
  return Math.max(defaultRowHeight, Math.min(lineCount, RECORD_ERROR_MAX_LINES) * RECORD_ERROR_LINE_HEIGHT);
}

/** Build the standalone, non-sortable/non-filterable "Error" column backed by {@link RecordErrorMessageRenderer}. */
export function getRecordErrorColumn(overrides?: Partial<ColumnWithFilter<RowWithKey>>): ColumnWithFilter<RowWithKey> {
  return {
    key: INLINE_ERROR_COLUMN_KEY,
    name: 'Error',
    width: RECORD_ERROR_COLUMN_WIDTH,
    resizable: true,
    sortable: false,
    filters: [],
    renderCell: RecordErrorMessageRenderer,
    ...overrides,
  };
}

/**
 * Wraps a column's base `renderCell` to overlay a tooltipped error/warning icon when the row carries a
 * `_fieldErrors`/`_fieldWarnings` entry for this column. The base content is always rendered first (so any
 * hooks inside it run in a stable order), then the icon is appended only when a message exists. The
 * Tooltip is portaled, so it escapes the cell's `overflow:hidden` and survives row virtualization.
 */
export function withCellValidation<TRow extends RowWithKey>(
  baseRender?: (props: DataTableCellProps<TRow>) => ReactNode,
): (props: DataTableCellProps<TRow>) => ReactNode {
  return function CellWithValidation(props: DataTableCellProps<TRow>): ReactNode {
    const { row, column } = props;
    const baseContent = baseRender ? baseRender(props) : <div className="slds-truncate">{(row as any)?.[column.key]}</div>;
    const error = (row as any)?._fieldErrors?.[column.key] as string | undefined;
    const warning = error ? undefined : ((row as any)?._fieldWarnings?.[column.key] as string | undefined);
    const message = error || warning;
    if (!message) {
      return baseContent;
    }
    return (
      <Fragment>
        <div
          css={css`
            flex: 1 1 auto;
            min-width: 0;
            overflow: hidden;
          `}
        >
          {baseContent}
        </div>
        <Tooltip ariaRole="label" content={message}>
          <Icon
            type="utility"
            icon={error ? 'error' : 'warning'}
            className={`slds-icon_xx-small slds-m-left_xx-small ${error ? 'slds-icon-text-error' : 'slds-icon-text-warning'}`}
            containerClassname="slds-icon_container"
          />
        </Tooltip>
      </Fragment>
    );
  };
}

/** Row-selection checkbox renderer. The built-in select column (GridCell cellKind) usually handles this;
 * kept for compatibility with the spreadable SelectColumn definition.
 *
 * Supports shift-click range selection: holding Shift and clicking sets every row between the anchor
 * (the last non-shift toggle) and this row to the anchor's selected value. The Shift state is captured
 * from the wrapper's `mousedown` rather than the change event, because the visible control is the SLDS
 * `<label>`/faux checkbox and label-forwarded clicks drop modifier keys. */
export function SelectFormatter({ row, tanstackRow }: DataTableCellProps<any>): ReactNode {
  const runtime = useContext(GridRuntimeContext);
  const shiftKeyRef = useRef(false);

  const handleChange = (event: React.SyntheticEvent<HTMLInputElement>) => {
    const checked = event.currentTarget.checked;
    // `detail > 0` is a real pointer click; keyboard Space yields a synthetic click with detail 0, where
    // the shift ref would be stale — so range-select only on genuine mouse interactions.
    const wasMouseClick = (event.nativeEvent as MouseEvent).detail > 0;
    const anchorRowId = runtime?.getRowSelectionAnchor?.();
    if (
      wasMouseClick &&
      shiftKeyRef.current &&
      anchorRowId &&
      anchorRowId !== tanstackRow.id &&
      runtime?.table &&
      selectRowRange(runtime.table, anchorRowId, tanstackRow.id)
    ) {
      // Range applied — keep the anchor fixed so the user can re-shift-click to adjust the range.
      return;
    }
    tanstackRow.toggleSelected(checked);
    runtime?.setRowSelectionAnchor?.(tanstackRow.id);
  };

  return (
    <span
      className="jgrid-cell-select slds-grid slds-grid_align-center slds-grid_vertical-align-center h-100 w-100"
      onMouseDown={(event) => (shiftKeyRef.current = event.shiftKey)}
    >
      <Checkbox
        id={`checkbox-select-${getRowId(row)}`}
        label="Select row"
        hideLabel
        tabIndex={-1}
        checked={tanstackRow.getIsSelected()}
        disabled={!tanstackRow.getCanSelect()}
        onChangeNative={handleChange}
      />
    </span>
  );
}

/** Group-row "select all" checkbox — selects/deselects every leaf row in the group. */
export function SelectHeaderGroupRenderer({ childRows, tanstackRow }: DataTableGroupCellProps<any>): ReactNode {
  const allSelected = tanstackRow.getIsAllSubRowsSelected();
  const someSelected = tanstackRow.getIsSomeSelected();
  return (
    <span className="jgrid-cell-select slds-grid slds-grid_align-center slds-grid_vertical-align-center h-100 w-100">
      <Checkbox
        id={`checkbox-select-all-${tanstackRow.id}`}
        label="Select all"
        hideLabel
        tabIndex={-1}
        checked={allSelected}
        indeterminate={!allSelected && someSelected}
        onChange={(checked) => tanstackRow.toggleSelected(checked)}
      />
    </span>
  );
}

/** Spreadable row-selection column definition (replaces react-data-grid's `SelectColumn`). */
export const SelectColumn: ColumnWithFilter<any> = {
  key: SELECT_COLUMN_KEY,
  name: '',
  width: 40,
  minWidth: 40,
  maxWidth: 40,
  resizable: false,
  sortable: false,
  frozen: true,
  renderCell: SelectFormatter,
  renderGroupCell: SelectHeaderGroupRenderer,
};

export { ACTION_COLUMN_KEY, SELECT_COLUMN_KEY };
