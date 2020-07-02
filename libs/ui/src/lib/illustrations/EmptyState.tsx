import React, { FunctionComponent } from 'react';
import image from '../../assets/empty-safe.svg';

export interface EmptyStateProps {
  showIllustration?: boolean;
  imageWidth?: number;
  headline?: string;
  callToAction?: React.ReactNode; // could implement
}

/**
 * This is used when a button is inline on a form where there needs to be top-margin to align with the inputs
 * (e.x. ExpressionConditionRow)
 */
export const EmptyState: FunctionComponent<EmptyStateProps> = ({
  showIllustration = true,
  imageWidth = 300,
  headline,
  callToAction,
  children,
}) => {
  return (
    <div className="slds-grid slds-grid_vertical slds-grid_vertical-align-center slds-text-align_center slds-p-vertical--small">
      {showIllustration && <img className="slds-col slds-p-bottom_medium" width={imageWidth} src={image} alt="Empty State" />}
      {headline && <div className="slds-col slds-text-heading_medium slds-p-bottom_x-small">{headline}</div>}
      <div className="slds-col slds-text-body_small">{children}</div>
      {callToAction && <div className="slds-col slds-p-top_x-small">{callToAction}</div>}
    </div>
  );
};

export default EmptyState;
