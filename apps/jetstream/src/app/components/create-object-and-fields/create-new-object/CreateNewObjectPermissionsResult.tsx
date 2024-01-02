import { Maybe } from '@jetstream/types';
import { Icon } from '@jetstream/ui';
import { FunctionComponent } from 'react';

export interface CreateNewObjectPermissionsResultProps {
  recordResults: {
    skipped: number;
    success: number;
    failed: number;
    errors: Maybe<string>[];
  };
}

export const CreateNewObjectPermissionsResult: FunctionComponent<CreateNewObjectPermissionsResultProps> = ({ recordResults }) => {
  if (!recordResults.errors || recordResults.errors.length === 0) {
    return (
      <div>
        <Icon
          type="utility"
          icon="success"
          className="slds-icon slds-icon-text-success slds-icon_x-small slds-m-right_xx-small"
          containerClassname="slds-icon_container slds-icon-utility-success"
          description="Permissions deployed successfully"
        />
        <span className="slds-text-color_success">All permissions deployed successfully</span>
      </div>
    );
  }

  return (
    <div className="slds-text-color_error">
      <div>
        <Icon
          type="utility"
          icon="error"
          className="slds-icon slds-icon-text-error slds-icon_x-small slds-m-right_xx-small"
          containerClassname="slds-icon_container slds-icon-utility-error"
          description="Permissions had errors"
        />
        There was an error deploying some permissions
      </div>
      <ul className="slds-list_dotted">
        {recordResults.errors.map((error, i) => (
          <li key={`${i}-error`}>{error}</li>
        ))}
      </ul>
    </div>
  );
};

export default CreateNewObjectPermissionsResult;
