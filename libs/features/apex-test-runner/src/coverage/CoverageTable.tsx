import { css } from '@emotion/react';
import type { ApexCodeCoverageAggregateRecord } from '@jetstream/types';
import { AutoFullHeightContainer, ColumnWithFilter, DataTable, RenderCellProps, setColumnFromType } from '@jetstream/ui';
import { FunctionComponent, useMemo } from 'react';
import { getCoveragePercentage } from './coverage-utils';

type CoverageRow = ApexCodeCoverageAggregateRecord & { name: string; percentage: number | null };

/** Salesforce requires 75% org-wide coverage to deploy — color the per-class number against the same bar */
const PercentageRenderer = ({ row }: RenderCellProps<CoverageRow>) => {
  if (row.percentage === null) {
    return <span className="slds-text-color_weak">n/a</span>;
  }
  return <span className={row.percentage < 75 ? 'slds-text-color_error' : 'slds-text-color_success'}>{row.percentage}%</span>;
};

const COLUMNS: ColumnWithFilter<CoverageRow>[] = [
  {
    ...setColumnFromType('name', 'text'),
    name: 'Class or Trigger',
    key: 'name',
    width: 300,
  },
  {
    ...setColumnFromType('percentage', 'number'),
    name: 'Coverage',
    key: 'percentage',
    width: 120,
    renderCell: PercentageRenderer,
  },
  {
    ...setColumnFromType('NumLinesCovered', 'number'),
    name: 'Lines Covered',
    key: 'NumLinesCovered',
    width: 130,
  },
  {
    ...setColumnFromType('NumLinesUncovered', 'number'),
    name: 'Lines Uncovered',
    key: 'NumLinesUncovered',
    width: 140,
  },
];

function getRowId({ Id }: CoverageRow): string {
  return Id;
}

export interface CoverageTableProps {
  coverageRecords: ApexCodeCoverageAggregateRecord[];
  quickFilterText?: string | null;
  onRowSelection: (record: ApexCodeCoverageAggregateRecord) => void;
}

export const CoverageTable: FunctionComponent<CoverageTableProps> = ({ coverageRecords, quickFilterText, onRowSelection }) => {
  const rows = useMemo<CoverageRow[]>(
    () =>
      coverageRecords.map((record) => ({
        ...record,
        name: record.ApexClassOrTrigger?.Name ?? '',
        percentage: getCoveragePercentage(record),
      })),
    [coverageRecords],
  );

  const columns = useMemo<ColumnWithFilter<CoverageRow>[]>(
    () =>
      COLUMNS.map((column) => {
        const renderCell = column.renderCell;
        return {
          ...column,
          renderCell: (props: RenderCellProps<CoverageRow>) => (
            <div
              role="button"
              tabIndex={-1}
              css={css`
                width: 100%;
                height: 100%;
              `}
              onClick={() => onRowSelection(props.row)}
            >
              {renderCell ? renderCell(props) : props.value === null || props.value === undefined ? '' : String(props.value)}
            </div>
          ),
        };
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  return (
    <AutoFullHeightContainer fillHeight setHeightAttr bottomBuffer={25}>
      <DataTable
        columns={columns}
        data={rows}
        getRowKey={getRowId}
        // quickFilterText is inert without this flag — it gates the grid's global-filter machinery
        includeQuickFilter
        quickFilterText={quickFilterText}
        initialSortColumns={[{ columnKey: 'name', direction: 'ASC' }]}
        defaultColumnOptions={{ sortable: true }}
      />
    </AutoFullHeightContainer>
  );
};

export default CoverageTable;
