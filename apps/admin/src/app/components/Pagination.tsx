import { ChevronLeftIcon, ChevronRightIcon } from '@heroicons/react/20/solid';
import { formatNumber } from '../utils/format';
import { Button } from './Button';

export interface PaginationProps {
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
}

export function getPageCount(total: number, pageSize: number) {
  return Math.max(1, Math.ceil(total / pageSize));
}

export function Pagination({ page, pageSize, total, onPageChange }: PaginationProps) {
  const pageCount = getPageCount(total, pageSize);
  const firstRow = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const lastRow = Math.min(page * pageSize, total);

  return (
    <nav
      aria-label="Pagination"
      className="flex items-center justify-between gap-3 border-t border-slate-200 px-4 py-2 text-xs text-slate-600"
    >
      <p className="tabular-nums">
        {total === 0 ? 'No results' : `${formatNumber(firstRow)}–${formatNumber(lastRow)} of ${formatNumber(total)}`}
      </p>
      <div className="flex items-center gap-2">
        <span className="tabular-nums">
          Page {formatNumber(page)} of {formatNumber(pageCount)}
        </span>
        <Button size="sm" onClick={() => onPageChange(page - 1)} disabled={page <= 1} aria-label="Previous page">
          <ChevronLeftIcon className="h-4 w-4" aria-hidden="true" />
        </Button>
        <Button size="sm" onClick={() => onPageChange(page + 1)} disabled={page >= pageCount} aria-label="Next page">
          <ChevronRightIcon className="h-4 w-4" aria-hidden="true" />
        </Button>
      </div>
    </nav>
  );
}
