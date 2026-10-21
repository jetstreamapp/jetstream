import { ExclamationTriangleIcon, InformationCircleIcon, XCircleIcon } from '@heroicons/react/20/solid';
import { ReactNode } from 'react';
import { getErrorMessage } from '../api/admin-api-client';
import { classNames } from '../utils/class-names';
import { Button } from './Button';

export type AlertTone = 'error' | 'warning' | 'info' | 'success';

const TONE_CLASSES: Record<AlertTone, string> = {
  error: 'bg-red-50 text-red-800 ring-red-200',
  warning: 'bg-amber-50 text-amber-900 ring-amber-200',
  info: 'bg-blue-50 text-blue-900 ring-blue-200',
  success: 'bg-green-50 text-green-900 ring-green-200',
};

export function Alert({
  tone = 'info',
  title,
  children,
  actions,
}: {
  tone?: AlertTone;
  title?: ReactNode;
  children?: ReactNode;
  actions?: ReactNode;
}) {
  const Icon = tone === 'error' ? XCircleIcon : tone === 'warning' ? ExclamationTriangleIcon : InformationCircleIcon;
  return (
    <div
      role={tone === 'error' ? 'alert' : 'status'}
      className={classNames('flex gap-3 rounded-md p-3 text-sm ring-1', TONE_CLASSES[tone])}
    >
      <Icon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
      <div className="min-w-0 flex-1">
        {title && <p className="font-semibold">{title}</p>}
        {children && <div className={title ? 'mt-1' : undefined}>{children}</div>}
        {actions && <div className="mt-2 flex gap-2">{actions}</div>}
      </div>
    </div>
  );
}

export function ErrorAlert({ error, title = 'Something went wrong', onRetry }: { error: unknown; title?: string; onRetry?: () => void }) {
  return (
    <Alert
      tone="error"
      title={title}
      actions={
        onRetry ? (
          <Button size="sm" onClick={onRetry}>
            Try again
          </Button>
        ) : undefined
      }
    >
      {getErrorMessage(error)}
    </Alert>
  );
}
