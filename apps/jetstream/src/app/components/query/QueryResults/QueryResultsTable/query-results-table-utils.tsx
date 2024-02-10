import { QueryFieldHeader, SalesforceOrgUi } from '@jetstream/types';
import { Checkbox, SalesforceLogin } from '@jetstream/ui';
import isBoolean from 'lodash/isBoolean';
import isObjectLike from 'lodash/isObjectLike';
import uniqueId from 'lodash/uniqueId';
import { ReactNode } from 'react';

export function getQueryResultsCellContents(
  field: QueryFieldHeader,
  serverUrl: string,
  org: SalesforceOrgUi,
  value: unknown,
  fullRecord?: any,
  complexDataRenderer?: (parentRecord: any, field: QueryFieldHeader, serverUrl: string, org: SalesforceOrgUi, value: unknown) => ReactNode
  // onViewData?: (field: QueryFieldHeader, value: unknown) => void
) {
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
      if (complexDataRenderer) {
        content = complexDataRenderer(fullRecord, field, serverUrl, org, value);
      } else {
        try {
          content = <div className="slds-line-clamp_medium">{JSON.stringify(value)}</div>;
        } catch (ex) {
          content = '<unable to show contents>';
        }
      }
      break;
    case 'boolean':
      content = <Checkbox id={uniqueId(field.accessor)} checked={value as boolean} label="value" hideLabel readOnly />;
      break;
    case 'id':
      content = (
        <div className="slds-line-clamp_medium" title={`${value}`}>
          <SalesforceLogin serverUrl={serverUrl} org={org} skipFrontDoorAuth returnUrl={`/${value}`} omitIcon>
            {value as ReactNode}
          </SalesforceLogin>
        </div>
      );
      break;
    default:
      content = (
        <div className="slds-line-clamp_medium" title={`${value}`}>
          {value as ReactNode}
        </div>
      );
      break;
  }
  return content;
}
