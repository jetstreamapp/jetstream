/** @jsx jsx */
import { jsx } from '@emotion/core';
import { Fragment, FunctionComponent } from 'react';
import { createModal } from 'react-modal-promise';
import Modal, { ModalProps } from './Modal';

type CommonModalProps = Pick<ModalProps, 'header' | 'tagline' | 'closeOnEsc' | 'closeOnBackdropClick'>;

export interface ConfirmationModalProps extends CommonModalProps {
  isOpen: boolean;
  content: string | JSX.Element;
  confirm?: string | JSX.Element;
  cancel?: string | JSX.Element;
  onResolve: (result: boolean) => void;
}
const ConfirmationModal: FunctionComponent<ConfirmationModalProps> = ({
  isOpen,
  header = 'Are you sure?',
  tagline,
  content,
  confirm = 'Continue',
  cancel = 'Cancel',
  closeOnEsc = true,
  closeOnBackdropClick = true,
  onResolve,
}) => {
  return (
    <Fragment>
      {isOpen && (
        <Modal
          header={header}
          tagline={tagline}
          closeOnEsc={closeOnEsc}
          closeOnBackdropClick={closeOnBackdropClick}
          footer={
            <Fragment>
              <button className="slds-button slds-button_neutral" onClick={() => onResolve(false)}>
                {cancel}
              </button>
              <button className="slds-button slds-button_brand" onClick={() => onResolve(true)}>
                {confirm}
              </button>
            </Fragment>
          }
          onClose={() => onResolve(false)}
        >
          <div>{content}</div>
        </Modal>
      )}
    </Fragment>
  );
};

export const ConfirmationModalPromise = createModal<ConfirmationModalProps, boolean>(ConfirmationModal);
