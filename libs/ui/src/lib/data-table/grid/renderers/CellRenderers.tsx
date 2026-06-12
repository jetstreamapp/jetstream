/* eslint-disable @typescript-eslint/no-explicit-any */
import { css } from '@emotion/react';
import { isValidSalesforceRecordId } from '@jetstream/shared/ui-utils';
import { getIdFromRecordUrl } from '@jetstream/shared/utils';
import { CloneEditView, SalesforceOrgUi } from '@jetstream/types';
import lodashGet from 'lodash/get';
import isBoolean from 'lodash/isBoolean';
import isFunction from 'lodash/isFunction';
import isString from 'lodash/isString';
import { Fragment, ReactNode, useContext, useState } from 'react';
import Checkbox from '../../../form/checkbox/Checkbox';
import Modal from '../../../modal/Modal';
import { Popover } from '../../../popover/Popover';
import CopyToClipboard from '../../../widgets/CopyToClipboard';
import Icon from '../../../widgets/Icon';
import RecordLookupPopover from '../../../widgets/RecordLookupPopover';
import Spinner from '../../../widgets/Spinner';
import Tooltip from '../../../widgets/Tooltip';
import { dataTableDateFormatter } from '../../data-table-formatters';
import { ACTION_COLUMN_KEY, SELECT_COLUMN_KEY } from '../grid-constants';
import { GridGenericContext } from '../grid-context';
import { getRowId, getSfdcRetUrl } from '../grid-row-utils';
import { ColumnWithFilter, DataTableCellProps, DataTableGroupCellProps, RowWithKey } from '../grid-types';

/**
 * Cell renderers ported from the legacy DataTableRenderers to the new `DataTableCellProps` contract.
 * Salesforce org/serverUrl/onRecordAction now come from GridGenericContext instead of module globals.
 */

interface RecordActionContext {
  org?: SalesforceOrgUi;
  serverUrl?: string;
  skipFrontdoorLogin?: boolean;
  onRecordAction?: (action: CloneEditView, recordId: string, sobjectName: string) => void;
}

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
  return <Checkbox className="slds-align_absolute-center" id={`${column.key}-${getRowId(row)}`} checked={value} label="value" hideLabel readOnly />;
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
      <button className="slds-button" onClick={() => setIsActive((prev) => !prev)}>
        <Icon type="utility" icon="search" className="slds-button__icon slds-button__icon_left" omitContainer />
        View Data
      </button>
    </div>
  );
}

export function IdLinkRenderer({ column, row }: DataTableCellProps<RowWithKey>): ReactNode {
  const { org, serverUrl, skipFrontdoorLogin, onRecordAction } = useContext(GridGenericContext) as RecordActionContext;
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
      onRecordAction={onRecordAction}
    />
  );
}

export function NameLinkRenderer({ column, row }: DataTableCellProps<RowWithKey>): ReactNode {
  const { org, serverUrl, skipFrontdoorLogin, onRecordAction } = useContext(GridGenericContext) as RecordActionContext;
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
      onRecordAction={onRecordAction}
      displayValue={<span className="slds-truncate">{nameValue}</span>}
    />
  );
}

export function TextOrIdLinkRenderer(props: DataTableCellProps<RowWithKey>): ReactNode {
  const { column, row } = props;
  const { org } = useContext(GridGenericContext) as RecordActionContext;
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
        <button className="slds-button slds-button_icon slds-m-right_xx-small" onClick={() => row._action(row, 'view')}>
          <Icon type="utility" icon="preview" className="slds-button__icon" omitContainer title="View Record" />
        </button>
      </Tooltip>
      <Tooltip ariaRole="label" content="Edit">
        <button className="slds-button slds-button_icon slds-m-right_xx-small" onClick={() => row._action(row, 'edit')}>
          <Icon type="utility" icon="edit" className="slds-button__icon" omitContainer title="Edit Record" />
        </button>
      </Tooltip>
      <Tooltip ariaRole="label" content="Clone">
        <button className="slds-button slds-button_icon slds-m-right_xx-small" onClick={() => row._action(row, 'clone')}>
          <Icon type="utility" icon="copy" className="slds-button__icon" omitContainer title="Clone Record" />
        </button>
      </Tooltip>
      {isDeleted ? (
        <Tooltip ariaRole="label" content="Restore from Recycle Bin">
          <button className="slds-button slds-button_icon slds-m-right_xx-small" onClick={() => row._action(row, 'undelete')}>
            <Icon type="utility" icon="undelete" className="slds-button__icon" omitContainer title="Restore from Recycle Bin" />
          </button>
        </Tooltip>
      ) : (
        <Tooltip ariaRole="label" content="Delete">
          <button className="slds-button slds-button_icon slds-m-right_xx-small" onClick={() => row._action(row, 'delete')}>
            <Icon type="utility" icon="delete" className="slds-button__icon" omitContainer title="Delete Record" />
          </button>
        </Tooltip>
      )}
      <Tooltip ariaRole="label" content="Turn Into Apex">
        <button className="slds-button slds-button_icon" onClick={() => row._action(row, 'apex')}>
          <Icon type="utility" icon="apex" className="slds-button__icon" omitContainer title="Turn Into Apex" />
        </button>
      </Tooltip>
    </Fragment>
  );
}

export function ErrorMessageRenderer({ row }: { row: any }): ReactNode {
  if (!row?._saveError) {
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
              <Icon type="utility" icon="error" className="slds-icon slds-icon_x-small" containerClassname="slds-icon_container slds-icon-utility-error" />
            </div>
            <div className="slds-media__body">
              <h2 className="slds-truncate slds-text-heading_medium" title="Resolve error">
                Save Error
              </h2>
            </div>
          </div>
        </header>
      }
      content={
        <div
          css={css`
            max-height: 80vh;
          `}
        >
          <p>{row._saveError}</p>
        </div>
      }
      buttonProps={{ className: 'slds-button slds-button_icon slds-button_icon-error' }}
    >
      <Icon type="utility" icon="error" className="slds-button__icon" omitContainer />
    </Popover>
  );
}

/** Row-selection checkbox renderer. The built-in select column (GridCell cellKind) usually handles this;
 * kept for compatibility with the spreadable SelectColumn definition. */
export function SelectFormatter({ row, tanstackRow }: DataTableCellProps<any>): ReactNode {
  return (
    <Checkbox
      id={`checkbox-select-${getRowId(row)}`}
      label="Select row"
      hideLabel
      checked={tanstackRow.getIsSelected()}
      disabled={!tanstackRow.getCanSelect()}
      onChange={(checked) => tanstackRow.toggleSelected(checked)}
    />
  );
}

/** Group-row "select all" checkbox — selects/deselects every leaf row in the group. */
export function SelectHeaderGroupRenderer({ childRows, tanstackRow }: DataTableGroupCellProps<any>): ReactNode {
  const allSelected = tanstackRow.getIsAllSubRowsSelected();
  const someSelected = tanstackRow.getIsSomeSelected();
  return (
    <Checkbox
      id={`checkbox-select-all-${tanstackRow.id}`}
      label="Select all"
      hideLabel
      checked={allSelected}
      indeterminate={!allSelected && someSelected}
      onChange={(checked) => tanstackRow.toggleSelected(checked)}
    />
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
