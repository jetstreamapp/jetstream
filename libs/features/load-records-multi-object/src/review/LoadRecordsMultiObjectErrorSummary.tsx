import { css } from '@emotion/react';
import { ScopedNotification } from '@jetstream/ui';
import groupBy from 'lodash/groupBy';
import { FunctionComponent } from 'react';
import { LoadMultiObjectDataError } from '../load-records-multi-object-types';
import { getErrorLocationLabel } from './review-utils';

export interface LoadRecordsMultiObjectErrorSummaryProps {
  errors: LoadMultiObjectDataError[];
  warnings: LoadMultiObjectDataError[];
  /** Called when the user clicks an error's worksheet - switches the preview to that sheet's tab */
  onSelectWorksheet: (worksheet: string) => void;
}

/** All validation problems grouped by worksheet, each acting as a jump-link to the offending sheet */
export const LoadRecordsMultiObjectErrorSummary: FunctionComponent<LoadRecordsMultiObjectErrorSummaryProps> = ({
  errors,
  warnings,
  onSelectWorksheet,
}) => {
  const errorsByWorksheet = groupBy(errors, 'worksheet');

  return (
    <div className="slds-m-vertical_x-small">
      {errors.length > 0 && (
        <ScopedNotification theme="error">
          <p className="slds-text-heading_small slds-m-bottom_x-small">Fix these problems in your file, then upload it again:</p>
          {Object.entries(errorsByWorksheet).map(([worksheet, worksheetErrors]) => (
            <div key={worksheet} className="slds-m-bottom_x-small">
              <button
                type="button"
                className="slds-button"
                css={css`
                  font-weight: bold;
                `}
                onClick={() => onSelectWorksheet(worksheet)}
              >
                {worksheet}
              </button>
              <ul className="slds-list_dotted">
                {worksheetErrors.map((error, i) => (
                  <li key={i}>
                    {error.message} {getErrorLocationLabel(error)}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </ScopedNotification>
      )}
      {warnings.length > 0 && (
        <ScopedNotification theme="warning" className={errors.length ? 'slds-m-top_x-small' : undefined}>
          <ul className={warnings.length > 1 ? 'slds-list_dotted' : undefined}>
            {warnings.map((warning, i) => (
              <li key={i}>{warning.message}</li>
            ))}
          </ul>
        </ScopedNotification>
      )}
    </div>
  );
};

export default LoadRecordsMultiObjectErrorSummary;
