import { Maybe } from '@jetstream/types';
import { Grid, ScopedNotification } from '@jetstream/ui';
import type { FormulaContext, FormulaRecord, FormulaValue } from '@jetstreamapp/sf-formula-parser';
import { isFormulaValue } from '@jetstreamapp/sf-formula-parser';
import { formatISO } from 'date-fns/formatISO';
import { isValid } from 'date-fns/isValid';
import { FunctionComponent } from 'react';
import { FormulaReturnTypeWithEmptyState } from '../state-management/formula-evaluator.state';

export interface FormulaEvaluatorResultsProps {
  errorMessage?: Maybe<string>;
  results: {
    context: FormulaContext;
    result: FormulaValue;
    returnType: FormulaReturnTypeWithEmptyState;
  } | null;
}

function formatValue(value: FormulaValue, returnType: FormulaReturnTypeWithEmptyState): string | null {
  try {
    if (value == null) {
      return null;
    }
    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
      return String(value);
    }
    if (value instanceof Date && isValid(value)) {
      if (returnType === 'date') {
        return formatISO(value, { representation: 'date' });
      }
      return formatISO(value);
    }
    if (typeof value === 'object') {
      if ('timeInMillis' in value) {
        const totalMs = value.timeInMillis;
        const hours = Math.floor(totalMs / 3600000);
        const minutes = Math.floor((totalMs % 3600000) / 60000);
        const seconds = Math.floor((totalMs % 60000) / 1000);
        return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
      }
      if ('latitude' in value && 'longitude' in value) {
        return `(${value.latitude}, ${value.longitude})`;
      }
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Flatten a FormulaContext into a list of display-friendly key/value pairs.
 * Record fields are shown as-is, globals are prefixed with their category.
 */
function flattenContextForDisplay(
  context: FormulaContext,
  returnType: FormulaReturnTypeWithEmptyState,
): { field: string; value: string | null }[] {
  const entries: { field: string; value: string | null }[] = [];

  // Record fields (may contain nested relationships like Owner.FirstName)
  for (const [key, val] of Object.entries(context.record)) {
    if (isFormulaValue(val)) {
      entries.push({ field: key, value: formatValue(val, returnType) });
    } else {
      flattenRecord(key, val, entries, returnType);
    }
  }

  // Global fields
  if (context.globals) {
    for (const [prefix, record] of Object.entries(context.globals)) {
      flattenRecord(prefix, record, entries, returnType);
    }
  }

  return entries;
}

function flattenRecord(
  prefix: string,
  record: FormulaRecord,
  entries: { field: string; value: string | null }[],
  returnType: FormulaReturnTypeWithEmptyState,
) {
  for (const [key, val] of Object.entries(record)) {
    const fullKey = `${prefix}.${key}`;
    if (isFormulaValue(val)) {
      entries.push({ field: fullKey, value: formatValue(val, returnType) });
    } else {
      flattenRecord(fullKey, val, entries, returnType);
    }
  }
}

export const FormulaEvaluatorResults: FunctionComponent<FormulaEvaluatorResultsProps> = ({ errorMessage, results }) => {
  return (
    <>
      {errorMessage && (
        <div className="slds-m-around-medium" data-testid="formula-error">
          <ScopedNotification theme="error" className="slds-m-top_medium">
            {errorMessage}
          </ScopedNotification>
        </div>
      )}
      {results && (
        <Grid vertical>
          {(() => {
            const displayFields = flattenContextForDisplay(results.context, results.returnType);
            if (!displayFields.length) {
              return null;
            }
            return (
              <>
                <div className="slds-text-heading_small slds-m-top_small">Record Fields</div>
                <div className="slds-m-top_xx-small slds-m-bottom_small slds-p-left_small" data-testid="formula-record-fields">
                  {displayFields.map(({ field, value }) => (
                    <div key={field}>
                      <span className="text-bold">{field}</span>: {value ?? '<blank>'}
                    </div>
                  ))}
                </div>
              </>
            );
          })()}
          <div className="slds-text-heading_small slds-m-top_small">Formula Results</div>
          <div className="slds-m-top_xx-small slds-m-bottom_small slds-p-left_small">
            <div className="slds-text-color_success" data-testid="formula-result">
              {formatValue(results.result, results.returnType) ?? '<blank>'}
            </div>
          </div>
        </Grid>
      )}
    </>
  );
};

export default FormulaEvaluatorResults;
