import { dataHistoryCaptureEnabledState, dataHistoryLimitsState } from '@jetstream/ui/app-state';
import { initDataHistory } from '@jetstream/ui/data-history';
import { useSetAtom } from 'jotai';
import { useCallback } from 'react';

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
      const { captureEnabled, limits } = await initDataHistory(options);
      setCaptureEnabled(captureEnabled);
      setLimits(limits);
    },
    [setCaptureEnabled, setLimits],
  );

  return initDataHistoryAndSeedState;
}
