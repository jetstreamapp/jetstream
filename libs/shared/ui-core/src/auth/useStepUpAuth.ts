import type { StepUpPurpose } from '@jetstream/auth/types';
import { StepUpCancelledError, StepUpRequiredError } from '@jetstream/shared/data';
import { useCallback } from 'react';
import { StepUpAuthModalPromise } from './StepUpAuthModal';

export function useStepUpAuth() {
  /**
   * Runs an action that may require re-authentication, prompting for it only if the server asks.
   *
   * The action is attempted first rather than pre-emptively prompting, so a route that turns out not
   * to need a grant costs no extra interaction. There is deliberately no client-side grant cache: a
   * grant is consumed by the route that uses it, so a retained nonce could never be spent twice.
   *
   * @throws StepUpCancelledError if the user dismisses the prompt - call sites should swallow this
   * silently, since a cancel is not a failure.
   */
  const runWithStepUp = useCallback(
    async <T>(
      fn: (options: { stepUpNonce?: string }) => Promise<T>,
      { purpose, header, description }: { purpose: StepUpPurpose; header?: string; description?: React.ReactNode },
    ): Promise<T> => {
      try {
        return await fn({});
      } catch (ex) {
        if (!(ex instanceof StepUpRequiredError)) {
          throw ex;
        }

        const result = await StepUpAuthModalPromise({ purpose, header, description });

        if (result.cancelled) {
          throw new StepUpCancelledError();
        }

        // Exactly one retry. A second rejection is a real error and must propagate - looping here
        // would trap the user in an endless prompt.
        return await fn({ stepUpNonce: result.stepUpNonce });
      }
    },
    [],
  );

  return { runWithStepUp };
}
