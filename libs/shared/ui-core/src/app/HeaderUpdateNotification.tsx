import { UpdateStatus } from '@jetstream/desktop/types';
import { logger } from '@jetstream/shared/client-logger';
import { Icon, Popover, PopoverRef, Spinner } from '@jetstream/ui';
import classNames from 'classnames';
import { formatRelative } from 'date-fns';
import { useEffect, useRef, useState } from 'react';

export interface HeaderUpdateNotificationProps {
  onCheckForUpdates: () => void;
  onInstallUpdate: () => void;
}

export const HeaderUpdateNotification = ({ onCheckForUpdates, onInstallUpdate }: HeaderUpdateNotificationProps) => {
  const [updateStatus, setUpdateStatus] = useState<UpdateStatus>({ status: 'idle' });
  const [lastChecked, setLastChecked] = useState<Date | null>(null);
  const [showWiggle, setShowWiggle] = useState(false);
  const popoverRef = useRef<PopoverRef>(null);

  useEffect(() => {
    if (!window.electronAPI) {
      return;
    }

    // Get initial update status
    window.electronAPI.getUpdateStatus().then((status) => {
      logger.info('Initial update status:', status);
      setUpdateStatus(status);
    });

    // Listen for update status changes from main process
    window.electronAPI.onUpdateStatus((status: UpdateStatus) => {
      logger.info('Update status received:', status);
      setUpdateStatus(status);

      // Track last checked time
      if (status.status === 'up-to-date' || status.status === 'available') {
        setLastChecked(new Date());
        // Trigger wiggle animation for up-to-date status (user-initiated check)
        if (status.status === 'up-to-date') {
          setShowWiggle(true);
          setTimeout(() => setShowWiggle(false), 5000); // Clear wiggle after 5 seconds
        }
      }
    });
  }, []);

  const handleCheckForUpdates = () => {
    onCheckForUpdates();
    // Don't close popover so user can see the result
  };

  const handleInstallUpdate = () => {
    onInstallUpdate();
    popoverRef.current?.close();
  };

  const renderPopoverContent = () => {
    switch (updateStatus.status) {
      case 'idle':
        return (
          <div className="slds-p-around_small">
            <div className="slds-text-heading_small slds-m-bottom_x-small">Check for Updates</div>
            <div className="slds-text-body_small slds-m-bottom_small slds-text-color_weak">
              Click below to check if a new version is available.
            </div>
            {lastChecked && (
              <div className="slds-text-body_small slds-m-bottom_small slds-text-color_weak">
                Last checked: {formatRelative(lastChecked, new Date())}
              </div>
            )}
            <button className="slds-button slds-button_neutral slds-button_stretch" onClick={handleCheckForUpdates}>
              Check for Updates
            </button>
          </div>
        );

      case 'checking':
        return (
          <div className="slds-p-around_small">
            <div className="slds-text-heading_small slds-m-bottom_x-small">Checking for Updates</div>
            <div className="slds-text-body_small slds-text-color_weak">Please wait...</div>
          </div>
        );

      case 'up-to-date':
        return (
          <div className="slds-p-around_small">
            <div className="slds-text-heading_small slds-m-bottom_x-small">Up to Date</div>
            <div className="slds-text-body_small slds-m-bottom_small">You have the latest version installed.</div>
            {lastChecked && (
              <div className="slds-text-body_small slds-m-bottom_small slds-text-color_weak">
                Last checked: {formatRelative(lastChecked, new Date())}
              </div>
            )}
            <button className="slds-button slds-button_neutral slds-button_stretch" onClick={handleCheckForUpdates}>
              Check Again
            </button>
          </div>
        );

      case 'available':
        return (
          <div className="slds-p-around_small">
            <div className="slds-text-heading_small slds-m-bottom_x-small">Update Available</div>
            <div className="slds-text-body_small slds-m-bottom_small">
              Version {updateStatus.version} is available and will download in the background.
            </div>
            {lastChecked && (
              <div className="slds-text-body_small slds-text-color_weak">
                Found: {formatRelative(lastChecked, new Date())}
              </div>
            )}
          </div>
        );

      case 'downloading':
        return (
          <div className="slds-p-around_small">
            <div className="slds-text-heading_small slds-m-bottom_x-small">Downloading Update</div>
            <div className="slds-text-body_small slds-text-color_weak">
              {updateStatus.downloadProgress ? `${Math.round(updateStatus.downloadProgress.percent)}% complete` : 'Downloading...'}
            </div>
          </div>
        );

      case 'ready':
        return (
          <div className="slds-p-around_small">
            <div className="slds-text-heading_small slds-m-bottom_x-small">Update Ready</div>
            <div className="slds-text-body_small slds-m-bottom_small">
              Version {updateStatus.version} is ready to install. The update will be applied when you restart the app.
            </div>
            <button className="slds-button slds-button_brand slds-button_stretch" onClick={handleInstallUpdate}>
              Restart Now
            </button>
          </div>
        );

      case 'error':
        return (
          <div className="slds-p-around_small">
            <div className="slds-text-heading_small slds-m-bottom_x-small">Update Error</div>
            <div className="slds-text-body_small slds-m-bottom_small slds-text-color_error">
              {updateStatus.error || 'An error occurred while checking for updates.'}
            </div>
            <button className="slds-button slds-button_neutral slds-button_stretch" onClick={handleCheckForUpdates}>
              Try Again
            </button>
          </div>
        );

      default:
        return null;
    }
  };

  const getIconAndClassNames = () => {
    const baseIconClass = 'slds-button__icon slds-global-header__icon';

    switch (updateStatus.status) {
      case 'checking':
        return {
          icon: <Spinner size="x-small" />,
          tooltip: 'Checking for updates...',
          showWiggle: false,
        };
      case 'available':
        return {
          icon: <Icon type="utility" icon="announcement" className={baseIconClass} />,
          tooltip: 'Update available',
          showWiggle: true,
        };
      case 'downloading':
        return {
          icon: <Spinner size="x-small" />,
          tooltip: 'Downloading update...',
          showWiggle: false,
        };
      case 'ready':
        return {
          icon: <Icon type="utility" icon="success" className={baseIconClass} />,
          tooltip: 'Update ready - click to restart',
          showWiggle: true,
        };
      case 'error':
        return {
          icon: <Icon type="utility" icon="error" className={baseIconClass} />,
          tooltip: 'Update error',
          showWiggle: true,
        };
      case 'up-to-date':
        return {
          icon: <Icon type="utility" icon="download" className={baseIconClass} />,
          tooltip: 'Up to date',
          showWiggle: showWiggle,
        };
      case 'idle':
      default:
        return {
          icon: <Icon type="utility" icon="download" className={baseIconClass} />,
          tooltip: 'Check for updates',
          showWiggle: false,
        };
    }
  };

  const iconData = getIconAndClassNames();

  return (
    <Popover
      ref={popoverRef}
      size="medium"
      inverseIcons
      header={
        <header className="slds-popover__header">
          <h2 className="slds-text-heading_small">App Updates</h2>
        </header>
      }
      content={renderPopoverContent()}
      buttonProps={{
        className: classNames(
          'slds-dropdown-trigger slds-dropdown-trigger_click slds-button slds-button_icon slds-button_icon-container slds-button_icon-small slds-global-actions__notifications slds-global-actions__item-action',
          { 'slds-incoming-notification': iconData.showWiggle },
        ),
        title: iconData.tooltip,
        'aria-live': 'assertive',
        'aria-atomic': 'true',
      }}
    >
      {iconData.icon}
    </Popover>
  );
};

export default HeaderUpdateNotification;
