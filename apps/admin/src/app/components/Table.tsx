import { ChevronDownIcon, ChevronUpDownIcon, ChevronUpIcon } from '@heroicons/react/20/solid';
import { SortDirection } from '@jetstream/admin/types';
import { ReactNode } from 'react';
import { classNames } from '../utils/class-names';

export interface TableColumn<Row> {
  key: string;
  header: ReactNode;
  render: (row: Row) => ReactNode;
  className?: string;
  /** Makes the header a sort toggle; the value is what `onSortChange` receives */
  sortKey?: string;
}

export interface TableSort {
  key: string;
  direction: SortDirection;
}

export interface TableProps<Row> {
  columns: TableColumn<Row>[];
  rows: Row[];
  getRowKey: (row: Row) => string | number;
  emptyMessage?: ReactNode;
  sort?: TableSort;
  onSortChange?: (sort: TableSort) => void;
}

function SortableHeader({
  header,
  sortKey,
  sort,
  onSortChange,
}: {
  header: ReactNode;
  sortKey: string;
  sort?: TableSort;
  onSortChange: (sort: TableSort) => void;
}) {
  const isSorted = sort?.key === sortKey;
  const SortIcon = !isSorted ? ChevronUpDownIcon : sort.direction === 'asc' ? ChevronUpIcon : ChevronDownIcon;
  // Dates are the only sortable columns today, so a new sort starts with the most recent first
  const nextDirection: SortDirection = isSorted && sort.direction === 'desc' ? 'asc' : 'desc';
  return (
    <button
      type="button"
      onClick={() => onSortChange({ key: sortKey, direction: nextDirection })}
      className="inline-flex items-center gap-0.5 uppercase hover:text-slate-900"
    >
      {header}
      <SortIcon className={classNames('h-4 w-4', isSorted ? 'text-slate-700' : 'text-slate-400')} aria-hidden="true" />
    </button>
  );
}

export function Table<Row>({ columns, rows, getRowKey, emptyMessage = 'Nothing to show', sort, onSortChange }: TableProps<Row>) {
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-slate-200 text-sm">
        <thead className="bg-slate-50">
          <tr>
            {columns.map(({ key, header, className, sortKey }) => (
              <th
                key={key}
                scope="col"
                aria-sort={sortKey && sort?.key === sortKey ? (sort.direction === 'asc' ? 'ascending' : 'descending') : undefined}
                className={classNames(
                  'px-3 py-2 text-left text-xs font-semibold tracking-wide whitespace-nowrap text-slate-600 uppercase',
                  className,
                )}
              >
                {sortKey && onSortChange ? (
                  <SortableHeader header={header} sortKey={sortKey} sort={sort} onSortChange={onSortChange} />
                ) : (
                  header
                )}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 bg-white">
          {rows.length === 0 && (
            <tr>
              <td colSpan={columns.length} className="px-3 py-6 text-center text-sm text-slate-500">
                {emptyMessage}
              </td>
            </tr>
          )}
          {rows.map((row) => (
            <tr key={getRowKey(row)} className="hover:bg-slate-50">
              {columns.map(({ key, render, className }) => (
                <td key={key} className={classNames('px-3 py-2 align-top text-slate-700', className)}>
                  {render(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
