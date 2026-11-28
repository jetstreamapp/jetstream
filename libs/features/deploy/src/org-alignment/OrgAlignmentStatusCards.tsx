import { css } from '@emotion/react';
import { formatNumber } from '@jetstream/shared/ui-utils';
import { OrgAlignmentRunSummaryCounts } from '@jetstream/types';
import { Grid } from '@jetstream/ui';
import classNames from 'classnames';
import { FunctionComponent } from 'react';
import { STATUS_LABELS } from './OrgAlignmentComponentsTable';
import { OrgAlignmentDiffStatus } from './orgAlignmentTypes';

export interface OrgAlignmentStatusCardsProps {
  summaryCounts: OrgAlignmentRunSummaryCounts;
  /** Number of metadata types that were skipped because they cannot be compared */
  uncomparableTypesCount: number;
  activeStatus: 'ALL' | OrgAlignmentDiffStatus;
  onStatusClick: (status: OrgAlignmentDiffStatus) => void;
}

/** Totals of a comparison, each card also filters the components to its status */
export const OrgAlignmentStatusCards: FunctionComponent<OrgAlignmentStatusCardsProps> = ({
  summaryCounts,
  uncomparableTypesCount,
  activeStatus,
  onStatusClick,
}) => {
  const statusCards: { status: OrgAlignmentDiffStatus; count: number; countClassName?: string; footnote?: string }[] = [
    { status: 'different', count: summaryCounts.different, countClassName: 'slds-text-color_error' },
    { status: 'onlyInSource', count: summaryCounts.onlyInSource },
    { status: 'onlyInTarget', count: summaryCounts.onlyInTarget },
    { status: 'same', count: summaryCounts.same, countClassName: 'slds-text-color_success' },
    {
      status: 'uncomparable',
      count: summaryCounts.uncomparable,
      countClassName: 'slds-text-color_weak',
      footnote:
        summaryCounts.managedSkipped + uncomparableTypesCount > 0
          ? [
              summaryCounts.managedSkipped > 0 ? `${formatNumber(summaryCounts.managedSkipped)} managed skipped` : null,
              uncomparableTypesCount > 0
                ? `${formatNumber(uncomparableTypesCount)} ${uncomparableTypesCount === 1 ? 'type' : 'types'} skipped`
                : null,
            ]
              .filter(Boolean)
              .join(', ')
          : undefined,
    },
  ];

  return (
    <div
      className="slds-m-bottom_small"
      css={css`
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
        gap: 0.5rem;
      `}
    >
      {statusCards.map(({ status, count, countClassName, footnote }) => {
        const isActive = activeStatus === status;
        return (
          <button
            key={status}
            type="button"
            className="slds-box slds-box_x-small slds-theme_default slds-text-align_left cursor-pointer"
            css={css`
              ${isActive ? 'border-color: var(--slds-g-color-brand-base-50, #0176d3); box-shadow: 0 0 0 1px var(--slds-g-color-brand-base-50, #0176d3);' : ''}
            `}
            aria-pressed={isActive}
            title={isActive ? 'Show every status' : `Show the components that are ${STATUS_LABELS[status]}`}
            onClick={() => onStatusClick(status)}
          >
            <div className="slds-text-title_caps slds-text-color_weak">{STATUS_LABELS[status]}</div>
            <Grid verticalAlign="end">
              <span className={classNames('slds-text-heading_medium', countClassName)}>{formatNumber(count)}</span>
              {footnote && <span className="slds-m-left_x-small slds-text-body_small slds-text-color_weak">{footnote}</span>}
            </Grid>
          </button>
        );
      })}
    </div>
  );
};

export default OrgAlignmentStatusCards;
