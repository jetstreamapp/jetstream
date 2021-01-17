import React, { Fragment, FunctionComponent } from 'react';
import { FieldWrapper } from '@jetstream/types';
import Tooltip from '../widgets/Tooltip';
import Badge from '../widgets/Badge';
import Icon from '../widgets/Icon';
import copyToClipboard from 'copy-to-clipboard';

export interface SobjectFieldListTypeProps {
  field: FieldWrapper;
}

function copy(value: string) {
  copyToClipboard(value);
}

const copyToClipboardMsg = (
  <em className="slds-m-top_x-small">
    <small>click to copy to clipboard</small>
  </em>
);

function getContent(field: FieldWrapper) {
  let copyToClipboardValue: string = undefined;
  if (field.metadata.type === 'picklist' || field.metadata.type === 'multipicklist') {
    let tooltipContent: JSX.Element = undefined;
    if (Array.isArray(field.metadata.picklistValues) && field.metadata.picklistValues.length > 0) {
      copyToClipboardValue = field.metadata.picklistValues?.map((picklist) => picklist.value).join('\n');
      let values: (string | JSX.Element)[] = field.metadata.picklistValues?.map((picklist) => picklist.label || picklist.value) || [];
      if (values.length > 10) {
        values = values.slice(0, 10);
        values.push(<div className="slds-text-color_inverse-weak">Too many values to show</div>);
      }
      tooltipContent = (
        <span>
          <h3 className="slds-text-title_caps slds-text-color_inverse">Picklist Values</h3>
          {values.map((value, i) => (
            <div key={i}>{value}</div>
          ))}
          {copyToClipboardMsg}
        </span>
      );
      return (
        <Tooltip id={`${field.name}-type-tooltip`} content={tooltipContent} onClick={() => copy(copyToClipboardValue)}>
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
  } else if (field.metadata.calculatedFormula) {
    copyToClipboardValue = field.metadata.calculatedFormula;
    const tooltipContent = (
      <span>
        <div>{copyToClipboardValue}</div>
        {copyToClipboardMsg}
      </span>
    );
    return (
      <Tooltip id={`${field.name}-type-tooltip`} content={tooltipContent} onClick={() => copy(copyToClipboardValue)}>
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
  } else {
    return field.type;
  }
}

export const SobjectFieldListType: FunctionComponent<SobjectFieldListTypeProps> = ({ field }) => {
  return (
    <Badge className="slds-truncate" title={field.type}>
      {getContent(field)}
    </Badge>
  );
};

export default SobjectFieldListType;
