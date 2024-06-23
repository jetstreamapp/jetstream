import { ListItem } from '@jetstream/types';
import { AutoFullHeightContainer, EmptyState, OpenRoadIllustration } from '@jetstream/ui';
import { MetadataRow, TransformationOptions } from '@jetstream/ui-core';
import { Fragment, FunctionComponent } from 'react';
import MassUpdateRecordsApplyToAllRow from './MassUpdateRecordsApplyToAllRow';
import MassUpdateRecordsObject from './MassUpdateRecordsObject';
import { useMassUpdateFieldItems } from './useMassUpdateFieldItems';

export interface MassUpdateRecordsObjectsProps {
  rows: MetadataRow[];
  commonFields: ListItem[];
  onFieldSelected: ReturnType<typeof useMassUpdateFieldItems>['onFieldSelected'];
  onLoadChildFields: (sobject: string, item: ListItem) => Promise<ListItem[]>;
  applyCommonField: ReturnType<typeof useMassUpdateFieldItems>['applyCommonField'];
  applyCommonOption: ReturnType<typeof useMassUpdateFieldItems>['applyCommonOption'];
  applyCommonCriteria: ReturnType<typeof useMassUpdateFieldItems>['applyCommonCriteria'];
  handleOptionChange: (configIndex: number, sobject: string, transformationOptions: TransformationOptions) => void;
  handleAddField: (sobject: string) => void;
  handleRemoveField: (sobject: string, configIndex: number) => void;
  validateRowRecords: (sobject: string) => void;
}

export const MassUpdateRecordsObjects: FunctionComponent<MassUpdateRecordsObjectsProps> = ({
  rows,
  commonFields,
  onFieldSelected,
  onLoadChildFields,
  applyCommonField,
  applyCommonOption,
  applyCommonCriteria,
  handleOptionChange,
  handleAddField,
  handleRemoveField,
  validateRowRecords,
}) => {
  return (
    <AutoFullHeightContainer bottomBuffer={25}>
      {rows.length ? (
        <Fragment>
          <MassUpdateRecordsApplyToAllRow
            rows={rows}
            commonFields={commonFields}
            // These only apply to first field for each object
            applyCommonField={(selectedField) => applyCommonField(0, selectedField)}
            applyCommonOption={(option, staticValue) => applyCommonOption(0, option, staticValue)}
            applyCommonCriteria={(criteria, whereClause) => applyCommonCriteria(0, criteria, whereClause)}
          />
          <ul className="slds-has-dividers_around-space">
            {rows.map((row) => (
              <MassUpdateRecordsObject
                key={row.sobject}
                row={row}
                commonFields={commonFields}
                onFieldSelected={onFieldSelected}
                onLoadChildFields={onLoadChildFields}
                handleOptionChange={handleOptionChange}
                validateRowRecords={validateRowRecords}
                handleAddField={handleAddField}
                handleRemoveField={handleRemoveField}
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
