import { css } from '@emotion/react';
import { formatNumber } from '@jetstream/shared/ui-utils';
import { Grid, ProgressIndicator, Spinner } from '@jetstream/ui';
import { FunctionComponent } from 'react';
import { OrgAlignmentProgress } from './orgAlignmentTypes';

export interface OrgAlignmentProgressBarProps {
  progress: OrgAlignmentProgress;
}

/** Shown while a comparison is running and after it was canceled */
export const OrgAlignmentProgressBar: FunctionComponent<OrgAlignmentProgressBarProps> = ({ progress }) => {
  if (!progress.running && progress.phase !== 'canceled') {
    return null;
  }

  // The number of types is not known until both orgs have been described
  const fallbackPercent = progress.running ? 10 : 0;
  const progressPercent = progress.totalTypes > 0 ? Math.round((progress.completedTypes / progress.totalTypes) * 100) : fallbackPercent;

  return (
    <div className="slds-box slds-theme_default slds-m-bottom_small">
      <Grid align="spread" verticalAlign="center" className="slds-m-bottom_xx-small">
        <Grid verticalAlign="center">
          {progress.running && (
            <div
              className="slds-is-relative slds-m-right_small"
              css={css`
                width: 1.25rem;
                height: 1.25rem;
                /* Own stacking context, the spinner's z-index would otherwise put it above an open modal */
                z-index: 0;
              `}
            >
              <Spinner size="x-small" />
            </div>
          )}
          <strong>{progress.detailMessage || 'Comparing orgs...'}</strong>
        </Grid>
        <span className="slds-text-body_small slds-text-color_weak">
          {formatNumber(progress.completedTypes)} / {formatNumber(progress.totalTypes)} types ({progressPercent}%)
        </span>
      </Grid>
      <ProgressIndicator
        label="Org alignment comparison progress"
        currentValue={progressPercent}
        isIndeterminate={progress.phase === 'describing'}
      />
    </div>
  );
};

export default OrgAlignmentProgressBar;
