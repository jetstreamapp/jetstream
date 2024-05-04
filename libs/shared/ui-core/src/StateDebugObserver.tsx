import { logger } from '@jetstream/shared/client-logger';
import { FunctionComponent } from 'react';
import { RecoilValue, useRecoilTransactionObserver_UNSTABLE } from 'recoil';

interface StateDebugObserverProps {
  name?: string;
  atoms: [string, RecoilValue<unknown>][];
}

/**
 * Log the passed in atoms
 * the effect is not initialized if the logger is disabled
 */
export const StateDebugObserver: FunctionComponent<StateDebugObserverProps> = ({ name = 'SNAPSHOT', atoms }) => {
  if (logger.isEnabled) {
    // FIXME: should not be conditionally called
    // eslint-disable-next-line react-hooks/rules-of-hooks
    useRecoilTransactionObserver_UNSTABLE(({ snapshot }) => {
      logger.log(
        `[${name}]`,
        atoms.map(([name, atom]) => ({ name, value: snapshot.getLoadable(atom).contents }))
      );
    });
  }
  return null;
};
