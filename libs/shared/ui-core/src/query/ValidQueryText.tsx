import { Icon } from '@jetstream/ui';

export const SoqlValidIndicator = ({ soql, queryIsValid }: { soql: string; queryIsValid: boolean }) => {
  return (
    <div>
      {!soql && <NoQuery />}
      {queryIsValid && <ValidQuery />}
      {soql && !queryIsValid && <InvalidQuery />}
    </div>
  );
};

const NoQuery = () => {
  return <span className="slds-text-color_weak">Provide a valid query to continue</span>;
};

const ValidQuery = () => {
  return (
    <span className="slds-text-color_weak">
      <Icon
        type="utility"
        icon="success"
        description="Valid query"
        className="slds-icon-text-success slds-icon_xx-small slds-m-right_xx-small"
      />
      <span className="slds-text-color_weak">Query is valid</span>
    </span>
  );
};

const InvalidQuery = () => {
  return (
    <span>
      <Icon
        type="utility"
        icon="error"
        description="Invalid query"
        className="slds-icon-text-error slds-icon_xx-small slds-m-right_xx-small"
      />
      <span className="slds-text-color_weak">Query is invalid</span>
    </span>
  );
};
