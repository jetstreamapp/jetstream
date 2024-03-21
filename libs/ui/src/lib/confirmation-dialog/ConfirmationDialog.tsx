import { Maybe } from '@jetstream/types';
import { OverlayProvider } from '@react-aria/overlays';
import React, { Fragment, FunctionComponent } from 'react';
import Modal from '../modal/Modal';

export interface ConfirmationDialogProps {
  submitDisabled?: boolean;
  isOpen: boolean;
  header?: Maybe<string | JSX.Element>;
  tagline?: Maybe<string | JSX.Element>;
  cancelText?: Maybe<string>;
  confirmText?: Maybe<string>;
  onCancel?: () => void;
  onConfirm: () => void;
  children?: React.ReactNode;
}

export interface ConfirmationDialogServiceProviderOptions {
  submitDisabled?: boolean;
  header?: Maybe<string | JSX.Element>;
  tagline?: Maybe<string | JSX.Element>;
  content: React.ReactNode;
  cancelText?: Maybe<string>;
  confirmText?: Maybe<string>;
  /**
   * Any arbitrary data that can be passed to the dialog
   * these options will be passed back to the consumer when the dialog is accepted
   */
  data?: any;
}

export const ConfirmationDialog: FunctionComponent<ConfirmationDialogProps> = ({
  submitDisabled,
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
              <button className="slds-button slds-button_brand" onClick={onConfirm} disabled={submitDisabled}>
                {confirmText}
              </button>
            </Fragment>
          }
          onClose={() => onCancel && onCancel()}
        >
          {children}
        </Modal>
      )}
    </OverlayProvider>
  );
};

export default ConfirmationDialog;
