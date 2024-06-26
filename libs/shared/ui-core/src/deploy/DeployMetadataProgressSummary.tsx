import { pluralizeFromNumber } from '@jetstream/shared/utils';
import { DeployResultStatus } from '@jetstream/types';
import { Grid, ProgressRing, Spinner } from '@jetstream/ui';
import classNames from 'classnames';
import React, { FunctionComponent, useEffect, useReducer } from 'react';

type Action = { type: 'CHANGE'; payload: { status: DeployResultStatus; totalProcessed: number; totalErrors: number; totalItems: number } };

interface State {
  fillPercent: number;
  componentSummary: string;
  theme: 'warning' | 'expired' | 'complete' | null;
  showPercentage: boolean;
  showSpinner: boolean;
}

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'CHANGE': {
      const { status } = action.payload;
      const totalProcessed = Number(action.payload.totalProcessed || 0);
      const totalErrors = Number(action.payload.totalErrors || 0);
      const totalItems = Number(action.payload.totalItems || 0);
      const newState = { ...state };

      /**
       * HANDLE STATUS CHANGE
       */
      if (status === 'Pending') {
        if (newState.theme != null) {
          newState.theme = null;
        }
      } else if (status === 'InProgress') {
        if (!totalErrors && newState.theme !== null) {
          // set to normal green progress
          newState.theme = null;
        } else if (totalErrors && newState.theme !== 'warning') {
          newState.theme = 'warning';
        }
      } else if (status === 'Succeeded' || status === 'SucceededPartial' || status === 'Failed') {
        if (totalErrors) {
          newState.theme = 'warning';
        } else {
          newState.theme = 'complete';
        }
        newState.fillPercent = 1;
      } else if (status === 'Canceled') {
        newState.theme = 'expired';
        newState.fillPercent = 1;
      }

      /**
       * HANDLE PERCENTAGE CALCULATION
       */
      let total = totalItems;
      if (totalProcessed > totalItems) {
        total = totalProcessed;
      }
      if (total === 0) {
        total = 1;
      }
      newState.componentSummary = `${totalProcessed + totalErrors} / ${total}`;
      newState.fillPercent = (totalProcessed + totalErrors) / total;

      if (newState.fillPercent === 1 && newState.theme !== 'complete' && newState.theme !== 'warning') {
        // we are at 100% but we are not done yet, show spinner
        newState.showPercentage = false;
        newState.showSpinner = true;
      } else {
        newState.showPercentage = true;
        newState.showSpinner = false;
      }

      return newState;
    }
    default:
      throw new Error('Invalid action');
  }
}

export interface DeployMetadataProgressSummaryProps {
  className?: string;
  size?: 'medium' | 'large' | 'x-large';
  title: string;
  status: DeployResultStatus;
  totalProcessed: number;
  totalErrors: number;
  totalItems: number;
}

export const DeployMetadataProgressSummary: FunctionComponent<DeployMetadataProgressSummaryProps> = ({
  className,
  size = 'x-large',
  title,
  status,
  totalProcessed,
  totalErrors,
  totalItems,
}) => {
  const [{ fillPercent, componentSummary, theme, showPercentage, showSpinner }, dispatch] = useReducer(reducer, {
    fillPercent: 0,
    componentSummary: '',
    theme: null,
    showPercentage: true,
    showSpinner: false,
  });

  useEffect(() => {
    dispatch({
      type: 'CHANGE',
      payload: {
        status,
        totalProcessed,
        totalErrors,
        totalItems,
      },
    });
  }, [status, totalProcessed, totalErrors, totalItems]);

  return (
    <Grid vertical className={className}>
      <span className="slds-align-middle slds-text-title_caps">{title}</span>
      <ProgressRing className="slds-m-vertical_x-small slds-align-middle" fillPercent={fillPercent} size={size} theme={theme}>
        {showPercentage && (
          <small>
            <strong>{Math.round(fillPercent * 100)}%</strong>
          </small>
        )}
        {showSpinner && <Spinner size="small" inline />}
      </ProgressRing>
      <span className="slds-align-middle">{componentSummary}</span>
      <span
        className={classNames('slds-align-middle', {
          'slds-text-color_success': totalErrors === 0,
          'slds-text-color_error': totalErrors > 0,
        })}
      >
        {totalErrors} {pluralizeFromNumber('Error', totalErrors)}
      </span>
      {status === 'Canceled' && <span className="slds-text-color_error">Deployment was cancelled</span>}
    </Grid>
  );
};

export default DeployMetadataProgressSummary;
