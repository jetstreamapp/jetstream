import type { UserProfileUiWithIdentities } from '@jetstream/auth/types';
import { ANALYTICS_KEYS } from '@jetstream/shared/constants';
import { cancelEmailChange, getFullUserProfile, requestEmailChange, StepUpCancelledError } from '@jetstream/shared/data';
import { useAmplitude, useStepUpAuth } from '@jetstream/ui-core';
import { useCallback } from 'react';

/**
 * Email-change actions for the profile page. Kept out of Profile.tsx, which already carries every
 * other profile mutation inline.
 */
export function useEmailChange({ onProfileUpdated }: { onProfileUpdated: (profile: UserProfileUiWithIdentities) => void }) {
  const { trackEvent } = useAmplitude();
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
      trackEvent(ANALYTICS_KEYS.settings_email_change_action, { action: 'request' });
      return true;
    },
    [onProfileUpdated, runWithStepUp, trackEvent],
  );

  const cancelChange = useCallback(async () => {
    await cancelEmailChange();
    onProfileUpdated(await getFullUserProfile());
    trackEvent(ANALYTICS_KEYS.settings_email_change_action, { action: 'cancel' });
  }, [onProfileUpdated, trackEvent]);

  return { requestChange, cancelChange };
}
