import { ANALYTICS_KEYS, FEATURE_FLAGS } from '@jetstream/shared/constants';
import { hasFeatureFlagAccess } from '@jetstream/shared/ui-utils';
import { DockedComposer, DockedComposerRef } from '@jetstream/ui';
import { useUserPreferenceState } from '@jetstream/ui-core';
import { Fragment, FunctionComponent, useEffect, useRef, useState } from 'react';
import { useAmplitude } from '@jetstream/ui-core';
import NotificationExampleImage from './jetstream-sample-notification.png';

export interface NotificationsRequestModalProps {
  featureFlags: Set<string>;
  loadDelay?: number;
  /** Allow permission modal to be opened even if initially denied */
  userInitiated?: boolean;
  onClose?: (isEnabled: boolean) => void;
}

/**
 * Regular file download modal, but does not actually download any file
 * This is useful if the file takes a while to generate and we allow the user
 * to choose the filename upfront, then we can use it later
 */
export const NotificationsRequestModal: FunctionComponent<NotificationsRequestModalProps> = ({
  featureFlags,
  loadDelay = 0,
  userInitiated = false,
  onClose,
}) => {
  const composerRef = useRef<DockedComposerRef>();
  const [userPreferences, setUserPreferences] = useUserPreferenceState();
  const [isDismissed, setIsDismissed] = useState(true);
  const { trackEvent } = useAmplitude();

  // ask user for notification permissions on load
  useEffect(() => {
    if (window.Notification) {
      if (userInitiated || (!userPreferences.deniedNotifications && window.Notification.permission === 'default')) {
        if (hasFeatureFlagAccess(featureFlags, FEATURE_FLAGS.NOTIFICATIONS)) {
          setTimeout(() => setIsDismissed(false), loadDelay);
          trackEvent(ANALYTICS_KEYS.notifications_modal_opened, { userInitiated, currentPermission: window.Notification.permission });
        }
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadDelay, featureFlags]);

  async function handlePermissionRequest(permission: NotificationPermission) {
    if (composerRef.current) {
      composerRef.current.setIsOpen(false);
    }
    setIsDismissed(true);
    if (permission === 'denied') {
      setUserPreferences({ ...userPreferences, deniedNotifications: true });
    } else if (permission === 'granted') {
      setUserPreferences({ ...userPreferences, deniedNotifications: false });
    }
    if (onClose) {
      onClose(permission === 'granted');
    }
    trackEvent(ANALYTICS_KEYS.notifications_permission_requested, { permission });
  }

  async function handleEnable() {
    try {
      const permission = await Notification.requestPermission();
      handlePermissionRequest(permission);
    } catch (ex) {
      // Safari does not support promise version and will throw exception above
      Notification.requestPermission((permission) => {
        handlePermissionRequest(permission);
      });
    }
  }

  function handleCancel() {
    handlePermissionRequest('denied');
  }

  return (
    // eslint-disable-next-line react/jsx-no-useless-fragment
    <Fragment>
      {!isDismissed && (
        <DockedComposer
          ref={composerRef}
          initOpenState={true}
          label="Enable Notifications"
          allowMinimize
          onClose={handleCancel}
          footer={
            <div className="slds-col_bump-left slds-text-align_right">
              <button className="slds-button slds-button_brand" onClick={handleEnable}>
                Enable Notifications
              </button>
            </div>
          }
        >
          <div className="slds-p-around_medium">
            <div className="slds-align_absolute-center">
              <img src={NotificationExampleImage} alt="Notification Example" />
            </div>

            <p className="slds-m-vertical_small">
              Jetstream can let you know when long running processes finish and your browser tab is not focused, such as if you start a data
              load and then go check your email.
            </p>

            <p className="slds-m-vertical_small">
              When notifications are enabled, they will only show up if tasks finish in the background and you will never get a notification
              unless you are actively using Jetstream.
            </p>

            <strong>Here are some examples of notifications Jetstream will provide:</strong>
            <ul className="slds-list_dotted">
              <li>Your data load is finished</li>
              <li>Your deployment is finished</li>
              <li>Your query results are ready to view</li>
              <li>Your anonymous apex has finished executing</li>
            </ul>
          </div>
        </DockedComposer>
      )}
    </Fragment>
  );
};

export default NotificationsRequestModal;
