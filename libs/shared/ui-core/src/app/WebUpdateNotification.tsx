import { logger } from '@jetstream/shared/client-logger';
import { Icon, Popover } from '@jetstream/ui';
import { updateAvailableVersionState } from '@jetstream/ui/app-state';
import { useAtomValue } from 'jotai';
import { FunctionComponent, useEffect } from 'react';

/**
 * Header icon shown only while a newer server version is available, which today only the web app's
 * AppInitializer detects (via its heartbeat check) - everywhere else this renders nothing, so
 * HeaderNavbar can include it unconditionally. Mirrors the desktop HeaderUpdateNotification
 * pattern: an icon in the global actions area with a popover holding the action, persistent until
 * the user refreshes. The `slds-incoming-notification` class plays the same attention wiggle the
 * desktop updater uses.
 *
 * A plain reload is all this needs: navigations are never served by the service worker, so it always
 * yields the newest shell, and a new worker skips waiting at install rather than needing a nudge.
 */
export const WebUpdateNotification: FunctionComponent = () => {
  const updateAvailableVersion = useAtomValue(updateAvailableVersionState);

  /**
   * Mirror the same state onto the app icon in the dock/taskbar. The header icon is only useful to
   * someone looking at the window, which is exactly what an installed app makes less likely - the
   * badge is visible whether or not the window is focused, or even on screen. No-op in a browser
   * tab and on platforms without the Badging API.
   */
  useEffect(() => {
    if (!('setAppBadge' in navigator)) {
      return;
    }
    const badgeApplied = updateAvailableVersion ? navigator.setAppBadge(1) : navigator.clearAppBadge();
    badgeApplied.catch((ex) => logger.error('[PWA] Unable to update the app badge', ex));
  }, [updateAvailableVersion]);

  if (!updateAvailableVersion) {
    return null;
  }

  return (
    <Popover
      size="medium"
      inverseIcons
      header={
        <header className="slds-popover__header">
          <h2 className="slds-text-heading_small">Update Available</h2>
        </header>
      }
      content={
        <div className="slds-p-around_small">
          <div className="slds-text-body_small slds-m-bottom_small">
            A new version of Jetstream is ready. Refresh to get the latest — anything in progress will be interrupted, so finish up first if
            you need to.
          </div>
          <button className="slds-button slds-button_brand slds-button_stretch" onClick={() => window.location.reload()}>
            Refresh Now
          </button>
        </div>
      }
      buttonProps={{
        className:
          'slds-dropdown-trigger slds-dropdown-trigger_click slds-button slds-button_icon slds-button_icon-container slds-button_icon-small slds-global-actions__notifications slds-global-actions__item-action slds-incoming-notification',
        title: 'Update available',
        'aria-label': 'Update available',
        'aria-live': 'assertive',
        'aria-atomic': true,
      }}
    >
      <Icon type="utility" icon="announcement" className="slds-button__icon slds-global-header__icon" />
    </Popover>
  );
};

export default WebUpdateNotification;
