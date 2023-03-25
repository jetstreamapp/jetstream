import { ListItem } from '@jetstream/types';
import { AutoFullHeightContainer, EmptyState, Grid, GridCol, OpenRoadIllustration, Tooltip } from '@jetstream/ui';
import { Fragment, FunctionComponent } from 'react';
import {
  MetadataRow,
  TransformationCriteria,
  TransformationOption,
  TransformationOptions,
} from '../../shared/mass-update-records/mass-update-records.types';
import MassUpdateRecordsApplyToAllRow from './MassUpdateRecordsApplyToAllRow';
import MassUpdateRecordsObjectRow from '../../shared/mass-update-records/MassUpdateRecordsObjectRow';
import MassUpdateRecordObjectHeading from '../shared/MassUpdateRecordObjectHeading';

export interface MassUpdateRecordsRowProps {
  rows: MetadataRow[];
  commonFields: ListItem[];
  onFieldSelected: (sobject: string, selectedField: string) => void;
  applyCommonField: (selectedField: string) => void;
  applyCommonOption: (option: TransformationOption) => void;
  applyCommonCriteria: (criteria: TransformationCriteria) => void;
  handleOptionChange: (sobject: string, transformationOptions: TransformationOptions) => void;
  validateRowRecords: (sobject: string) => void;
}

export const MassUpdateRecordsRow: FunctionComponent<MassUpdateRecordsRowProps> = ({
  rows,
  commonFields,
  onFieldSelected,
  applyCommonField,
  applyCommonOption,
  applyCommonCriteria,
  handleOptionChange,
  validateRowRecords,
}) => {
  return (
    <AutoFullHeightContainer bottomBuffer={25}>
      {rows.length ? (
        <Fragment>
          <MassUpdateRecordsApplyToAllRow
            rows={rows}
            commonFields={commonFields}
            applyCommonField={applyCommonField}
            applyCommonOption={applyCommonOption}
            applyCommonCriteria={applyCommonCriteria}
          />
          <ul className="slds-has-dividers_around-space">
            {rows.map((row) => (
              <li key={row.sobject} className="slds-is-relative slds-item read-only slds-p-left_small">
                <MassUpdateRecordsObjectRow
                  sobject={row.sobject}
                  loading={row.loading}
                  fields={row.fields}
                  valueFields={row.valueFields}
                  selectedField={row.selectedField}
                  validationResults={row.validationResults}
                  transformationOptions={row.transformationOptions}
                  onFieldChange={(selectedField) => onFieldSelected(row.sobject, selectedField)}
                  onOptionsChange={handleOptionChange}
                >
                  <GridCol size={12}>
                    <Grid align="spread" verticalAlign="center">
                      <MassUpdateRecordObjectHeading
                        isValid={row.isValid}
                        sobject={row.sobject}
                        validationResults={row.validationResults}
                      />
                      <div>
                        <Tooltip
                          content={
                            row.isValid
                              ? 'Configure this object before you can validate the number of impacted records.'
                              : 'Check the number of records that will be updated'
                          }
                        >
                          <button
                            className="slds-button slds-button_neutral"
                            disabled={!row.isValid}
                            onClick={() => validateRowRecords(row.sobject)}
                          >
                            Validate Results
                          </button>
                        </Tooltip>
                      </div>
                    </Grid>
                  </GridCol>
                </MassUpdateRecordsObjectRow>
              </li>
            ))}
          </ul>
        </Fragment>
      ) : (
        <EmptyState headline="Select one or more objects to get started" illustration={<OpenRoadIllustration />} />
      )}
    </AutoFullHeightContainer>
  );
};

export default MassUpdateRecordsRow;
