import { canPerformOperation, getUserAbility } from '@jetstream/acl';
import { ACCESS_PROFILE_OPERATION_NOT_ALLOWED_MESSAGES } from '@jetstream/types';
import { DEFAULT_PROFILE } from '@jetstream/ui/app-state';
import { useAtomValue } from 'jotai';
import { useMemo } from 'react';
import { UserProfileState } from '../utils/extension.store';

/**
 * Extension pages that run outside the Jetstream app state build their ability from the profile in extension
 * storage. A missing profile means no restrictions are known, which is full access.
 */
export function useHistorySyncAccess() {
  const userProfile = useAtomValue(UserProfileState);
  return useMemo(() => {
    const ability = getUserAbility({ user: userProfile ?? DEFAULT_PROFILE, isBrowserExtension: true });
    const allowed = canPerformOperation(ability, 'history.sync');
    return { allowed, deniedReason: allowed ? undefined : ACCESS_PROFILE_OPERATION_NOT_ALLOWED_MESSAGES['history.sync'] };
  }, [userProfile]);
}
