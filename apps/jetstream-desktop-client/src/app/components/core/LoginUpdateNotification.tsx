import { css, keyframes } from '@emotion/react';
import { UpdateStatus } from '@jetstream/desktop/types';
import { logger } from '@jetstream/shared/client-logger';
import { APP_ROUTES } from '@jetstream/shared/ui-router';
import { isManualUpdateRequiredError } from '@jetstream/ui-core';
import { useEffect, useState } from 'react';

const fadeIn = keyframes`
  from {
    opacity: 0;
    transform: translateY(8px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
`;

const titleStyle = css`
  font-weight: 600;
  color: #f9fafb;
`;

const subTextStyle = css`
  margin-top: 2px;
  color: #9ca3af;
`;

const actionButtonStyle = css`
  margin-top: 0.5rem;
  background-image: linear-gradient(to right, #14b8a6, #0891b2);
  color: #ffffff;
  border: none;
  border-radius: 0.25rem;
  padding: 0.25rem 0.75rem;
  font-size: 0.8125rem;
  cursor: pointer;
  app-region: no-drag;
  :hover,
  :focus {
    background-image: linear-gradient(to right, #0d9488, #0e7490);
    color: #ffffff;
  }
`;

/**
 * Unobtrusive update indicator for the desktop login / loading screens, where the in-app header
 * (and its update notification) is not yet mounted. Stays hidden unless there is something worth
 * telling the user about — an update is available, downloading, ready to install, or needs a manual
 * install — so the login screen stays clean while still surfacing the background auto-update.
 */
export function LoginUpdateNotification() {
  const [updateStatus, setUpdateStatus] = useState<UpdateStatus>({ status: 'idle' });

  useEffect(() => {
    if (!window.electronAPI) {
      return;
    }
    window.electronAPI
      .getUpdateStatus()
      .then(setUpdateStatus)
      .catch((ex) => logger.warn('Could not get update status', ex));

    const unsubscribe = window.electronAPI.onUpdateStatus(setUpdateStatus);
    return () => {
      if (typeof unsubscribe === 'function') {
        unsubscribe();
      }
    };
  }, []);

  const content = renderContent(updateStatus, () => window.electronAPI?.installUpdate());
  if (!content) {
    return null;
  }

  return (
    <div
      role="status"
      aria-live="polite"
      css={css`
        position: fixed;
        bottom: 1.25rem;
        right: 1.25rem;
        max-width: 320px;
        padding: 0.75rem 1rem;
        border-radius: 0.5rem;
        background-color: rgba(31, 41, 55, 0.92);
        border: 1px solid rgba(255, 255, 255, 0.08);
        color: #e5e7eb;
        font-size: 0.8125rem;
        line-height: 1.35;
        box-shadow: 0 10px 25px rgba(0, 0, 0, 0.35);
        backdrop-filter: blur(6px);
        animation: ${fadeIn} 0.25s ease-out;
        app-region: no-drag;
      `}
    >
      {content}
    </div>
  );
}

function renderContent(updateStatus: UpdateStatus, onRestart: () => void) {
  switch (updateStatus.status) {
    case 'available':
      return (
        <div>
          <span>Update available{updateStatus.version ? ` (v${updateStatus.version})` : ''} — downloading in the background…</span>
        </div>
      );

    case 'downloading': {
      const percent = updateStatus.downloadProgress ? Math.round(updateStatus.downloadProgress.percent) : null;
      return (
        <div>
          <span>Downloading update{percent != null ? ` — ${percent}%` : '…'}</span>
          <div
            css={css`
              height: 3px;
              margin-top: 0.5rem;
              border-radius: 999px;
              background-color: rgba(255, 255, 255, 0.12);
              overflow: hidden;
            `}
          >
            <div
              css={css`
                height: 100%;
                width: ${percent ?? 0}%;
                background-image: linear-gradient(to right, #14b8a6, #0891b2);
                transition: width 0.2s ease;
              `}
            />
          </div>
        </div>
      );
    }

    case 'ready':
      return (
        <div>
          <div css={titleStyle}>Update ready{updateStatus.version ? ` (v${updateStatus.version})` : ''}</div>
          <div css={subTextStyle}>It will be applied the next time you restart.</div>
          <button css={actionButtonStyle} onClick={onRestart}>
            Restart now
          </button>
        </div>
      );

    case 'error':
      // Only the certificate/signature case is actionable for the user; ignore transient check
      // failures here to keep the login screen quiet.
      if (isManualUpdateRequiredError(updateStatus)) {
        return (
          <div>
            <div css={titleStyle}>Update needs a manual install</div>
            <div css={subTextStyle}>
              We updated our app signing certificate, so this update can't install automatically. Your data and connected orgs are not
              affected.
            </div>
            <a css={actionButtonStyle} href={APP_ROUTES.DESKTOP_APPLICATION.ROUTE} target="_blank" rel="noopener noreferrer">
              Download latest version
            </a>
          </div>
        );
      }
      return null;

    // idle / checking / up-to-date — stay out of the way until there is something to act on
    default:
      return null;
  }
}

export default LoginUpdateNotification;
