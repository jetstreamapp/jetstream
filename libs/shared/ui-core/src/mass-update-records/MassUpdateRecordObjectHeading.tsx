import { Maybe } from '@jetstream/types';
import { Grid, Icon, Tooltip } from '@jetstream/ui';
import { FunctionComponent } from 'react';
import { ValidationResults } from './mass-update-records.types';

export interface MassUpdateRecordObjectHeadingProps {
  sobject: string;
  isValid: boolean;
  validationResults: Maybe<ValidationResults>;
}

export const MassUpdateRecordObjectHeading: FunctionComponent<MassUpdateRecordObjectHeadingProps> = ({
  isValid,
  sobject,
  validationResults,
}) => {
  return (
    <Grid>
      {isValid && validationResults?.isValid && (
        <Tooltip content="This object is configured and validated">
          <Icon type="utility" icon="success" className="slds-icon slds-icon_xx-small slds-icon-text-success" />
          {/* Assistive text rather than the icon's description, which would add a native title on top of the tooltip */}
          <span className="slds-assistive-text">Configured and validated</span>
        </Tooltip>
      )}
      {isValid && !validationResults?.isValid && (
        <Tooltip content="This object is configured but not validated">
          <Icon type="utility" icon="info" className="slds-icon slds-icon_xx-small slds-icon-text-default" />
          <span className="slds-assistive-text">Configured, not yet validated</span>
        </Tooltip>
      )}
      {!isValid && (
        <Tooltip content="This object is not yet configured">
          <Icon type="utility" icon="error" className="slds-icon slds-icon_xx-small slds-icon-text-default" />
          <span className="slds-assistive-text">Not yet configured</span>
        </Tooltip>
      )}
      <h2 className="slds-card__header-title slds-m-left_x-small">{sobject}</h2>
    </Grid>
  );
};

export default MassUpdateRecordObjectHeading;
