import { formatNumber } from '@jetstream/shared/ui-utils';
import { pluralizeFromNumber } from '@jetstream/shared/utils';
import { Field, ListItem, Maybe } from '@jetstream/types';
import { Grid, GridCol, Icon, ScopedNotification, Spinner } from '@jetstream/ui';
import isNumber from 'lodash/isNumber';
import { Fragment, FunctionComponent, ReactNode } from 'react';
import MassUpdateRecordTransformationText from './MassUpdateRecordTransformationText';
import MassUpdateRecordsObjectRowCriteria from './MassUpdateRecordsObjectRowCriteria';
import MassUpdateRecordsObjectRowField from './MassUpdateRecordsObjectRowField';
import MassUpdateRecordsObjectRowValue from './MassUpdateRecordsObjectRowValue';
import { MetadataRowConfiguration, TransformationOptions, ValidationResults } from './mass-update-records.types';

export interface MassUpdateRecordsObjectRowProps {
  className?: string;
  sobject: string;
  loading: boolean;
  fields: ListItem[];
  valueFields: ListItem[];
  fieldConfigurations: MetadataRowConfiguration[];
  validationResults?: Maybe<ValidationResults>;
  hasExternalWhereClause?: boolean;
  disabled?: boolean;
  onFieldChange: (index: number, selectedField: string, fieldMetadata: Field) => void;
  onOptionsChange: (index: number, sobject: string, options: TransformationOptions) => void;
  /** Used if some options should not be included in criteria dropdown */
  filterCriteriaFn?: (item: ListItem) => boolean;
  onLoadChildFields?: (item: ListItem) => Promise<ListItem[]>;
  onAddField: (sobject: string) => void;
  onRemoveField: (sobject: string, configIndex: number) => void;
  children?: ReactNode;
}

export const MassUpdateRecordsObjectRow: FunctionComponent<MassUpdateRecordsObjectRowProps> = ({
  className,
  sobject,
  loading,
  fields,
  valueFields,
  fieldConfigurations,
  validationResults,
  hasExternalWhereClause,
  disabled,
  onFieldChange,
  onOptionsChange,
  filterCriteriaFn,
  onLoadChildFields,
  onAddField,
  onRemoveField,
  children,
}) => {
  return (
    <div className={className}>
      {loading && <Spinner />}
      <Grid verticalAlign="end" wrap>
        {children}
        {fieldConfigurations.map(({ selectedField, selectedFieldMetadata, transformationOptions }, index) => (
          <Fragment key={index}>
            {index !== 0 && (
              <GridCol size={12}>
                <hr className="slds-m-vertical_small slds-m-horizontal_x-small" />
              </GridCol>
            )}
            <GridCol size={12}>
              <MassUpdateRecordsObjectRowField
                fields={fields}
                selectedField={selectedField}
                disabled={disabled}
                allowDelete={fieldConfigurations.length > 1}
                onchange={(selectedField, fieldMetadata) => onFieldChange(index, selectedField, fieldMetadata)}
                onRemoveRow={() => onRemoveField(sobject, index)}
              />
            </GridCol>
            <MassUpdateRecordsObjectRowValue
              sobject={sobject}
              fields={valueFields}
              selectedField={selectedField}
              transformationOptions={transformationOptions}
              disabled={disabled}
              onOptionsChange={(options) => onOptionsChange(index, sobject, options)}
              onLoadChildFields={onLoadChildFields}
            />

            <GridCol size={12}>
              <MassUpdateRecordsObjectRowCriteria
                sobject={sobject}
                transformationOptions={transformationOptions}
                disabled={disabled}
                filterFn={filterCriteriaFn}
                onOptionsChange={(options) => onOptionsChange(index, sobject, options)}
              />
            </GridCol>

            {!!selectedField && (
              <GridCol size={12} className="slds-p-top_x-small">
                <MassUpdateRecordTransformationText
                  className="slds-m-top_x-small slds-m-left_small"
                  selectedField={selectedField}
                  selectedFieldMetadata={selectedFieldMetadata}
                  transformationOptions={transformationOptions}
                  hasExternalWhereClause={hasExternalWhereClause}
                />
              </GridCol>
            )}
          </Fragment>
        ))}
        <GridCol size={12}>
          <div className="slds-m-top_x-small">
            <button className="slds-button slds-button_neutral" disabled={disabled} onClick={() => onAddField(sobject)}>
              <Icon type="utility" icon="add" className="slds-button__icon slds-button__icon_left" omitContainer />
              Add Field
            </button>
          </div>
        </GridCol>
      </Grid>
      {validationResults && (
        <footer className="slds-card__footer">
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
        </footer>
      )}
    </div>
  );
};

export default MassUpdateRecordsObjectRow;
