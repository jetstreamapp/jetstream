import { logger } from '@jetstream/shared/client-logger';
import { updateCanvasPreferences } from '@jetstream/shared/data';
import { ColorScheme } from '@jetstream/types';
import { atom, useAtom } from 'jotai';
import { useCallback } from 'react';
import { getCanvasOrg } from '../../utils/canvas.utils';

/**
 * Current color scheme for the canvas app. The canonical value is persisted to
 * the Salesforce `UserPreferences__c` custom setting (so it follows the user
 * across browsers); this atom mirrors it for the React tree. `AppInitializer`
 * seeds it from the loaded preferences and `ThemeApplier`/`HeaderNavbar` read it.
 */
export const canvasColorSchemeState = atom<ColorScheme>('light');

export function useCanvasColorScheme(): [ColorScheme, (colorScheme: ColorScheme) => void] {
  const [colorScheme, setColorSchemeState] = useAtom(canvasColorSchemeState);

  const setColorScheme = useCallback(
    (nextColorScheme: ColorScheme) => {
      setColorSchemeState(nextColorScheme);
      try {
        const org = getCanvasOrg();
        updateCanvasPreferences(org, { colorScheme: nextColorScheme }).catch((ex) => {
          logger.error('Error saving canvas color scheme', ex);
        });
      } catch (ex) {
        logger.error('Error saving canvas color scheme', ex);
      }
    },
    [setColorSchemeState],
  );

  return [colorScheme, setColorScheme];
}
