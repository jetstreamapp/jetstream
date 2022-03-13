import { ListItem } from '@jetstream/types';
import { AutoFullHeightContainer, EmptyState, OpenRoadIllustration } from '@jetstream/ui';
import { Fragment, FunctionComponent } from 'react';
import { MetadataRow, TransformationCriteria, TransformationOption, TransformationOptions } from '../mass-update-records.types';
import MassUpdateRecordsApplyToAllRow from './MassUpdateRecordsApplyToAllRow';
import MassUpdateRecordsObjectRow from './MassUpdateRecordsObjectRow';

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
              <MassUpdateRecordsObjectRow
                key={row.sobject}
                sobject={row.sobject}
                isValid={row.isValid}
                loadError={row.loadError}
                loading={row.loading}
                fields={row.fields}
                allFields={row.allFields}
                selectedField={row.selectedField}
                validationResults={row.validationResults}
                transformationOptions={row.transformationOptions}
                onFieldChange={(selectedField) => onFieldSelected(row.sobject, selectedField)}
                onOptionsChange={handleOptionChange}
                validateRowRecords={validateRowRecords}
              />
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
