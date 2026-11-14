import type { UserProfileUiWithIdentities } from '@jetstream/auth/types';
import { cancelEmailChange, getFullUserProfile, requestEmailChange, StepUpCancelledError } from '@jetstream/shared/data';
import { useStepUpAuth } from '@jetstream/ui-core';
import { useCallback } from 'react';

/**
 * Email-change actions for the profile page. Kept out of Profile.tsx, which already carries every
 * other profile mutation inline.
 */
export function useEmailChange({ onProfileUpdated }: { onProfileUpdated: (profile: UserProfileUiWithIdentities) => void }) {
  const { runWithStepUp } = useStepUpAuth();

  /** @returns false when the user dismissed the step-up prompt, so the caller can stay on the form. */
  const requestChange = useCallback(
    async (newEmail: string): Promise<boolean> => {
      try {
        await runWithStepUp(({ stepUpNonce }) => requestEmailChange(newEmail, stepUpNonce), {
          purpose: 'CHANGE_EMAIL',
          header: "Confirm it's you",
          description: 'Changing your email address requires verifying your identity first.',
        });
      } catch (ex) {
        // Dismissing the prompt is a deliberate choice, not an error to report back.
        if (ex instanceof StepUpCancelledError) {
          return false;
        }
        throw ex;
      }
      onProfileUpdated(await getFullUserProfile());
      return true;
    },
    [onProfileUpdated, runWithStepUp],
  );

  const cancelChange = useCallback(async () => {
    await cancelEmailChange();
    onProfileUpdated(await getFullUserProfile());
  }, [onProfileUpdated]);

  return { requestChange, cancelChange };
}
