import { Fragment, FunctionComponent } from 'react';
import { create, InstanceProps } from 'react-modal-promise';
import Modal, { ModalProps } from './Modal';

type CommonModalProps = Pick<ModalProps, 'header' | 'tagline' | 'closeOnEsc' | 'closeOnBackdropClick'> & InstanceProps<boolean, never>;

export interface ConfirmationModalProps extends CommonModalProps {
  isOpen: boolean;
  instanceId: any;
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

export const ConfirmationModalPromise = create<ConfirmationModalProps, boolean>(ConfirmationModal);
