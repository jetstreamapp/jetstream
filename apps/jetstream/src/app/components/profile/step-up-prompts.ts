import type { StepUpPurpose } from '@jetstream/auth/types';

/**
 * Prompt copy for each account change that asks the user to verify their identity first.
 * Shared so the 2FA cards, the password actions and account deletion all read the same way.
 */
interface StepUpPrompt {
  purpose: StepUpPurpose;
  header: string;
  description: string;
}

export const MANAGE_2FA_STEP_UP: StepUpPrompt = {
  purpose: 'MANAGE_2FA',
  header: "Confirm it's you",
  description: 'Changing your two-factor authentication settings requires verifying your identity first.',
};

export const MANAGE_PASSWORD_STEP_UP: StepUpPrompt = {
  purpose: 'MANAGE_PASSWORD',
  header: "Confirm it's you",
  description: 'Changing your password settings requires verifying your identity first.',
};

export const DELETE_ACCOUNT_STEP_UP: StepUpPrompt = {
  purpose: 'DELETE_ACCOUNT',
  header: "Confirm it's you",
  description: 'Deleting your account requires verifying your identity first.',
};
