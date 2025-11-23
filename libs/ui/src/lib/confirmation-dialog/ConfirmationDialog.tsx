import { Maybe } from '@jetstream/types';
import React, { Fragment, FunctionComponent } from 'react';
import Modal from '../modal/Modal';

export interface ConfirmationDialogProps {
  submitDisabled?: boolean;
  isOpen: boolean;
  header?: Maybe<string | React.ReactNode>;
  tagline?: Maybe<string | React.ReactNode>;
  cancelText?: Maybe<string>;
  confirmText?: Maybe<string>;
  onCancel?: () => void;
  onConfirm: () => void;
  children?: React.ReactNode;
}

export interface ConfirmationDialogServiceProviderOptions {
  submitDisabled?: boolean;
  header?: Maybe<string | React.ReactNode>;
  tagline?: Maybe<string | React.ReactNode>;
  content: React.ReactNode;
  cancelText?: Maybe<string>;
  confirmText?: Maybe<string>;
  /**
   * Any arbitrary data that can be passed to the dialog
   * these options will be passed back to the consumer when the dialog is accepted
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
  if (!isOpen) {
    return null;
  }

  return (
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
  );
};

export default ConfirmationDialog;
