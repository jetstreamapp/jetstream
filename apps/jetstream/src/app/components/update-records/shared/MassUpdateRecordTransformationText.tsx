import { Maybe } from '@jetstream/types';
import { Badge } from '@jetstream/ui';
import classNames from 'classnames';
import { FunctionComponent } from 'react';
import { TransformationOptions } from '../../shared/mass-update-records/mass-update-records.types';

export interface MassUpdateRecordTransformationTextProps {
  className?: string;
  selectedField: Maybe<string>;
  transformationOptions: TransformationOptions;
}

export const MassUpdateRecordTransformationText: FunctionComponent<MassUpdateRecordTransformationTextProps> = ({
  selectedField,
  transformationOptions,
}) => {
  if (!selectedField) {
    return null;
  }
  const { option, alternateField, staticValue, criteria, whereClause } = transformationOptions;
  let title = '';
  let objectAndField: JSX.Element;
  let updateCriteria: Maybe<JSX.Element>;
  switch (option) {
    case 'staticValue':
      title += `"${selectedField}" will be set to "${staticValue}"`;
      objectAndField = (
        <span>
          "{selectedField}" will be set to "{staticValue}"
        </span>
      );
      break;
    case 'anotherField':
      title += `"${selectedField}" will be set to the value from the "${alternateField}" field`;
      objectAndField = (
        <span>
          "{selectedField}" will be set to the value from the "{alternateField}" field
        </span>
      );
      break;
    case 'null':
      title += `"${selectedField}" will be set to null`;
      objectAndField = <span>"{selectedField}" will be set to null</span>;
      break;
  }
  // 'all' | 'onlyIfBlank' | 'custom'
  switch (criteria) {
    case 'all':
      title += ` on all records`;
      updateCriteria = <span>on all records</span>;
      break;
    case 'onlyIfBlank':
      title += ` on records where "${selectedField}" is blank`;
      updateCriteria = <span>on records where "{selectedField}" is blank</span>;
      break;
    case 'onlyIfNotBlank':
      title += ` on records where "${selectedField}" is not blank`;
      updateCriteria = <span>on records where "{selectedField}" is not blank</span>;
      break;
    case 'custom':
      title += ` on records that meet your custom criteria: ${whereClause}`;
      updateCriteria = (
        <span>
          on records that meet your custom criteria: <span className="slds-text-font_monospace slds-truncate">"{whereClause}"</span>
        </span>
      );
      break;
    default:
      break;
  }

  return (
    <Badge className={classNames('slds-truncate', classNames)} title={title}>
      <span>{objectAndField}</span>
      <span className="slds-m-left_xx-small">{updateCriteria}</span>
    </Badge>
  );
};

export default MassUpdateRecordTransformationText;
