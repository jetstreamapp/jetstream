import { ReactNode } from 'react';
import { classNames } from '../utils/class-names';

export interface CardProps {
  title?: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  /** Removes the body padding so tables can run edge to edge */
  flush?: boolean;
  className?: string;
  children: ReactNode;
}

export function Card({ title, description, actions, flush, className, children }: CardProps) {
  return (
    <section className={classNames('overflow-hidden rounded-lg bg-white shadow-sm ring-1 ring-slate-200', className)}>
      {(title || actions) && (
        <header className="flex items-start justify-between gap-4 border-b border-slate-200 px-4 py-3">
          <div>
            {title && <h2 className="text-sm font-semibold text-slate-900">{title}</h2>}
            {description && <p className="mt-0.5 text-xs text-slate-500">{description}</p>}
          </div>
          {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
        </header>
      )}
      <div className={flush ? undefined : 'px-4 py-3'}>{children}</div>
    </section>
  );
}
