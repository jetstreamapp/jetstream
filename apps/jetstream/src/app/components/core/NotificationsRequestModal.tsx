/** @jsx jsx */
import { jsx } from '@emotion/react';
import { Modal } from '@jetstream/ui';
import { selectUserPreferenceState } from 'apps/jetstream/src/app/app-state';
import { Fragment, FunctionComponent, useEffect, useState } from 'react';
import { useRecoilState } from 'recoil';

export interface NotificationsRequestModalProps {
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
  loadDelay = 0,
  userInitiated = false,
  onClose,
}) => {
  const [userPreferences, setUserPreferences] = useRecoilState(selectUserPreferenceState);
  const [isOpen, setIsOpen] = useState(false);

  // ask user for notification permissions on load
  useEffect(() => {
    if (window.Notification) {
      if (userInitiated || (!userPreferences.deniedNotifications && window.Notification.permission === 'default')) {
        setTimeout(() => setIsOpen(true), loadDelay);
      }
    }
  }, [loadDelay]);

  async function handlePermissionRequest(permission: NotificationPermission) {
    setIsOpen(false);
    if (permission === 'denied') {
      setUserPreferences({ ...userPreferences, deniedNotifications: true });
    } else if (permission === 'granted') {
      setUserPreferences({ ...userPreferences, deniedNotifications: false });
    }
    if (onClose) {
      onClose(permission === 'granted');
    }
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
    <Fragment>
      {isOpen && (
        <Modal
          header="Get notifications from Jetstream?"
          footer={
            <Fragment>
              <button className="slds-button slds-button_neutral" onClick={() => handleCancel()}>
                Cancel
              </button>
              <button className="slds-button slds-button_brand" onClick={handleEnable}>
                Enable Notifications
              </button>
            </Fragment>
          }
          closeOnEsc
          closeOnBackdropClick
          onClose={() => handleCancel()}
        >
          <div>
            <p className="slds-m-bottom_x-small">
              Jetstream can let you know when long running processes finish if the Jetstream browser tab is not focused.
            </p>
            <strong>Jetstream can notify you when</strong>
            <ul className="slds-list_dotted">
              <li>Your data load is finished</li>
              <li>Your deployment is finished</li>
              <li>Your anonymous apex is finished</li>
            </ul>
          </div>
        </Modal>
      )}
    </Fragment>
  );
};

export default NotificationsRequestModal;
