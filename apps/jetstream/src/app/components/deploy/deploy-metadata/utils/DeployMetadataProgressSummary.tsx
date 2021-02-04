import { pluralizeFromNumber } from '@jetstream/shared/utils';
import { DeployResultStatus } from '@jetstream/types';
import { Grid, ProgressRing } from '@jetstream/ui';
import React, { FunctionComponent, useEffect, useState } from 'react';
import classNames from 'classnames';

export interface DeployMetadataProgressSummaryProps {
  className?: string;
  title: string;
  status: DeployResultStatus;
  totalProcessed: number;
  totalErrors: number;
  totalItems: number;
}

export const DeployMetadataProgressSummary: FunctionComponent<DeployMetadataProgressSummaryProps> = ({
  className,
  title,
  status,
  totalProcessed,
  totalErrors,
  totalItems,
}) => {
  const [fillPercent, setFillPercent] = useState(0);
  const [componentSummary, setComponentSummary] = useState('');
  const [theme, setTheme] = useState<'warning' | 'expired' | 'complete'>();

  // ensure numbers just in case SFDC returns strings
  totalProcessed = Number(totalProcessed || 0);
  totalErrors = Number(totalErrors || 0);
  totalItems = Number(totalItems || 0);

  useEffect(() => {
    if (status === 'Pending') {
      if (theme !== null) {
        setTheme(null);
      }
    } else if (status === 'InProgress') {
      if (!totalErrors && theme !== null) {
        setTheme(null);
      } else if (totalErrors && theme !== 'warning') {
        setTheme('warning');
      }
    } else if (status === 'Succeeded' || status === 'SucceededPartial' || status === 'Failed') {
      if (totalErrors) {
        setTheme('warning');
      } else {
        setTheme('complete');
      }
      setFillPercent(1);
    }
  }, [status, theme, totalErrors]);

  useEffect(() => {
    let total = totalItems;
    if (totalProcessed > totalItems) {
      total = totalProcessed;
    }
    if (total === 0) {
      total = 1;
    }
    setFillPercent((totalProcessed + totalErrors) / total);
    setComponentSummary(`${totalProcessed + totalErrors} / ${total}`);
  }, [totalProcessed, totalErrors, totalItems]);

  return (
    <Grid vertical className={className}>
      <span className="slds-align-middle slds-text-title_caps">{title}</span>
      <ProgressRing className="slds-m-vertical_x-small slds-align-middle" fillPercent={fillPercent} size="x-large" theme={theme}>
        <small>{Math.round(fillPercent * 100)}%</small>
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
    </Grid>
  );
};

export default DeployMetadataProgressSummary;
