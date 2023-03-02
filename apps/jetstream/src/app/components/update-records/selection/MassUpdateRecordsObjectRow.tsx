import { formatNumber } from '@jetstream/shared/ui-utils';
import { pluralizeFromNumber } from '@jetstream/shared/utils';
import { ListItem, Maybe } from '@jetstream/types';
import { Grid, GridCol, ScopedNotification, Spinner, Tooltip } from '@jetstream/ui';
import type { DescribeSObjectResult } from 'jsforce';
import isNumber from 'lodash/isNumber';
import { FunctionComponent } from 'react';
import { TransformationOptions, ValidationResults } from '../mass-update-records.types';
import MassUpdateRecordObjectHeading from '../shared/MassUpdateRecordObjectHeading';
import MassUpdateRecordTransformationText from '../shared/MassUpdateRecordTransformationText';
import MassUpdateRecordsObjectRowCriteria from './MassUpdateRecordsObjectRowCriteria';
import MassUpdateRecordsObjectRowField from './MassUpdateRecordsObjectRowField';
import MassUpdateRecordsObjectRowValue from './MassUpdateRecordsObjectRowValue';

export interface MassUpdateRecordsObjectRowProps {
  sobject: string;
  isValid: boolean;
  loadError?: Maybe<string>;
  loading: boolean;
  metadata?: Maybe<DescribeSObjectResult>;
  fields: ListItem[];
  allFields: ListItem[];
  selectedField?: Maybe<string>;
  validationResults: Maybe<ValidationResults>;
  transformationOptions: TransformationOptions;
  onFieldChange: (selectedField: string) => void;
  onOptionsChange: (sobject: string, options: TransformationOptions) => void;
  validateRowRecords: (sobject: string) => void;
}

export const MassUpdateRecordsObjectRow: FunctionComponent<MassUpdateRecordsObjectRowProps> = ({
  sobject,
  isValid,
  loadError,
  loading,
  fields,
  allFields,
  selectedField,
  validationResults,
  transformationOptions,
  onFieldChange,
  onOptionsChange,
  validateRowRecords,
}) => {
  return (
    <li className="slds-is-relative slds-item read-only slds-p-left_small">
      {loading && <Spinner />}
      <Grid verticalAlign="end" wrap>
        <GridCol size={12}>
          <Grid align="spread" verticalAlign="center">
            <MassUpdateRecordObjectHeading isValid={isValid} sobject={sobject} validationResults={validationResults} />
            <div>
              <Tooltip
                content={
                  isValid
                    ? 'Configure this object before you can validate the number of impacted records.'
                    : 'Check the number of records that will be updated'
                }
              >
                <button className="slds-button slds-button_neutral" disabled={!isValid} onClick={() => validateRowRecords(sobject)}>
                  Validate Results
                </button>
              </Tooltip>
            </div>
          </Grid>
          <MassUpdateRecordsObjectRowField fields={fields} selectedField={selectedField} onchange={onFieldChange} />
        </GridCol>
        <MassUpdateRecordsObjectRowValue
          fields={allFields}
          transformationOptions={transformationOptions}
          onOptionsChange={(options) => onOptionsChange(sobject, options)}
        />

        <GridCol size={12}>
          <MassUpdateRecordsObjectRowCriteria
            sobject={sobject}
            transformationOptions={transformationOptions}
            onOptionsChange={(options) => onOptionsChange(sobject, options)}
          />
        </GridCol>
      </Grid>
      {selectedField && (
        <footer className="slds-card__footer">
          <MassUpdateRecordTransformationText
            className="slds-m-top_x-small slds-m-left_small"
            selectedField={selectedField}
            transformationOptions={transformationOptions}
          />
          <div>
            {validationResults && isNumber(validationResults?.impactedRecords) && (
              <ScopedNotification theme="info" className="slds-m-top_x-small slds-m-left_small">
                {formatNumber(validationResults.impactedRecords)} {pluralizeFromNumber('record', validationResults.impactedRecords)} will be
                updated
              </ScopedNotification>
            )}
            {validationResults?.error && (
              <ScopedNotification theme="error" className="slds-m-top_x-small slds-m-left_small">
                <pre>{validationResults.error}</pre>
              </ScopedNotification>
            )}
          </div>
        </footer>
      )}
    </li>
  );
};

export default MassUpdateRecordsObjectRow;
