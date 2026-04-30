import { css } from '@emotion/react';
import type { SalesforceOrgUi } from '@jetstream/types';
import { AutoFullHeightContainer, DataTable, ScopedNotification } from '@jetstream/ui';
import { FunctionComponent, useCallback, useMemo } from 'react';
import { buildDynamicExportColumns, type PermissionExportRow } from './permission-export-result-view';

export interface PermissionAnalysisExportGridProps {
  rows: PermissionExportRow[];
  org: SalesforceOrgUi;
  serverUrl: string;
  skipFrontdoorLogin: boolean;
  defaultApiVersion: string;
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
}) => {
  const columns = useMemo(() => buildDynamicExportColumns(rows), [rows]);
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
