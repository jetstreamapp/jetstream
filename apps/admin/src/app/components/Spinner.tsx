import { classNames } from '../utils/class-names';

export function Spinner({ size = 'md', className }: { size?: 'sm' | 'md' | 'lg'; className?: string }) {
  const sizeClass = size === 'sm' ? 'h-3.5 w-3.5 border-2' : size === 'lg' ? 'h-8 w-8 border-[3px]' : 'h-5 w-5 border-2';
  return (
    <span
      role="status"
      aria-label="Loading"
      className={classNames('inline-block animate-spin rounded-full border-current border-r-transparent opacity-70', sizeClass, className)}
    />
  );
}

export function PageSpinner() {
  return (
    <div className="flex justify-center py-16 text-slate-500">
      <Spinner size="lg" />
    </div>
  );
}
