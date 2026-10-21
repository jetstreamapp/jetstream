import { ReactNode } from 'react';
import { classNames } from '../utils/class-names';

export type BadgeTone = 'gray' | 'green' | 'red' | 'amber' | 'blue' | 'purple';

const TONE_CLASSES: Record<BadgeTone, string> = {
  gray: 'bg-slate-100 text-slate-700 ring-slate-500/20',
  green: 'bg-green-50 text-green-700 ring-green-600/20',
  red: 'bg-red-50 text-red-700 ring-red-600/20',
  amber: 'bg-amber-50 text-amber-800 ring-amber-600/20',
  blue: 'bg-blue-50 text-blue-700 ring-blue-700/10',
  purple: 'bg-purple-50 text-purple-700 ring-purple-700/10',
};

export function Badge({ tone = 'gray', children, title }: { tone?: BadgeTone; children: ReactNode; title?: string }) {
  return (
    <span
      title={title}
      className={classNames(
        'inline-flex items-center rounded-md px-1.5 py-0.5 text-xs font-medium whitespace-nowrap ring-1 ring-inset',
        TONE_CLASSES[tone],
      )}
    >
      {children}
    </span>
  );
}

const STATUS_TONES: Record<string, BadgeTone> = {
  ACTIVE: 'green',
  TRIALING: 'green',
  PAID: 'green',
  ACCEPTED: 'green',
  INACTIVE: 'gray',
  CANCELED: 'gray',
  CANCELLED: 'gray',
  DRAFT: 'gray',
  PAST_DUE: 'red',
  UNPAID: 'red',
  INCOMPLETE: 'amber',
  INCOMPLETE_EXPIRED: 'red',
  OPEN: 'blue',
  MANUAL: 'blue',
  PAUSED: 'amber',
};

/** Badge for the status strings stored on teams, members and Stripe objects (case-insensitive) */
export function StatusBadge({ status }: { status: string | null | undefined }) {
  if (!status) {
    return <Badge>unknown</Badge>;
  }
  const tone = STATUS_TONES[status.toUpperCase()] ?? 'gray';
  return <Badge tone={tone}>{status.toUpperCase().replace(/_/g, ' ')}</Badge>;
}

export function BooleanBadge({ value, trueLabel = 'Yes', falseLabel = 'No' }: { value: boolean; trueLabel?: string; falseLabel?: string }) {
  return <Badge tone={value ? 'green' : 'gray'}>{value ? trueLabel : falseLabel}</Badge>;
}
