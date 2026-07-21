import { Icon, Popover } from '@jetstream/ui';
import { fromAppState } from '@jetstream/ui/app-state';
import { useAtomValue } from 'jotai';
import { FunctionComponent } from 'react';
import { applyServiceWorkerUpdateAndReload } from './service-worker-registration';

/**
 * Header icon shown only while a newer server version is available (detected by AppInitializer's
 * heartbeat check). Mirrors the desktop HeaderUpdateNotification pattern: an icon in the global
 * actions area with a popover holding the action, persistent until the user refreshes. The
 * `slds-incoming-notification` class plays the same attention wiggle the desktop updater uses.
 */
export const WebUpdateNotification: FunctionComponent = () => {
  const updateAvailableVersion = useAtomValue(fromAppState.updateAvailableVersionState);

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
          <button className="slds-button slds-button_brand slds-button_stretch" onClick={() => applyServiceWorkerUpdateAndReload()}>
            Refresh Now
          </button>
        </div>
      }
      buttonProps={{
        className:
          'slds-dropdown-trigger slds-dropdown-trigger_click slds-button slds-button_icon slds-button_icon-container slds-button_icon-small slds-global-actions__notifications slds-global-actions__item-action slds-incoming-notification',
        title: 'Update available',
        'aria-live': 'assertive',
        'aria-atomic': true,
      }}
    >
      <Icon type="utility" icon="announcement" className="slds-button__icon slds-global-header__icon" />
    </Popover>
  );
};

export default WebUpdateNotification;
