import isBoolean from 'lodash/isBoolean';
import isObjectLike from 'lodash/isObjectLike';
import uniqueId from 'lodash/uniqueId';
import React, { ReactNode } from 'react';
import { Icon, Checkbox, SalesforceLogin } from '@jetstream/ui';
import { QueryFieldHeader, SalesforceOrgUi } from '@jetstream/types';

export function getQueryResultsCellContents(field: QueryFieldHeader, serverUrl: string, org: SalesforceOrgUi, value: unknown) {
  let type: 'other' | 'object' | 'boolean' | 'id' = 'other';
  if (isObjectLike(value)) {
    type = 'object';
  } else if (field.columnMetadata.apexType === 'Boolean' || isBoolean(value)) {
    type = 'boolean';
  } else if (field.columnMetadata.apexType === 'Id') {
    type = 'id';
  }

  let content: ReactNode;
  switch (type) {
    case 'object':
      content = (
        <div>
          <button className="slds-button">
            <Icon type="utility" icon="search" className="slds-button__icon slds-button__icon_left" omitContainer />
            View Data
          </button>
        </div>
      );
      break;
    case 'boolean':
      content = <Checkbox id={uniqueId(field.accessor)} checked={value as boolean} label="value" hideLabel readOnly />;
      break;
    case 'id':
      content = (
        <div className="slds-truncate" title={`${value}`}>
          <SalesforceLogin serverUrl={serverUrl} org={org} returnUrl={`/${value}`} omitIcon>
            {value}
          </SalesforceLogin>
        </div>
      );
      break;
    default:
      content = (
        <div className="slds-truncate" title={`${value}`}>
          {value}
        </div>
      );
      break;
  }
  return content;
}
