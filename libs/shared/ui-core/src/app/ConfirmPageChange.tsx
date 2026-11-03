import { useGlobalEventHandler } from '@jetstream/shared/ui-utils';
import * as fromAppState from '@jetstream/ui/app-state';
import { useSetAtom } from 'jotai';
import { FunctionComponent, useCallback, useEffect } from 'react';

export interface ConfirmPageChangeProps {
  actionInProgress: boolean;
}

/**
 * Warns before the browser tab is closed or refreshed while `actionInProgress` is true, and flags the in-progress
 * action in the store so other places (e.g. the org dropdown) can lock themselves.
 *
 * Several instances can be mounted at once (a page and a modal on that page), so each one only adds to and removes
 * from a shared count on its own transitions instead of reconciling a global boolean against its prop.
 */
export const ConfirmPageChange: FunctionComponent<ConfirmPageChangeProps> = ({ actionInProgress }) => {
  const setActionInProgressCount = useSetAtom(fromAppState.actionInProgressCountState);
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
    [actionInProgress],
  );

  useGlobalEventHandler('beforeunload', beforeUnload);

  // The cleanup also runs on unmount, so an instance that goes away mid-action releases its count
  useEffect(() => {
    if (!actionInProgress) {
      return;
    }
    setActionInProgressCount((count) => count + 1);
    return () => setActionInProgressCount((count) => Math.max(0, count - 1));
  }, [actionInProgress, setActionInProgressCount]);

  return null;
};

export default ConfirmPageChange;
