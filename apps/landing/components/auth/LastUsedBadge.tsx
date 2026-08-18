import classNames from 'classnames';

export function LastUsedBadge({ className }: { className?: string }) {
  return (
    <span
      className={classNames(
        'inline-flex items-center bg-blue-100 px-2 py-1 text-xs font-medium text-blue-700 dark:bg-blue-400/10 dark:text-blue-400',
        className,
      )}
    >
      Last Used
    </span>
  );
}
