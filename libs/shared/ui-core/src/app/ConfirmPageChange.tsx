import { useGlobalEventHandler } from '@jetstream/shared/ui-utils';
import { Fragment, FunctionComponent, useCallback, useEffect } from 'react';
import { useRecoilState } from 'recoil';
import * as fromAppState from '../state-management/app-state';
import { usePrompt } from './PromptNavigation';

export interface ConfirmPageChangeProps {
  actionInProgress: boolean;
  message?: string;
}

export const ConfirmPageChange: FunctionComponent<ConfirmPageChangeProps> = ({
  actionInProgress,
  message = 'You have work in progress, are you sure you want to leave this page?',
}) => {
  // the store tracks this to allow various places (e.x. org dropdown) to know that actions are in progress
  const [actionInProgressState, setActionInProgressState] = useRecoilState<boolean>(fromAppState.actionInProgressState);
  // give prompt before page refresh or browser tab being closed
  const beforeUnload = useCallback(
    (event: BeforeUnloadEvent) => {
      if (actionInProgress) {
        event.preventDefault();
        event.returnValue = '';
      } else {
        delete event['returnValue'];
      }
    },
    [actionInProgress]
  );

  useGlobalEventHandler('beforeunload', beforeUnload);

  // If page does change, then make sure to reset store
  useEffect(() => {
    return () => setActionInProgressState(false);
  }, []);

  /**
   * Ensure that state matches what is happening
   */
  useEffect(() => {
    if (actionInProgress && !actionInProgressState) {
      setActionInProgressState(true);
    } else if (!actionInProgress && actionInProgressState) {
      setActionInProgressState(false);
    }
  }, [actionInProgress, actionInProgressState]);

  const prompt = usePrompt(message, actionInProgress);

  // TODO: fix this
  return <Fragment />;
  // return <Prompt when={actionInProgress} message={message} />;
};

export default ConfirmPageChange;
