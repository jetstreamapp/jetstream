import { css } from '@emotion/react';
import { ScopedNotification } from '@jetstream/ui';
import groupBy from 'lodash/groupBy';
import { FunctionComponent } from 'react';
import { LoadMultiObjectDataError } from '../load-records-multi-object-types';
import { getErrorLocationLabel, getWarningsKey } from './review-utils';

export interface LoadRecordsMultiObjectErrorSummaryProps {
  errors: LoadMultiObjectDataError[];
  warnings: LoadMultiObjectDataError[];
  /** Worksheets with a preview tab - problems on any other worksheet (e.g. a skipped sheet) cannot be jumped to */
  previewWorksheets: Set<string>;
  /** Called when the user clicks a problem's worksheet - switches the preview to that sheet's tab */
  onSelectWorksheet: (worksheet: string) => void;
  /** Called when the warnings are dismissed, which frees up vertical space for the preview grids */
  onWarningsDismissed: () => void;
}

function ProblemsByWorksheet({
  problems,
  previewWorksheets,
  onSelectWorksheet,
}: {
  problems: LoadMultiObjectDataError[];
  previewWorksheets: Set<string>;
  onSelectWorksheet: (worksheet: string) => void;
}) {
  const boldText = css`
    font-weight: bold;
  `;
  return (
    <>
      {Object.entries(groupBy(problems, 'worksheet')).map(([worksheet, worksheetProblems]) => (
        <div key={worksheet} className="slds-m-bottom_x-small">
          {previewWorksheets.has(worksheet) ? (
            <button type="button" className="slds-button" css={boldText} onClick={() => onSelectWorksheet(worksheet)}>
              {worksheet}
            </button>
          ) : (
            <span css={boldText}>{worksheet}</span>
          )}
          <ul className="slds-list_dotted">
            {worksheetProblems.map((problem, i) => (
              <li key={i}>
                {problem.message} {getErrorLocationLabel(problem)}
              </li>
            ))}
          </ul>
        </div>
      ))}
    </>
  );
}

/** All validation problems grouped by worksheet, each acting as a jump-link to the offending sheet */
export const LoadRecordsMultiObjectErrorSummary: FunctionComponent<LoadRecordsMultiObjectErrorSummaryProps> = ({
  errors,
  warnings,
  previewWorksheets,
  onSelectWorksheet,
  onWarningsDismissed,
}) => {
  if (!errors.length && !warnings.length) {
    return null;
  }

  return (
    <div className="slds-m-vertical_x-small">
      {errors.length > 0 && (
        <ScopedNotification theme="error">
          <p className="slds-text-heading_small slds-m-bottom_x-small">Fix these problems in your file, then upload it again:</p>
          <ProblemsByWorksheet problems={errors} previewWorksheets={previewWorksheets} onSelectWorksheet={onSelectWorksheet} />
        </ScopedNotification>
      )}
      {warnings.length > 0 && (
        <ScopedNotification
          theme="warning"
          className={errors.length ? 'slds-m-top_x-small' : undefined}
          allowClose
          dismissResetKey={getWarningsKey(warnings)}
          onClose={onWarningsDismissed}
        >
          <p className="slds-text-heading_small slds-m-bottom_x-small">
            These will not stop the load, everything else in your file will still be loaded:
          </p>
          <ProblemsByWorksheet problems={warnings} previewWorksheets={previewWorksheets} onSelectWorksheet={onSelectWorksheet} />
        </ScopedNotification>
      )}
    </div>
  );
};

export default LoadRecordsMultiObjectErrorSummary;
