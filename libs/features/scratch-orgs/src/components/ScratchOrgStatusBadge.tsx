import { css } from '@emotion/react';
import type { BadgeType } from '@jetstream/types';
import { Badge, Grid, Spinner, Tooltip } from '@jetstream/ui';
import { FunctionComponent } from 'react';
import type { ScratchOrgDisplayStatus, ScratchOrgRow } from '../scratch-org.types';
import { getSignupErrorMessage } from '../scratch-org.utils';
import type { PendingScratchOrgStep } from '../useScratchOrgActions';

const BADGE_TYPES: Record<ScratchOrgDisplayStatus, BadgeType> = {
  Active: 'success',
  Creating: 'light',
  Error: 'error',
  Expired: 'warning',
  Deleted: 'inverse',
};

const PENDING_STEP_LABELS: Record<PendingScratchOrgStep, string> = {
  creating: 'Creating',
  connecting: 'Connecting',
  'deploying-settings': 'Deploying settings',
};

export interface ScratchOrgStatusBadgeProps {
  row: ScratchOrgRow;
  /** Set while this page is finishing the setup of a scratch org it requested */
  pendingStep?: PendingScratchOrgStep;
}

export const ScratchOrgStatusBadge: FunctionComponent<ScratchOrgStatusBadgeProps> = ({ row, pendingStep }) => {
  const { displayStatus, ErrorCode } = row;

  if (pendingStep || displayStatus === 'Creating') {
    return (
      <Grid verticalAlign="center" noWrap>
        <div
          className="slds-is-relative slds-m-right_x-small"
          css={css`
            width: 1.25rem;
            height: 1.25rem;
            flex-shrink: 0;
          `}
        >
          <Spinner size="x-small" />
        </div>
        <span>{PENDING_STEP_LABELS[pendingStep ?? 'creating']}</span>
      </Grid>
    );
  }

  if (displayStatus === 'Error') {
    return (
      <Tooltip content={getSignupErrorMessage(ErrorCode)}>
        <Badge type="error">Failed{ErrorCode ? ` · ${ErrorCode}` : ''}</Badge>
      </Tooltip>
    );
  }

  return <Badge type={BADGE_TYPES[displayStatus]}>{displayStatus}</Badge>;
};

export default ScratchOrgStatusBadge;
