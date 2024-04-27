import { Maybe } from '@jetstream/types';
import { Grid, ScopedNotification } from '@jetstream/ui';
import { formatISO } from 'date-fns/formatISO';
import { isValid } from 'date-fns/isValid';
import * as formulon from 'formulon';
import { FunctionComponent } from 'react';

export interface FormulaEvaluatorResultsProps {
  errorMessage?: Maybe<string>;
  results: {
    formulaFields: formulon.FormulaData;
    parsedFormula: formulon.FormulaResult;
  } | null;
}

function getValue(value: string | number | boolean | null | Date): string {
  try {
    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
      return String(value);
    }
    if (value instanceof Date && isValid(value)) {
      return formatISO(value, { representation: 'date' });
    }
    return 'null';
  } catch (ex) {
    return 'null';
  }
}

export const FormulaEvaluatorResults: FunctionComponent<FormulaEvaluatorResultsProps> = ({ errorMessage, results }) => {
  return (
    <>
      {errorMessage && (
        <div className="slds-m-around-medium">
          <ScopedNotification theme="error" className="slds-m-top_medium">
            {errorMessage}
          </ScopedNotification>
        </div>
      )}
      {results && (
        <Grid vertical>
          {!!Object.keys(results.formulaFields).length && (
            <>
              <div className="slds-text-heading_small slds-m-top_small">Record Fields</div>
              <div className="slds-m-top_xx-small slds-m-bottom_small slds-p-left_small">
                {Object.keys(results.formulaFields).map((field) => {
                  const { value } = results.formulaFields[field];
                  return (
                    <div key={field}>
                      <span className="text-bold">{field}</span>: {String(value) || '<blank>'}
                    </div>
                  );
                })}
              </div>
            </>
          )}
          <div className="slds-text-heading_small slds-m-top_small">Formula Results</div>
          <div className="slds-m-top_xx-small slds-m-bottom_small slds-p-left_small">
            {results.parsedFormula.type === 'error' ? (
              <Grid vertical className="slds-text-color_error">
                <div>{results.parsedFormula.errorType}</div>
                <div>{results.parsedFormula.message}</div>
                {results.parsedFormula.errorType === 'NotImplementedError' && results.parsedFormula.name === 'isnull' && (
                  <div>Use ISBLANK instead</div>
                )}
              </Grid>
            ) : (
              <div className="slds-text-color_success">{getValue(results.parsedFormula.value) ?? '<blank>'}</div>
            )}
          </div>
        </Grid>
      )}
    </>
  );
};

export default FormulaEvaluatorResults;
