import { Field, Maybe } from '@jetstream/types';
import { Badge } from '@jetstream/ui';
import { FunctionComponent } from 'react';
import { TransformationOptions } from './mass-update-records.types';

export interface MassUpdateRecordTransformationTextProps {
  className?: string;
  selectedField: Maybe<string>;
  selectedFieldMetadata: Maybe<Field>;
  transformationOptions: TransformationOptions;
  hasExternalWhereClause?: boolean;
}

export const MassUpdateRecordTransformationText: FunctionComponent<MassUpdateRecordTransformationTextProps> = ({
  selectedField,
  selectedFieldMetadata,
  transformationOptions,
  hasExternalWhereClause,
}) => {
  if (!selectedField) {
    return null;
  }
  const { option, alternateField, staticValue, criteria, whereClause } = transformationOptions;
  let title = '';
  let objectAndField: JSX.Element;
  let updateCriteria: Maybe<JSX.Element>;
  const isBoolean = selectedFieldMetadata?.type === 'boolean';
  switch (option) {
    case 'staticValue':
      title += `"${selectedField}" will be set to "${staticValue || '<blank>'}"`;
      objectAndField = (
        <span>
          "{selectedField}" will be set to "{staticValue || '<blank>'}"
        </span>
      );
      break;
    case 'anotherField':
      title += `"${selectedField}" will be set to the value from the "${alternateField}" field`;
      objectAndField = (
        <span>
          "{selectedField}" will be set to the value from the "{alternateField || '(select a field)'}" field
        </span>
      );
      break;
    case 'null':
      title += `"${selectedField}" will be set to ${isBoolean ? 'false' : 'null'}`;
      objectAndField = (
        <span>
          "{selectedField}" will be set to {isBoolean ? 'false' : 'null'}
        </span>
      );
      break;
  }
  // 'all' | 'onlyIfBlank' | 'custom'
  switch (criteria) {
    case 'all':
      title += ` on all records`;
      updateCriteria = <span>on all records{hasExternalWhereClause ? ' that meet your query filter conditions' : ''}</span>;
      break;
    case 'onlyIfBlank':
      title += ` on records where "${selectedField}" is blank${hasExternalWhereClause ? ' and meet your query filter conditions' : ''}`;
      updateCriteria = (
        <span>
          on records where "{selectedField}" is blank
          {hasExternalWhereClause ? ' and meet your query filter conditions' : ''}
        </span>
      );
      break;
    case 'onlyIfNotBlank':
      title += ` on records where "${selectedField}" is not blank${hasExternalWhereClause ? ' and meet your query filter conditions' : ''}`;
      updateCriteria = <span>on records where "{selectedField}" is not blank</span>;
      updateCriteria = (
        <span>
          on records where "{selectedField}" is not blank
          {hasExternalWhereClause ? ' and meet your query filter conditions' : ''}
        </span>
      );
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
    // Wrapped in div because SFDC has a CSS rule to add left margin to sibling elements
    <div>
      <Badge title={title} className="w-100 slds-m-top_x-small">
        <span className="slds-line-clamp">
          <span>{objectAndField}</span>
          <span className="slds-m-left_xx-small">{updateCriteria}</span>
        </span>
      </Badge>
    </div>
  );
};

export default MassUpdateRecordTransformationText;
