import { Maybe, UserProfileUi } from '@jetstream/types';
import { Alert } from '@jetstream/ui';
import { useState } from 'react';

interface UnverifiedEmailAlertProps {
  userProfile: Maybe<UserProfileUi>;
}

const LS_KEY = 'unverified_email_dismissed';

export function UnverifiedEmailAlert({ userProfile }: UnverifiedEmailAlertProps) {
  const [dismissed, setDismissed] = useState(() => localStorage.getItem(LS_KEY) === 'true');

  if (!userProfile || userProfile.email_verified || dismissed) {
    return null;
  }

  return (
    <Alert
      type="warning"
      leadingIcon="warning"
      allowClose
      onClose={() => {
        localStorage.setItem(LS_KEY, 'true');
        setDismissed(true);
      }}
    >
      We will soon be enabling two-factor authentication via email for all users. Verify your email address to avoid any interruptions.
    </Alert>
  );
}
