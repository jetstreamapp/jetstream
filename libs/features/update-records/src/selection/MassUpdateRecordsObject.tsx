import { ListItem, Maybe, SalesforceOrgUi } from '@jetstream/types';
import { ariaDisabledButtonProps, Grid, GridCol, Tooltip } from '@jetstream/ui';
import { MassUpdateRecordObjectHeading, MassUpdateRecordsObjectRow, MetadataRow } from '@jetstream/ui-core';
import { FunctionComponent, useCallback } from 'react';
import { useMassUpdateFieldItems } from './useMassUpdateFieldItems';

export interface MassUpdateRecordsObjectProps {
  org: SalesforceOrgUi;
  row: MetadataRow;
  commonFields: ListItem[];
  onFieldSelected: ReturnType<typeof useMassUpdateFieldItems>['onFieldSelected'];
  handleOptionChange: ReturnType<typeof useMassUpdateFieldItems>['handleOptionChange'];
  handleRecordLimitChange: (sobject: string, limit: Maybe<number>) => void;
  onLoadChildFields: (sobject: string, item: ListItem) => Promise<ListItem[]>;
  validateRowRecords: (sobject: string) => void;
  handleAddField: (sobject: string) => void;
  handleRemoveField: (sobject: string, configIndex: number) => void;
}
/**
 * Load listItem for single object and handle loading child fields
 */
export const MassUpdateRecordsObject: FunctionComponent<MassUpdateRecordsObjectProps> = ({
  org,
  row,
  onFieldSelected,
  onLoadChildFields,
  handleOptionChange,
  handleRecordLimitChange,
  validateRowRecords,
  handleAddField,
  handleRemoveField,
}) => {
  const handleLoadChildFields = useCallback(
    async (item: ListItem): Promise<ListItem[]> => {
      return onLoadChildFields(row.sobject, item);
    },
    [onLoadChildFields, row.sobject],
  );

  return (
    <li className="slds-is-relative slds-item read-only slds-p-left_small">
      <MassUpdateRecordsObjectRow
        org={org}
        sobject={row.sobject}
        loading={row.loading}
        fields={row.fields}
        valueFields={row.valueFields}
        fieldConfigurations={row.configuration}
        validationResults={row.validationResults}
        recordLimit={{
          limit: row.limit,
          onChange: (limit) => handleRecordLimitChange(row.sobject, limit),
        }}
        onFieldChange={(index, selectedField) => onFieldSelected(index, row.sobject, selectedField)}
        onOptionsChange={(index, sobject, options) => handleOptionChange(index, sobject, options)}
        onLoadChildFields={handleLoadChildFields}
        onAddField={handleAddField}
        onRemoveField={handleRemoveField}
      >
        <GridCol size={12}>
          <Grid align="spread" verticalAlign="center">
            <MassUpdateRecordObjectHeading isValid={row.isValid} sobject={row.sobject} validationResults={row.validationResults} />
            <div>
              <Tooltip
                content={
                  row.isValid
                    ? 'Check the number of records that will be updated'
                    : 'Configure this object before you can validate the number of impacted records.'
                }
              >
                {/* Stays focusable while disabled so keyboard users can reach the tooltip explaining
                    why validation is unavailable; the aria-label scopes the accessible name per
                    object since every card renders this same button */}
                <button
                  className="slds-button slds-button_neutral"
                  aria-label={`Validate Results for ${row.sobject}`}
                  {...ariaDisabledButtonProps(!row.isValid, () => validateRowRecords(row.sobject))}
                >
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
