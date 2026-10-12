import { ReactNode } from 'react';
import { classNames } from '../utils/class-names';

export interface TableColumn<Row> {
  key: string;
  header: ReactNode;
  render: (row: Row) => ReactNode;
  className?: string;
}

export interface TableProps<Row> {
  columns: TableColumn<Row>[];
  rows: Row[];
  getRowKey: (row: Row) => string | number;
  emptyMessage?: ReactNode;
}

export function Table<Row>({ columns, rows, getRowKey, emptyMessage = 'Nothing to show' }: TableProps<Row>) {
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-slate-200 text-sm">
        <thead className="bg-slate-50">
          <tr>
            {columns.map(({ key, header, className }) => (
              <th
                key={key}
                scope="col"
                className={classNames(
                  'px-3 py-2 text-left text-xs font-semibold tracking-wide whitespace-nowrap text-slate-600 uppercase',
                  className,
                )}
              >
                {header}
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
