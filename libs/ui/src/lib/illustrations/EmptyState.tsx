import React, { FunctionComponent } from 'react';
import classNames from 'classnames';
import NoContentIllustration from 'libs/ui/src/lib/illustrations/NoContentIllustration';

export interface EmptyStateProps {
  omitIllustration?: boolean;
  illustration?: JSX.Element;
  size?: 'small' | 'large';
  headline?: string;
  subHeading?: string;
}

/**
 * This is used when a button is inline on a form where there needs to be top-margin to align with the inputs
 * (e.x. ExpressionConditionRow)
 */
export const EmptyState: FunctionComponent<EmptyStateProps> = ({
  omitIllustration,
  illustration = <NoContentIllustration />,
  size = 'small',
  headline,
  subHeading,
  children,
}) => {
  return (
    <div className="slds-grid slds-grid_vertical slds-grid_vertical-align-center slds-text-align_center slds-p-vertical--small">
      {!omitIllustration && illustration && (
        <div
          className={classNames('slds-illustration', {
            'slds-illustration_small': size === 'small',
            'slds-illustration_large': size === 'large',
          })}
        >
          {illustration}
        </div>
      )}
      {headline && (
        <div className="slds-text-longform">
          <h3 className="slds-text-heading_medium">{headline}</h3>
          {subHeading && <p className="slds-text-body_regular">{subHeading}</p>}
        </div>
      )}
      <div>{children}</div>
    </div>
  );
};

export default EmptyState;
