import type { StepUpPurpose } from '@jetstream/auth/types';
import { StepUpCancelledError, StepUpRequiredError } from '@jetstream/shared/data';
import { useCallback, useSyncExternalStore } from 'react';
import { StepUpAuthModalPromise } from './StepUpAuthModal';

/**
 * The grant from this tab's most recent verification. The server honours it for every protected
 * action until it expires, so sending it back spares the user a prompt for each change in a row.
 *
 * Module memory only - never storage - so the nonce stays with the tab that verified, as the server
 * expects (see SessionData.stepUpAuth), and a reload simply prompts again.
 */
let activeGrant: { stepUpNonce: string; expiresAt: number } | null = null;

function getActiveStepUpNonce(): string | undefined {
  if (activeGrant && activeGrant.expiresAt <= Date.now()) {
    activeGrant = null;
  }
  return activeGrant?.stepUpNonce;
}

/**
 * Whether the identity prompt is open, shared rather than per hook so that a spinner owned by a
 * different component than the one that triggered the prompt can still get out of its way.
 */
let isPromptOpen = false;
const promptOpenListeners = new Set<() => void>();

function setPromptOpen(value: boolean) {
  isPromptOpen = value;
  promptOpenListeners.forEach((listener) => listener());
}

function subscribeToPromptOpen(listener: () => void) {
  promptOpenListeners.add(listener);
  return () => {
    promptOpenListeners.delete(listener);
  };
}

export function useStepUpAuth() {
  // Callers hide their own loading spinner while this is true, so it does not sit behind the prompt
  const isPrompting = useSyncExternalStore(subscribeToPromptOpen, () => isPromptOpen);

  /**
   * Runs an action that may require re-authentication, prompting for it only if the server asks.
   *
   * The action is attempted first, with this tab's grant if it has one, rather than pre-emptively
   * prompting: a route that turns out not to need a grant, or a grant that is still valid, costs no
   * extra interaction.
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
        return await fn({ stepUpNonce: getActiveStepUpNonce() });
      } catch (ex) {
        if (!(ex instanceof StepUpRequiredError)) {
          throw ex;
        }

        // Expired on the server, or replaced by a verification in another tab
        activeGrant = null;

        setPromptOpen(true);
        let result: Awaited<ReturnType<typeof StepUpAuthModalPromise>>;
        try {
          result = await StepUpAuthModalPromise({ purpose, header, description });
        } finally {
          setPromptOpen(false);
        }

        if (result.cancelled) {
          throw new StepUpCancelledError();
        }

        activeGrant = { stepUpNonce: result.stepUpNonce, expiresAt: new Date(result.expiresAt).getTime() };

        // Exactly one retry. A second rejection is a real error and must propagate - looping here
        // would trap the user in an endless prompt.
        return await fn({ stepUpNonce: result.stepUpNonce });
      }
    },
    [],
  );

  return { runWithStepUp, isPrompting };
}
