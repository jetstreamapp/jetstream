import { logger } from '@jetstream/shared/client-logger';
import { useCallback, useRef } from 'react';
import { useGlobalEventHandler } from './useGlobalEventHandler';

const ICON_URL = '/assets/images/jetstream-icon-white-bg.png';

/**
 * Uses browser notifications to let user know that some process has finished while the tab is not active
 * If Jetstream has focus in the browser, then the notification will not be shown
 *
 * @param serverUrl
 * @returns
 */
export function useBrowserNotifications(serverUrl: string) {
  const notification = useRef<Notification>();

  const visibilitychange = useCallback((event: Event) => {
    if (notification.current && !document.hidden) {
      notification.current.close();
    }
  }, []);

  // ensure that notifications are cleared if browser tab is closed
  const handleUnload = useCallback((event: Event) => {
    if (notification.current) {
      notification.current.close();
    }
  }, []);

  /**
   * Send notification to user if permission exists and the tab is not visible
   *
   * @param {string} title notification title
   * @param {string} body Body of notification
   * @param {string} tag Optional, used to optionally replace existing unread notification with new notification
   */
  const notifyUser = useCallback((title: string, options?: NotificationOptions) => {
    options = options || {};
    options.icon = `${serverUrl}${ICON_URL}`;
    options.badge = `${serverUrl}${ICON_URL}`;

    if (window.Notification && Notification.permission === 'granted' && document.hidden) {
      logger.info('[NOTIFICATION][SENT]', options);
      notification.current = new Notification(title, options);
      notification.current.onclick = (event: Event) => window.focus();
      notification.current.onerror = (event: Event) => logger.info('[NOTIFICATION][ERROR]', event);
    }
  }, []);

  useGlobalEventHandler('visibilitychange', visibilitychange, false);
  useGlobalEventHandler('unload', handleUnload, false);

  return { notifyUser };
}
