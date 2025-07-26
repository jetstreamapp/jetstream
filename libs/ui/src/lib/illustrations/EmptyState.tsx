import classNames from 'classnames';
import React, { FunctionComponent } from 'react';
import NoContentIllustration from '../illustrations/NoContentIllustration';

export interface EmptyStateProps {
  omitIllustration?: boolean;
  illustration?: React.ReactNode;
  size?: 'small' | 'large';
  headline?: string;
  subHeading?: string;
  children?: React.ReactNode;
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
          className={classNames('slds-illustration w-100', {
            'slds-illustration_small': size === 'small',
            'slds-illustration_large': size === 'large',
          })}
        >
          {illustration}
          {headline && (
            <div className="slds-text-longform">
              <h3 className="slds-text-heading_medium slds-m-bottom_x-small">{headline}</h3>
              {subHeading && <p className="slds-text-body_regular slds-m-bottom_x-small">{subHeading}</p>}
            </div>
          )}
          <div>{children}</div>
        </div>
      )}
      {(omitIllustration || !illustration) && (
        <div>
          {headline && (
            <div className="slds-text-longform">
              <h3 className="slds-text-heading_medium slds-m-bottom_x-small">{headline}</h3>
              {subHeading && <p className="slds-text-body_regular slds-m-bottom_x-small">{subHeading}</p>}
            </div>
          )}
          <div>{children}</div>
        </div>
      )}
    </div>
  );
};

export default EmptyState;
