import { css } from '@emotion/react';
import { Grid, Tooltip } from '@jetstream/ui';
import classNames from 'classnames';
import { FunctionComponent } from 'react';
import type { DevHubScratchOrgLimits } from '../scratch-org.types';

export interface ScratchOrgLimitsProps {
  limits: DevHubScratchOrgLimits;
}

const LimitItem: FunctionComponent<{ label: string; description: string; limit: { max: number; remaining: number } }> = ({
  label,
  description,
  limit,
}) => {
  const used = Math.max(limit.max - limit.remaining, 0);
  const percentUsed = limit.max > 0 ? Math.min((used / limit.max) * 100, 100) : 0;
  const isExhausted = limit.remaining <= 0;
  return (
    <Tooltip content={`${description} ${limit.remaining.toLocaleString()} remaining.`}>
      <div
        css={css`
          min-width: 8rem;
        `}
      >
        <Grid align="spread" className="slds-text-body_small">
          <span className="slds-text-color_weak">{label}</span>
          <span className={classNames('slds-m-left_small', { 'slds-text-color_error': isExhausted })}>
            {used.toLocaleString()} / {limit.max.toLocaleString()}
          </span>
        </Grid>
        <div
          className="slds-progress-bar slds-progress-bar_small slds-progress-bar_circular"
          role="progressbar"
          aria-label={`${label}, ${used} of ${limit.max} used`}
          aria-valuemin={0}
          aria-valuemax={limit.max}
          aria-valuenow={used}
        >
          <span
            className={classNames('slds-progress-bar__value', { 'slds-progress-bar__value_success': !isExhausted })}
            css={css`
              width: ${percentUsed}%;
              ${isExhausted ? 'background: var(--slds-g-color-error-base-40, #ea001e);' : ''}
            `}
          />
        </div>
      </div>
    </Tooltip>
  );
};

/** How much of the Dev Hub's scratch org allocations are in use, hidden when the org does not report them */
export const ScratchOrgLimits: FunctionComponent<ScratchOrgLimitsProps> = ({ limits }) => {
  if (!limits.active && !limits.daily) {
    return null;
  }
  return (
    <Grid
      verticalAlign="center"
      css={css`
        gap: 1rem;
      `}
    >
      {limits.active && (
        <LimitItem label="Active" description="Scratch orgs that can exist at the same time in this Dev Hub." limit={limits.active} />
      )}
      {limits.daily && (
        <LimitItem label="Created today" description="Scratch orgs that can be created in a rolling 24 hours." limit={limits.daily} />
      )}
    </Grid>
  );
};

export default ScratchOrgLimits;
