import { formatNumber } from '@jetstream/shared/ui-utils';
import { Maybe } from '@jetstream/types';
import { DisabledReasonButton, getAriaKeyshortcuts, getModifierKey } from '@jetstream/ui';
import { useOperationAccess } from '@jetstream/ui/app-state';
import { Fragment, useId } from 'react';
import { RecordTypePicklistSummary } from '../types/record-types.types';

type ConfigurationErrors = Record<string, Record<string, string[]>>;

interface DeployButtonProps {
  modifiedValues: RecordTypePicklistSummary[];
  configurationErrors?: Maybe<ConfigurationErrors>;
  handleDeploy: () => void;
}

function ConfigurationErrorList({ configurationErrors }: { configurationErrors: ConfigurationErrors }) {
  return (
    <>
      <p>Resolve the following errors before deploying:</p>
      <ul>
        {Object.entries(configurationErrors).map(([sobject, errorsByType]) => (
          <Fragment key={sobject}>
            <li>{sobject}</li>
            <li>
              <ul className="slds-is-nested">
                {Object.entries(errorsByType).map(([field, errors]) => (
                  <Fragment key={field}>
                    <li>{field}</li>
                    <li>
                      <ul className="slds-is-nested">
                        {Array.from(new Set(errors)).map((error) => (
                          <li key={error}>{error}</li>
                        ))}
                      </ul>
                    </li>
                  </Fragment>
                ))}
              </ul>
            </li>
          </Fragment>
        ))}
      </ul>
    </>
  );
}

export function DeployButton({ modifiedValues, configurationErrors, handleDeploy }: DeployButtonProps) {
  const deployAccess = useOperationAccess('metadata.deploy');
  const configurationErrorsId = useId();
  const hasModifiedValue = modifiedValues.length !== 0;

  const buttonLabel = hasModifiedValue ? `Deploy Changes (${formatNumber(modifiedValues.length)})` : 'Deploy Changes';
  const disabledReason = hasModifiedValue ? deployAccess.deniedReason : 'Change one or more values to enable deployment.';
  // The configuration errors are a nested list, too rich for a plain-text reason: they show in the tooltip, and a
  // hidden copy is linked as the button's description so screen readers hear them too
  const showConfigurationErrors = !disabledReason && !!configurationErrors;

  return (
    <>
      <DisabledReasonButton
        className="slds-button slds-button_brand"
        aria-keyshortcuts={getAriaKeyshortcuts([getModifierKey(), 'enter'])}
        aria-describedby={showConfigurationErrors ? configurationErrorsId : undefined}
        disabled={!!configurationErrors || !hasModifiedValue || !deployAccess.allowed}
        disabledReason={disabledReason}
        tooltip={showConfigurationErrors && <ConfigurationErrorList configurationErrors={configurationErrors} />}
        onClick={() => handleDeploy()}
      >
        {buttonLabel}
      </DisabledReasonButton>
      {showConfigurationErrors && (
        <div id={configurationErrorsId} hidden>
          <ConfigurationErrorList configurationErrors={configurationErrors} />
        </div>
      )}
    </>
  );
}
