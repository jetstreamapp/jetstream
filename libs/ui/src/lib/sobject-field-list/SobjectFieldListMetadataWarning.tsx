import { FunctionComponent } from 'react';
import Icon from '../widgets/Icon';
import Tooltip from '../widgets/Tooltip';

const WARNING_NAMES = new Set(['FullName', 'Metadata']);

export interface SobjectFieldListMetadataWarningProps {
  apiName: string;
}

export const SobjectFieldListMetadataWarning: FunctionComponent<SobjectFieldListMetadataWarningProps> = ({ apiName }) => {
  if (!WARNING_NAMES.has(apiName)) {
    return null;
  }
  return (
    <div className="slds-m-left_small">
      <Tooltip
        id={`tooltip-limit-warning`}
        content={
          <div>
            When this field is selected, Salesforce only allows one record to be returned. A limit of 1 has been added to your query.
          </div>
        }
      >
        <Icon type="utility" icon="warning" className="slds-icon slds-icon-text-warning slds-icon_xx-small" />
      </Tooltip>
    </div>
  );
};

export default SobjectFieldListMetadataWarning;
