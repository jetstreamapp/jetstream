import { ValidationResults } from '@jetstream/core/shared-ui';
import { Maybe } from '@jetstream/types';
import { Grid, Icon, Tooltip } from '@jetstream/ui';
import { FunctionComponent } from 'react';

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
        </Tooltip>
      )}
      {isValid && !validationResults?.isValid && (
        <Tooltip content="This object is configured but not validated">
          <Icon type="utility" icon="info" className="slds-icon slds-icon_xx-small slds-icon-text-default" />
        </Tooltip>
      )}
      {!isValid && (
        <Tooltip content="This object is not yet configured">
          <Icon type="utility" icon="error" className="slds-icon slds-icon_xx-small slds-icon-text-default" />
        </Tooltip>
      )}
      <span className="slds-card__header-title slds-m-left_x-small">{sobject}</span>
    </Grid>
  );
};

export default MassUpdateRecordObjectHeading;
