import { PrinterIcon } from '@heroicons/react/24/outline';
import classNames from 'classnames';

interface PrintButtonProps {
  className?: string;
  label?: string;
}

export default function PrintButton({ className, label = 'Print' }: PrintButtonProps) {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className={classNames(
        'no-print inline-flex items-center gap-2 rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-hidden focus:ring-2 focus:ring-cyan-600',
        className,
      )}
    >
      <PrinterIcon className="h-4 w-4" aria-hidden="true" />
      {label}
    </button>
  );
}
