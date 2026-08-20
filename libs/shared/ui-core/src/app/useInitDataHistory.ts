import { tracker } from '@jetstream/shared/ui-utils';
import { getErrorMessage } from '@jetstream/shared/utils';
import { dataHistoryCaptureEnabledState, dataHistoryLimitsState } from '@jetstream/ui/app-state';
import { DataHistoryFailureInfo, initDataHistory, setDataHistoryFailureReporter } from '@jetstream/ui/data-history';
import { useSetAtom } from 'jotai';
import { useCallback } from 'react';

/**
 * Data history swallows its failures so a broken capture can never break the user's data operation,
 * which leaves nothing behind to notice: `logger.warn` is a no-op unless logging is turned on. Send
 * them to the error tracker instead, keyed by operation so each code path stays a single issue
 * rather than fragmenting on whatever wording the storage API used. The tracker only reports where a
 * DSN is configured, so this is inert on desktop, the extension, and canvas.
 *
 * Expected conditions (denied permission, aborted streams) are filtered before they get here.
 */
function reportDataHistoryFailureToTracker({ operation, error, entryKey, backend }: DataHistoryFailureInfo): void {
  tracker.error(`[DATA_HISTORY] ${operation} failed`, error, {
    entryKey,
    backend,
    // Included explicitly: FSA and OPFS reject with DOMException, which the tracker cannot unwrap
    errorMessage: getErrorMessage(error),
  });
}

/**
 * Returns a stable callback that runs `initDataHistory()` and seeds the app-state atoms
 * (`dataHistoryCaptureEnabledState`, `dataHistoryLimitsState`) from the result, so every
 * AppInitializer shares one implementation instead of copy-pasting the seeding.
 *
 * Only the web app passes `hasPaidPlan` — when no paid signal is passed, desktop, the browser
 * extension, and canvas get the top history tier via platform detection.
 */
export function useInitDataHistory() {
  const setCaptureEnabled = useSetAtom(dataHistoryCaptureEnabledState);
  const setLimits = useSetAtom(dataHistoryLimitsState);

  const initDataHistoryAndSeedState = useCallback(
    async (options: { userId: string; hasPaidPlan?: boolean }) => {
      setDataHistoryFailureReporter(reportDataHistoryFailureToTracker);
      const { captureEnabled, limits } = await initDataHistory(options);
      setCaptureEnabled(captureEnabled);
      setLimits(limits);
    },
    [setCaptureEnabled, setLimits],
  );

  return initDataHistoryAndSeedState;
}
