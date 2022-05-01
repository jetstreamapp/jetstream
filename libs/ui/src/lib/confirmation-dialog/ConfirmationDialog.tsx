import React, { Fragment, FunctionComponent } from 'react';
import Modal from '../modal/Modal';
import { OverlayProvider } from '@react-aria/overlays';

export interface ConfirmationDialogProps {
  isOpen: boolean;
  header?: string | JSX.Element;
  tagline?: string | JSX.Element;
  cancelText?: string;
  confirmText?: string;
  onCancel?: () => void;
  onConfirm: () => void;
  children?: React.ReactNode;
}

export interface ConfirmationDialogServiceProviderOptions {
  rejectOnCancel?: boolean; // if true, then a cancellation will result in a rejected promise
  header?: string | JSX.Element;
  tagline?: string | JSX.Element;
  content: React.ReactNode;
  cancelText?: string;
  confirmText?: string;
}

export const ConfirmationDialog: FunctionComponent<ConfirmationDialogProps> = ({
  isOpen,
  header,
  tagline,
  cancelText = 'Cancel',
  confirmText = 'Confirm',
  onCancel,
  onConfirm,
  children,
}) => {
  return (
    <OverlayProvider>
      {isOpen && (
        <Modal
          className="slds-modal_prompt"
          header={header || 'Confirm Action'}
          tagline={tagline}
          closeOnBackdropClick={false}
          footer={
            <Fragment>
              <button className="slds-button slds-button_neutral" onClick={onCancel}>
                {cancelText}
              </button>
              <button className="slds-button slds-button_brand" onClick={onConfirm}>
                {confirmText}
              </button>
            </Fragment>
          }
          onClose={() => onCancel()}
        >
          {children}
        </Modal>
      )}
    </OverlayProvider>
  );
};

export default ConfirmationDialog;
