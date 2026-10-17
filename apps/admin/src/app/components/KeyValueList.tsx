import { ReactNode } from 'react';

export interface KeyValueItem {
  label: ReactNode;
  value: ReactNode;
}

export function KeyValueList({ items }: { items: KeyValueItem[] }) {
  return (
    <dl className="grid grid-cols-1 gap-x-4 gap-y-2 text-sm sm:grid-cols-[minmax(8rem,auto)_1fr]">
      {items.map(({ label, value }, index) => (
        <div key={index} className="contents">
          <dt className="text-slate-500">{label}</dt>
          <dd className="min-w-0 break-words text-slate-900">{value}</dd>
        </div>
      ))}
    </dl>
  );
}
