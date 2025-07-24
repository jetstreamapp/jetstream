import { Alert } from '@jetstream/ui';
import * as fromAppState from '@jetstream/ui/app-state';
import { useState } from 'react';
import { useAtom, useAtomValue, useSetAtom } from 'jotai';
import { useResetAtom } from 'jotai/utils';
import { useOrgPermissions } from '../orgs/useOrgPermissions';

interface RequireMetadataApiBannerProps {
  /**
   * Set to true if some features are available without the Metadata API
   */
  hasPartialAccess?: boolean;
}

export function RequireMetadataApiBanner({ hasPartialAccess }: RequireMetadataApiBannerProps) {
  const selectedOrg = useAtomValue(fromAppState.selectedOrgStateWithoutPlaceholder);
  const { hasMetadataAccess } = useOrgPermissions(selectedOrg);
  const [dismissed, setDismissed] = useState(false);

  if (hasMetadataAccess || dismissed) {
    return null;
  }

  if (hasPartialAccess) {
    return (
      <Alert type="warning" leadingIcon="warning" allowClose onClose={() => setDismissed(true)}>
        Some parts of this require the Metadata API and may not work correctly. To ensure you do not encounter any errors, you will need to
        have the ModifyAllData or ModifyMetadata permissions assigned to your user.
      </Alert>
    );
  }

  return (
    <Alert type="warning" leadingIcon="warning" allowClose onClose={() => setDismissed(true)}>
      This page requires the Metadata API which your user may not have access to. You will need to have the ModifyAllData or ModifyMetadata
      permissions assigned to your user.
    </Alert>
  );
}
