import { formatNumber } from '@jetstream/shared/ui-utils';
import { pluralizeFromNumber } from '@jetstream/shared/utils';
import { ListItem, Maybe } from '@jetstream/types';
import { Grid, GridCol, ScopedNotification, Spinner } from '@jetstream/ui';
import isNumber from 'lodash/isNumber';
import { FunctionComponent, ReactNode } from 'react';
import MassUpdateRecordTransformationText from '../../update-records/shared/MassUpdateRecordTransformationText';
import { TransformationOptions, ValidationResults } from './mass-update-records.types';
import MassUpdateRecordsObjectRowCriteria from './MassUpdateRecordsObjectRowCriteria';
import MassUpdateRecordsObjectRowField from './MassUpdateRecordsObjectRowField';
import MassUpdateRecordsObjectRowValue from './MassUpdateRecordsObjectRowValue';

export interface MassUpdateRecordsObjectRowProps {
  className?: string;
  sobject: string;
  loading: boolean;
  fields: ListItem[];
  allFields: ListItem[];
  selectedField?: Maybe<string>;
  validationResults?: Maybe<ValidationResults>;
  transformationOptions: TransformationOptions;
  disabled?: boolean;
  onFieldChange: (selectedField: string) => void;
  onOptionsChange: (sobject: string, options: TransformationOptions) => void;
  /** Used if some options should not be included in criteria dropdown */
  filterCriteriaFn?: (item: ListItem) => boolean;
  children?: ReactNode;
}

export const MassUpdateRecordsObjectRow: FunctionComponent<MassUpdateRecordsObjectRowProps> = ({
  className,
  sobject,
  loading,
  fields,
  allFields,
  selectedField,
  validationResults,
  transformationOptions,
  disabled,
  onFieldChange,
  onOptionsChange,
  filterCriteriaFn,
  children,
}) => {
  return (
    <div className={className}>
      {loading && <Spinner />}
      <Grid verticalAlign="end" wrap>
        {children}
        <GridCol size={12}>
          <MassUpdateRecordsObjectRowField fields={fields} selectedField={selectedField} disabled={disabled} onchange={onFieldChange} />
        </GridCol>
        <MassUpdateRecordsObjectRowValue
          fields={allFields}
          transformationOptions={transformationOptions}
          disabled={disabled}
          onOptionsChange={(options) => onOptionsChange(sobject, options)}
        />

        <GridCol size={12}>
          <MassUpdateRecordsObjectRowCriteria
            sobject={sobject}
            transformationOptions={transformationOptions}
            disabled={disabled}
            filterFn={filterCriteriaFn}
            onOptionsChange={(options) => onOptionsChange(sobject, options)}
          />
        </GridCol>
      </Grid>
      {!!selectedField && (
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
    </div>
  );
};

export default MassUpdateRecordsObjectRow;
