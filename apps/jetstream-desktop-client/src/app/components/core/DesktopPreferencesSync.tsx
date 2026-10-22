import { DesktopUserPreferences } from '@jetstream/desktop/types';
import { onDesktopPreferencesChanged } from '@jetstream/shared/ui-utils';
import { fromAppState, useSyncUserPreferencesAcrossWindows } from '@jetstream/ui/app-state';
import { useSetAtom } from 'jotai';
import { useEffect } from 'react';
import { desktopUserPreferences } from './AppDesktopState';

/**
 * Keeps this window's settings in step with changes made in another window, such as the Settings window.
 * Desktop preferences are pushed by the main process; the per-window user preferences (e.g. the color scheme)
 * arrive over a BroadcastChannel.
 */
export function DesktopPreferencesSync() {
  const setDesktopPreferences = useSetAtom(desktopUserPreferences);
  const setUserProfile = useSetAtom(fromAppState.userProfileState);

  useSyncUserPreferencesAcrossWindows();

  useEffect(() => {
    return onDesktopPreferencesChanged((preferences: DesktopUserPreferences) => {
      setDesktopPreferences(preferences);
      setUserProfile((prev) => ({ ...prev, preferences }));
    });
  }, [setDesktopPreferences, setUserProfile]);

  return null;
}
