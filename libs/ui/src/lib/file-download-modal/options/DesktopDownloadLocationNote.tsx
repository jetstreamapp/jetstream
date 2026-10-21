import { css } from '@emotion/react';
import { logger } from '@jetstream/shared/client-logger';
import { APP_ROUTES } from '@jetstream/shared/ui-router';
import { getDesktopAutoSaveDownloadFolder } from '@jetstream/shared/ui-utils';
import { Maybe } from '@jetstream/types';
import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { BreakablePath } from '../../widgets/BreakablePath';

const downloadPathCss = css`
  display: block;
  overflow-wrap: anywhere;
`;

/** Read once per mount, since Settings cannot change while a download modal is open */
function useDesktopAutoSaveDownloadFolder(): Maybe<string> {
  const [downloadPath, setDownloadPath] = useState<Maybe<string>>(null);

  useEffect(() => {
    let isMounted = true;
    getDesktopAutoSaveDownloadFolder()
      .then((folder) => {
        if (isMounted) {
          setDownloadPath(folder);
        }
      })
      // Without preferences the modal just looks as it does on web, which is an acceptable fallback for a purely informational note
      .catch((ex) => logger.warn('Unable to read desktop download preferences', ex));
    return () => {
      isMounted = false;
    };
  }, []);

  return downloadPath;
}

export interface DesktopDownloadLocationNoteProps {
  /** Called when the user follows the link to Settings, so the modal can close itself */
  onNavigateToSettings: () => void;
}

/**
 * On desktop, tells the user where the file will be saved when a download folder is configured in Settings,
 * since the download will not prompt for a location. Renders nothing anywhere else.
 */
export function DesktopDownloadLocationNote({ onNavigateToSettings }: DesktopDownloadLocationNoteProps) {
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
      <Link to={{ pathname: APP_ROUTES.SETTINGS.ROUTE, hash: 'general' }} className="slds-text-link" onClick={onNavigateToSettings}>
        Change in Settings
      </Link>
    </div>
  );
}
