import React, { Fragment, FunctionComponent } from 'react';
import ConfirmationDialog, { ConfirmationDialogServiceProviderOptions } from '../confirmation-dialog/ConfirmationDialog';

// https://dev.to/dmtrkovalenko/the-neatest-way-to-handle-alert-dialogs-in-react-1aoe
export const ConfirmationServiceContext = React.createContext<(options: ConfirmationDialogServiceProviderOptions) => Promise<void>>(
  Promise.reject
);

export const useConfirmation = () => React.useContext(ConfirmationServiceContext);

export interface ConfirmationServiceProviderProps {
  children?: React.ReactNode;
}

export const ConfirmationServiceProvider: FunctionComponent<ConfirmationServiceProviderProps> = ({ children }) => {
  const [confirmationState, setConfirmationState] = React.useState<ConfirmationDialogServiceProviderOptions | null>(null);

  const awaitingPromiseRef = React.useRef<{
    resolve: () => void;
    reject: () => void;
  }>();

  const openConfirmation = (options: ConfirmationDialogServiceProviderOptions) => {
    setConfirmationState(options);
    return new Promise<void>((resolve, reject) => {
      awaitingPromiseRef.current = { resolve, reject };
    });
  };

  const handleClose = () => {
    if (awaitingPromiseRef.current) {
      awaitingPromiseRef.current.reject();
    }
    setConfirmationState(null);
  };

  const handleConfirm = () => {
    if (awaitingPromiseRef.current) {
      awaitingPromiseRef.current.resolve();
    }
    setConfirmationState(null);
  };

  return (
    <Fragment>
      <ConfirmationServiceContext.Provider value={openConfirmation} children={children} />

      <ConfirmationDialog
        submitDisabled={!!confirmationState?.submitDisabled}
        isOpen={Boolean(confirmationState)}
        onCancel={handleClose}
        onConfirm={handleConfirm}
        header={confirmationState?.header}
        tagline={confirmationState?.tagline}
        cancelText={confirmationState?.cancelText}
        confirmText={confirmationState?.confirmText}
      >
        {confirmationState && confirmationState.content}
      </ConfirmationDialog>
    </Fragment>
  );
};
