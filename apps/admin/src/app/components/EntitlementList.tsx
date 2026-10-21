import { CheckCircleIcon, MinusCircleIcon } from '@heroicons/react/20/solid';
import { EntitlementFlags } from '@jetstream/admin/types';

export const ENTITLEMENT_LABELS: Record<keyof EntitlementFlags, string> = {
  chromeExtension: 'Browser extension',
  googleDrive: 'Google Drive',
  recordSync: 'Record sync',
  desktop: 'Desktop app',
  analysisTools: 'Analysis tools',
  salesforceCanvas: 'Salesforce Canvas',
};

export const ENTITLEMENT_KEYS = Object.keys(ENTITLEMENT_LABELS) as Array<keyof EntitlementFlags>;

export function EntitlementList({ entitlements }: { entitlements: EntitlementFlags | null }) {
  if (!entitlements) {
    return <p className="text-sm text-slate-500">No entitlement record</p>;
  }
  return (
    <ul className="grid grid-cols-1 gap-1.5 text-sm sm:grid-cols-2">
      {ENTITLEMENT_KEYS.map((entitlementKey) => {
        const enabled = entitlements[entitlementKey];
        return (
          <li key={entitlementKey} className="flex items-center gap-1.5">
            {/* Heroicons are always aria-hidden, so the state is announced by the visually hidden text */}
            {enabled ? <CheckCircleIcon className="h-4 w-4 text-green-600" /> : <MinusCircleIcon className="h-4 w-4 text-slate-300" />}
            <span className={enabled ? 'text-slate-900' : 'text-slate-500'}>
              {ENTITLEMENT_LABELS[entitlementKey]}
              <span className="sr-only">{enabled ? ': enabled' : ': disabled'}</span>
            </span>
          </li>
        );
      })}
    </ul>
  );
}
