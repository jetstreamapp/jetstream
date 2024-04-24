import { formatNumber } from '@jetstream/shared/ui-utils';
import { pluralizeFromNumber } from '@jetstream/shared/utils';
import { Field, ListItem, Maybe } from '@jetstream/types';
import { Grid, GridCol, ScopedNotification, Spinner } from '@jetstream/ui';
import isNumber from 'lodash/isNumber';
import { FunctionComponent, ReactNode } from 'react';
import MassUpdateRecordTransformationText from '../../update-records/shared/MassUpdateRecordTransformationText';
import MassUpdateRecordsObjectRowCriteria from './MassUpdateRecordsObjectRowCriteria';
import MassUpdateRecordsObjectRowField from './MassUpdateRecordsObjectRowField';
import MassUpdateRecordsObjectRowValue from './MassUpdateRecordsObjectRowValue';
import { TransformationOptions, ValidationResults } from './mass-update-records.types';

export interface MassUpdateRecordsObjectRowProps {
  className?: string;
  sobject: string;
  loading: boolean;
  fields: ListItem[];
  valueFields: ListItem[];
  selectedField?: Maybe<string>;
  selectedFieldMetadata?: Maybe<Field>;
  validationResults?: Maybe<ValidationResults>;
  transformationOptions: TransformationOptions;
  hasExternalWhereClause?: boolean;
  disabled?: boolean;
  onFieldChange: (selectedField: string, fieldMetadata: Field) => void;
  onOptionsChange: (sobject: string, options: TransformationOptions) => void;
  /** Used if some options should not be included in criteria dropdown */
  filterCriteriaFn?: (item: ListItem) => boolean;
  onLoadChildFields?: (item: ListItem) => Promise<ListItem[]>;
  children?: ReactNode;
}

export const MassUpdateRecordsObjectRow: FunctionComponent<MassUpdateRecordsObjectRowProps> = ({
  className,
  sobject,
  loading,
  fields,
  valueFields,
  selectedField,
  selectedFieldMetadata,
  validationResults,
  transformationOptions,
  hasExternalWhereClause,
  disabled,
  onFieldChange,
  onOptionsChange,
  filterCriteriaFn,
  onLoadChildFields,
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
          sobject={sobject}
          fields={valueFields}
          selectedField={selectedField}
          transformationOptions={transformationOptions}
          disabled={disabled}
          onOptionsChange={(options) => onOptionsChange(sobject, options)}
          onLoadChildFields={onLoadChildFields}
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
            selectedFieldMetadata={selectedFieldMetadata}
            transformationOptions={transformationOptions}
            hasExternalWhereClause={hasExternalWhereClause}
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
