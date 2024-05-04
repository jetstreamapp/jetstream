import { ListItem, SalesforceOrgUi } from '@jetstream/types';
import { Grid, GridCol, Tooltip } from '@jetstream/ui';
import { MassUpdateRecordObjectHeading, MassUpdateRecordsObjectRow, MetadataRow, TransformationOptions } from '@jetstream/ui-core';
import { FunctionComponent, useCallback } from 'react';

export interface MassUpdateRecordsObjectProps {
  selectedOrg: SalesforceOrgUi;
  row: MetadataRow;
  commonFields: ListItem[];
  onFieldSelected: (sobject: string, selectedField: string) => void;
  onLoadChildFields: (sobject: string, item: ListItem) => Promise<ListItem[]>;
  handleOptionChange: (sobject: string, transformationOptions: TransformationOptions) => void;
  validateRowRecords: (sobject: string) => void;
}
/**
 * Load listItem for single object and handle loading child fields
 */
export const MassUpdateRecordsObject: FunctionComponent<MassUpdateRecordsObjectProps> = ({
  selectedOrg,
  row,
  onFieldSelected,
  onLoadChildFields,
  handleOptionChange,
  validateRowRecords,
}) => {
  const handleLoadChildFields = useCallback(
    async (item: ListItem): Promise<ListItem[]> => {
      return onLoadChildFields(row.sobject, item);
    },
    [onLoadChildFields, row.sobject]
  );

  return (
    <li className="slds-is-relative slds-item read-only slds-p-left_small">
      <MassUpdateRecordsObjectRow
        sobject={row.sobject}
        loading={row.loading}
        fields={row.fields}
        valueFields={row.valueFields}
        selectedField={row.selectedField}
        selectedFieldMetadata={row.selectedFieldMetadata}
        validationResults={row.validationResults}
        transformationOptions={row.transformationOptions}
        onFieldChange={(selectedField) => onFieldSelected(row.sobject, selectedField)}
        onOptionsChange={handleOptionChange}
        onLoadChildFields={handleLoadChildFields}
      >
        <GridCol size={12}>
          <Grid align="spread" verticalAlign="center">
            <MassUpdateRecordObjectHeading isValid={row.isValid} sobject={row.sobject} validationResults={row.validationResults} />
            <div>
              <Tooltip
                content={
                  row.isValid
                    ? 'Configure this object before you can validate the number of impacted records.'
                    : 'Check the number of records that will be updated'
                }
              >
                <button className="slds-button slds-button_neutral" disabled={!row.isValid} onClick={() => validateRowRecords(row.sobject)}>
                  Validate Results
                </button>
              </Tooltip>
            </div>
          </Grid>
        </GridCol>
      </MassUpdateRecordsObjectRow>
    </li>
  );
};

export default MassUpdateRecordsObject;
