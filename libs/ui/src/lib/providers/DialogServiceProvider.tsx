import {
  Dispatch,
  Fragment,
  FunctionComponent,
  ReactNode,
  SetStateAction,
  createContext,
  useCallback,
  useContext,
  useRef,
  useState,
} from 'react';
import ConfirmationDialog, { ConfirmationDialogServiceProviderOptions } from '../confirmation-dialog/ConfirmationDialog';

interface ConfirmationServiceContextValue {
  confirm: (options: ConfirmationDialogServiceProviderOptions) => Promise<ConfirmationDialogServiceProviderOptions['data']>;
  setOptions: Dispatch<SetStateAction<ConfirmationDialogServiceProviderOptions | null>>;
}

// https://dev.to/dmtrkovalenko/the-neatest-way-to-handle-alert-dialogs-in-react-1aoe
export const ConfirmationServiceContext = createContext<ConfirmationServiceContextValue>({
  confirm: (options: ConfirmationDialogServiceProviderOptions) => Promise.resolve(options?.data || {}),
  // eslint-disable-next-line @typescript-eslint/no-empty-function
  setOptions: (options: ConfirmationDialogServiceProviderOptions) => {},
});

export const useConfirmation = () => useContext(ConfirmationServiceContext);

export interface ConfirmationServiceProviderProps {
  children?: ReactNode;
}

export const ConfirmationServiceProvider: FunctionComponent<ConfirmationServiceProviderProps> = ({ children }) => {
  const [confirmationState, setConfirmationState] = useState<ConfirmationDialogServiceProviderOptions | null>(null);

  const awaitingPromiseRef = useRef<{
    resolve: (data: ConfirmationDialogServiceProviderOptions['data']) => void;
    reject: () => void;
  }>();

  const openConfirmation = useCallback((options: ConfirmationDialogServiceProviderOptions) => {
    setConfirmationState(options);
    return new Promise<ConfirmationDialogServiceProviderOptions>((resolve, reject) => {
      awaitingPromiseRef.current = { resolve, reject };
    });
  }, []);

  const contextValue = useRef<ConfirmationServiceContextValue>({
    confirm: openConfirmation,
    setOptions: setConfirmationState,
  });

  const handleClose = () => {
    if (awaitingPromiseRef.current) {
      awaitingPromiseRef.current.reject();
    }
    setConfirmationState(null);
  };

  const handleConfirm = () => {
    if (awaitingPromiseRef.current) {
      awaitingPromiseRef.current.resolve(confirmationState?.data || {});
    }
    setConfirmationState(null);
  };

  return (
    <Fragment>
      <ConfirmationServiceContext.Provider value={contextValue.current} children={children} />

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
