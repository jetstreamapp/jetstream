import React, { FunctionComponent } from 'react';
import { FieldWrapper } from '@jetstream/types';
import Tooltip from '../widgets/Tooltip';
import Badge from '../widgets/Badge';
import Icon from '../widgets/Icon';

export interface SobjectFieldListTypeProps {
  field: FieldWrapper;
}

function getContent(field: FieldWrapper) {
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
          <span className="slds-badge__icon slds-badge__icon_left slds-badge__icon_inverse">
            <Icon
              type="utility"
              icon="search"
              className="slds-icon slds-icon_xx-small"
              containerClassname="slds-icon_container slds-icon-utility-moneybag slds-current-color"
            />
          </span>
          {field.type}
        </Tooltip>
      );
    }
    // TODO: add other tooltip (e.x. formula)
  } else {
    return field.type;
  }
}

export const SobjectFieldListType: FunctionComponent<SobjectFieldListTypeProps> = ({ field }) => {
  return (
    <Badge className="slds-truncate" title={field.fieldDefinition?.DataType || field.metadata.type}>
      {getContent(field)}
    </Badge>
  );
};

export default SobjectFieldListType;
