import { css } from '@emotion/react';
import { logger } from '@jetstream/shared/client-logger';
import {
  getAutoSaveDownloadFolder,
  getDesktopPreferences,
  onDesktopPreferencesChanged,
  openDesktopSettings,
} from '@jetstream/shared/ui-utils';
import { Maybe } from '@jetstream/types';
import { useEffect, useState } from 'react';
import { BreakablePath } from '../../widgets/BreakablePath';

const downloadPathCss = css`
  display: block;
  overflow-wrap: anywhere;
`;

/** Follows changes made in the Settings window while the modal stays open */
function useDesktopAutoSaveDownloadFolder(): Maybe<string> {
  const [downloadPath, setDownloadPath] = useState<Maybe<string>>(null);

  useEffect(() => {
    let isMounted = true;
    getDesktopPreferences()
      .then((preferences) => {
        if (isMounted && preferences) {
          setDownloadPath(getAutoSaveDownloadFolder(preferences));
        }
      })
      // Without preferences the modal just looks as it does on web, which is an acceptable fallback for a purely informational note
      .catch((ex) => logger.warn('Unable to read desktop download preferences', ex));
    const unsubscribe = onDesktopPreferencesChanged((preferences) => setDownloadPath(getAutoSaveDownloadFolder(preferences)));
    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, []);

  return downloadPath;
}

/**
 * On desktop, tells the user where the file will be saved when a download folder is configured in Settings,
 * since the download will not prompt for a location. Renders nothing anywhere else.
 */
export function DesktopDownloadLocationNote() {
  const downloadPath = useDesktopAutoSaveDownloadFolder();

  if (!downloadPath) {
    return null;
  }

  return (
    <div className="slds-text-body_small slds-text-color_weak slds-m-top_small" data-testid="desktop-download-location">
      This file will be saved to:
      <span css={downloadPathCss}>
        <BreakablePath path={downloadPath} />
      </span>
      <button className="slds-button" onClick={() => openDesktopSettings('general')}>
        Change in Settings
      </button>
    </div>
  );
}
