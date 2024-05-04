import { ListItem, SalesforceOrgUi } from '@jetstream/types';
import { AutoFullHeightContainer, EmptyState, OpenRoadIllustration } from '@jetstream/ui';
import { MetadataRow, TransformationCriteria, TransformationOption, TransformationOptions } from '@jetstream/ui-core';
import { Fragment, FunctionComponent } from 'react';
import MassUpdateRecordsApplyToAllRow from './MassUpdateRecordsApplyToAllRow';
import MassUpdateRecordsObject from './MassUpdateRecordsObject';

export interface MassUpdateRecordsObjectsProps {
  selectedOrg: SalesforceOrgUi;
  rows: MetadataRow[];
  commonFields: ListItem[];
  onFieldSelected: (sobject: string, selectedField: string) => void;
  onLoadChildFields: (sobject: string, item: ListItem) => Promise<ListItem[]>;
  applyCommonField: (selectedField: string) => void;
  applyCommonOption: (option: TransformationOption) => void;
  applyCommonCriteria: (criteria: TransformationCriteria) => void;
  handleOptionChange: (sobject: string, transformationOptions: TransformationOptions) => void;
  validateRowRecords: (sobject: string) => void;
}

export const MassUpdateRecordsObjects: FunctionComponent<MassUpdateRecordsObjectsProps> = ({
  selectedOrg,
  rows,
  commonFields,
  onFieldSelected,
  onLoadChildFields,
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
              <MassUpdateRecordsObject
                key={row.sobject}
                selectedOrg={selectedOrg}
                row={row}
                commonFields={commonFields}
                onFieldSelected={onFieldSelected}
                onLoadChildFields={onLoadChildFields}
                handleOptionChange={handleOptionChange}
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

export default MassUpdateRecordsObjects;
