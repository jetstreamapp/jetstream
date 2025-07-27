import { OverlayProvider } from '@react-aria/overlays';
import { Fragment, FunctionComponent } from 'react';
import { create, InstanceProps } from 'react-modal-promise';
import Modal, { ModalProps } from './Modal';

type CommonModalProps = Pick<ModalProps, 'header' | 'tagline' | 'closeOnEsc' | 'closeOnBackdropClick'> & InstanceProps<boolean, never>;

export interface ConfirmationModalProps extends CommonModalProps {
  isOpen: boolean;
  instanceId: any;
  content: string | React.ReactNode;
  confirm?: string | React.ReactNode;
  cancel?: string | React.ReactNode;
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
    <OverlayProvider>
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
    </OverlayProvider>
  );
};

export const ConfirmationModalPromise = create<ConfirmationModalProps, boolean>(ConfirmationModal);
