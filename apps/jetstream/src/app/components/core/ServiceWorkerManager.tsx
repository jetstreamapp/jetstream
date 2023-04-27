import { css } from '@emotion/react';
import { logger } from '@jetstream/shared/client-logger';
import { Alert } from '@jetstream/ui';
import { useRegisterSW } from 'virtual:pwa-register/react';

const updateIntervalCheck = 60 * 60 * 1000; // 1 hour

export function ServiceWorkerManager() {
  const {
    offlineReady: [offlineReady, setOfflineReady],
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(swScriptUrl, registration) {
      logger.log('onRegisteredSW', { swScriptUrl, registration });
      if (registration) {
        setInterval(() => {
          registration.update();
        }, updateIntervalCheck);
      }
    },
    onRegisterError(error) {
      logger.log('onRegisterError', error);
    },
  });

  const handleClose = () => {
    setOfflineReady(false);
    setNeedRefresh(false);
  };

  logger.info('[SW] offlineReady', needRefresh);
  logger.info('[SW] offlineReady', offlineReady);

  if (!needRefresh) {
    return null;
  }

  return (
    <Alert type="info" leadingIcon="info" allowClose onClose={handleClose}>
      There is a new version of Jetstream available.
      {needRefresh && (
        <button
          css={css`
            color: currentColor;
            border: 1px solid transparent;
            border-radius: 0.25rem;
            text-decoration: underline;
            cursor: pointer;
            background: none;
            user-select: none;
            white-space: normal;
            &:hover: {
              text-decoration: none;
              outline: 0;
            }
            $:focus: {
              border: 1px solid #f3f3f3;
            }
          `}
          onClick={() => updateServiceWorker(true)}
        >
          Get newest version
        </button>
      )}
    </Alert>
  );
}
