import { css } from '@emotion/react';
import type { SalesforceOrgUi } from '@jetstream/types';
import { AutoFullHeightContainer, DataTable, Icon, SalesforceLogin, ScopedNotification, Tooltip } from '@jetstream/ui';
import type { ColumnWithFilter, RowWithKey } from '@jetstream/ui';
import { FunctionComponent, useCallback, useMemo } from 'react';
import type { RenderCellProps } from 'react-data-grid';
import { buildDynamicExportColumns, type PermissionExportRow, type SobjectExportDetail } from './permission-export-result-view';

const OBJECT_PERMISSIONS_OMIT_KEYS = new Set(['attributes', 'Id', 'ParentId']);

/** Bare (borderless) base icon buttons for object cell actions, grouped in SLDS button group. */
const OBJECT_TYPE_ACTION_BUTTON_CLASSNAME = 'slds-button slds-button_icon slds-button_icon-bare';

/** Default grid width for text columns; Object column needs extra space for label + actions. */
const DEFAULT_TEXT_COLUMN_WIDTH = 175;

/** Label + tooltip; optional Object Manager icon only (no separate info popover). */
const OBJECT_NAME_COLUMN_MIN_WIDTH_ONE_ACTION = 200;
/** `minmax` + `fr`: Object column grows; floor keeps label + icon actions usable. */
const EXPORT_GRID_OBJECT_NAME_FR = 1.65;

export type PermissionAnalysisExportGridVariant = 'default' | 'object_permissions';

export interface PermissionAnalysisExportGridProps {
  rows: PermissionExportRow[];
  org: SalesforceOrgUi;
  serverUrl: string;
  skipFrontdoorLogin: boolean;
  defaultApiVersion: string;
  /** Describe + EntityDefinition metadata for SobjectType cells (label, API name, description). */
  sobjectExportDetails?: Record<string, SobjectExportDetail>;
  /** When `object_permissions`, hides Id/ParentId/attributes and adds Object Manager link on SobjectType. */
  variant?: PermissionAnalysisExportGridVariant;
}

/** Copy for {@link Tooltip} on dark `slds-popover_tooltip` (inverse text). */
function objectDetailBlock(apiName: string, label: string, description: string | null) {
  return (
    <div
      css={css`
        max-width: 22rem;
        text-align: left;
      `}
    >
      <div className="slds-text-title_caps slds-text-color_inverse-weak">API name</div>
      <div className="slds-text-body_regular slds-text-color_inverse slds-hyphenate slds-m-bottom_x-small">{apiName}</div>
      <div className="slds-text-title_caps slds-text-color_inverse-weak">Label</div>
      <div className="slds-text-body_regular slds-text-color_inverse slds-hyphenate slds-m-bottom_x-small">{label}</div>
      <div className="slds-text-title_caps slds-text-color_inverse-weak">Description</div>
      <div className="slds-text-body_regular slds-text-color_inverse slds-hyphenate">{description ?? '—'}</div>
    </div>
  );
}

/** Object label (hover for API / label / description) and optional Object Manager link (shared by export grid and OLS tree). */
export const SobjectTypeCellContent: FunctionComponent<{
  apiName: string;
  detail: SobjectExportDetail | undefined;
  objectManager?: { org: SalesforceOrgUi; serverUrl: string; skipFrontDoorAuth: boolean };
}> = ({ apiName, detail, objectManager }) => {
  const label = detail?.label?.trim() ? detail.label.trim() : apiName;
  const descriptionText =
    detail?.description != null && String(detail.description).trim().length > 0 ? String(detail.description).trim() : null;
  const detailBodyTooltip = objectDetailBlock(apiName, label, descriptionText);

  return (
    <div className="slds-grid slds-gutters_xx-small slds-grid_vertical-align-center">
      <div
        className="slds-col slds-grow"
        css={css`
          min-width: 0;
        `}
      >
        <Tooltip content={detailBodyTooltip}>
          <span className="slds-truncate" title={label !== apiName ? `${label} (${apiName})` : label}>
            {label}
          </span>
        </Tooltip>
      </div>
      {objectManager && (
        <div
          className="slds-col slds-no-flex"
          css={css`
            display: flex;
            align-items: center;
            column-gap: 0.375rem;
          `}
        >
          <SalesforceLogin
            org={objectManager.org}
            serverUrl={objectManager.serverUrl}
            skipFrontDoorAuth={objectManager.skipFrontDoorAuth}
            returnUrl={`/lightning/setup/ObjectManager/${encodeURIComponent(apiName)}/Details/view`}
            title={`Open ${apiName} in Object Manager`}
            omitIcon
            className={OBJECT_TYPE_ACTION_BUTTON_CLASSNAME}
          >
            <Icon type="utility" icon="new_window" className="slds-button__icon" omitContainer />
          </SalesforceLogin>
        </div>
      )}
    </div>
  );
};

function relaxExportPermissionColumnsForFlex(columns: ColumnWithFilter<RowWithKey>[]): ColumnWithFilter<RowWithKey>[] {
  return columns.map((column) => {
    if (typeof column.key !== 'string' || !column.key.startsWith('Permissions')) {
      return column;
    }
    return {
      ...column,
      width: 'minmax(100px, 0.32fr)',
      minWidth: 100,
    } as ColumnWithFilter<RowWithKey>;
  });
}

function applySobjectTypeColumn(
  columns: ColumnWithFilter<RowWithKey>[],
  options: {
    sobjectExportDetails?: Record<string, SobjectExportDetail>;
    objectManager?: { org: SalesforceOrgUi; serverUrl: string; skipFrontDoorAuth: boolean };
  },
): ColumnWithFilter<RowWithKey>[] {
  const { sobjectExportDetails, objectManager } = options;
  const detailCount = sobjectExportDetails ? Object.keys(sobjectExportDetails).length : 0;
  if (!objectManager && detailCount === 0) {
    return columns;
  }

  return columns.map((column) => {
    if (column.key !== 'SobjectType') {
      return column;
    }
    const priorMinWidth = typeof column.minWidth === 'number' ? column.minWidth : 0;
    const reservedMinWidth = objectManager ? OBJECT_NAME_COLUMN_MIN_WIDTH_ONE_ACTION : DEFAULT_TEXT_COLUMN_WIDTH;
    const objectNameFloor = Math.max(priorMinWidth, reservedMinWidth, DEFAULT_TEXT_COLUMN_WIDTH);

    return {
      ...column,
      minWidth: objectNameFloor,
      width: `minmax(${objectNameFloor}px, ${EXPORT_GRID_OBJECT_NAME_FR}fr)`,
      getValue: ({ row }) => {
        const api = typeof row.SobjectType === 'string' ? row.SobjectType.trim() : '';
        if (!api) {
          return null;
        }
        const detail = sobjectExportDetails?.[api];
        const label = detail?.label?.trim() ? detail.label.trim() : api;
        const parts = [label, api];
        if (detail?.description != null && String(detail.description).trim().length > 0) {
          parts.push(String(detail.description).trim());
        }
        return parts.join(' ');
      },
      renderCell: (props: RenderCellProps<RowWithKey>) => {
        const raw = props.row?.SobjectType;
        const apiName = typeof raw === 'string' ? raw.trim() : '';
        if (!apiName) {
          return <div className="slds-truncate">—</div>;
        }
        const detail = sobjectExportDetails?.[apiName];
        return <SobjectTypeCellContent apiName={apiName} detail={detail} objectManager={objectManager} />;
      },
    } as ColumnWithFilter<RowWithKey>;
  });
}

/**
 * Read-only SOQL export rows with dynamic columns and quick filter (Phase A).
 */
export const PermissionAnalysisExportGrid: FunctionComponent<PermissionAnalysisExportGridProps> = ({
  rows,
  org,
  serverUrl,
  skipFrontdoorLogin,
  defaultApiVersion,
  sobjectExportDetails,
  variant = 'default',
}) => {
  const columns = useMemo(() => {
    const base = buildDynamicExportColumns(
      rows,
      variant === 'object_permissions' ? { omitColumnKeys: OBJECT_PERMISSIONS_OMIT_KEYS } : undefined,
    );
    const objectManager = variant === 'object_permissions' ? { org, serverUrl, skipFrontDoorAuth: skipFrontdoorLogin } : undefined;
    const detailCount = sobjectExportDetails ? Object.keys(sobjectExportDetails).length : 0;
    if (!objectManager && detailCount === 0) {
      return base;
    }
    const withObjectColumn = applySobjectTypeColumn(base, { sobjectExportDetails, objectManager });
    return relaxExportPermissionColumnsForFlex(withObjectColumn);
  }, [rows, variant, org, serverUrl, skipFrontdoorLogin, sobjectExportDetails]);

  const rowsMap = useMemo(() => new WeakMap(rows.map((row, index) => [row, `export-row-${index}`])), [rows]);
  const getRowKey = useCallback((row: PermissionExportRow) => rowsMap.get(row) ?? 'row', [rowsMap]);

  if (!rows.length) {
    return (
      <div className="slds-p-around_medium">
        <ScopedNotification theme="info">No rows in this export slice.</ScopedNotification>
      </div>
    );
  }

  return (
    <AutoFullHeightContainer
      fillHeight
      bottomBuffer={24}
      baseCss={css`
        min-height: 200px;
      `}
    >
      <DataTable
        org={org}
        serverUrl={serverUrl}
        skipFrontdoorLogin={skipFrontdoorLogin}
        columns={columns}
        data={rows}
        getRowKey={getRowKey}
        includeQuickFilter
        context={{ defaultApiVersion }}
      />
    </AutoFullHeightContainer>
  );
};
