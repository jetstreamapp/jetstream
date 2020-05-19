import React, { FunctionComponent } from 'react';
import { FieldWrapper } from '@silverthorn/types';
import Tooltip from '../widgets/Tooltip';

export interface SobjectFieldListTypeProps {
  field: FieldWrapper;
}

export const SobjectFieldListType: FunctionComponent<SobjectFieldListTypeProps> = ({ field }) => {
  function getContent() {
    if (field.metadata.type === 'picklist') {
      let tooltipContent: JSX.Element = undefined;
      if (Array.isArray(field.metadata.picklistValues) && field.metadata.picklistValues.length > 0) {
        tooltipContent = (
          <span>
            {field.metadata.picklistValues?.map((picklist) => (
              <div key={picklist.value}>{picklist.label}</div>
            ))}
          </span>
        );
        return (
          <Tooltip id={`${field.name}-type-tooltip`} content={tooltipContent}>
            {field.type}
          </Tooltip>
        );
      }
      // TODO: add other tooltip (e.x. formula)
    } else {
      return field.type;
    }
  }
  return (
    <div className="slds-badge slds-truncate" title={field.fieldDefinition?.DataType || field.metadata.type}>
      {getContent()}
    </div>
  );
};

export default SobjectFieldListType;
