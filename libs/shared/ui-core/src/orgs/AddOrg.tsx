import { addOrg } from '@jetstream/shared/ui-utils';
import { SalesforceOrgUi } from '@jetstream/types';
import { Checkbox, CheckboxToggle, Grid, GridCol, Icon, Input, Popover, PopoverRef, Radio, RadioGroup } from '@jetstream/ui';
import classNames from 'classnames';
import { FunctionComponent, useEffect, useRef, useState } from 'react';
import { useRecoilState } from 'recoil';
import { applicationCookieState } from '../state-management/app-state';

type OrgType = 'prod' | 'sandbox' | 'pre-release' | 'custom';

const loginUrlMap = {
  prod: 'https://login.salesforce.com',
  sandbox: 'https://test.salesforce.com',
  'pre-release': 'https://prerellogin.pre.salesforce.com',
};

const CUSTOM_LOGIN_PROTOCOL = 'https://';
const CUSTOM_LOGIN_SUFFIX = '.my.salesforce.com';

function getFQDN(customUrl: string) {
  return `${CUSTOM_LOGIN_PROTOCOL}${customUrl}${CUSTOM_LOGIN_SUFFIX}`;
}

// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface AddOrgProps {
  className?: string;
  label?: string;
  disabled?: boolean;
  onAddOrg: (org: SalesforceOrgUi, switchActiveOrg: boolean) => void;
}

export const AddOrg: FunctionComponent<AddOrgProps> = ({ className, label = 'Add Org', disabled, onAddOrg }) => {
  const popoverRef = useRef<PopoverRef>(null);
  const [orgType, setOrgType] = useState<OrgType>('prod');
  const [customUrl, setCustomUrl] = useState<string>('');
  const [loginUrl, setLoginUrl] = useState<string | null>(null);
  const [advancedOptionsEnabled, setAdvancedOptionsEnabled] = useState(false);
  const [addLoginTrue, setAddLoginTrue] = useState(false);
  const [applicationState] = useRecoilState(applicationCookieState);

  useEffect(() => {
    let url: string;
    if (orgType === 'custom') {
      url = getFQDN(customUrl);
    } else {
      url = loginUrlMap[orgType] || 'https://login.salesforce.com';
    }
    setLoginUrl(url);
  }, [orgType, customUrl]);

  function handleAddOrg() {
    loginUrl &&
      addOrg(
        { serverUrl: applicationState.serverUrl, loginUrl, addLoginTrue: advancedOptionsEnabled && addLoginTrue },
        (addedOrg: SalesforceOrgUi) => {
          popoverRef.current?.close();
          onAddOrg(addedOrg, true);
        }
      );
  }

  function handleReset() {
    setOrgType('prod');
    setCustomUrl('');
    setLoginUrl(null);
    setAdvancedOptionsEnabled(false);
    setAddLoginTrue(false);
  }

  return (
    // TODO: figure out way to close this once an org is added - this was fixed, but it caused the component to fully re-render each time!
    <Popover
      ref={popoverRef}
      onChange={(isOpen) => !isOpen && handleReset()}
      // placement="bottom-end"
      header={
        <header className="slds-popover__header">
          <h2 className="slds-truncate slds-text-heading_small" title="Add New Org">
            Add New Org
          </h2>
        </header>
      }
      content={
        <div className="slds-text-align_left">
          <RadioGroup label="Salesforce Org Type">
            <Radio
              name="prod"
              label="Production / Developer"
              value="prod"
              checked={orgType === 'prod'}
              onChange={() => setOrgType('prod')}
            />
            <Radio name="sandbox" label="Sandbox" value="sandbox" checked={orgType === 'sandbox'} onChange={() => setOrgType('sandbox')} />
            <Radio
              name="pre-release"
              label="Pre-release"
              value="pre-release"
              checked={orgType === 'pre-release'}
              onChange={() => setOrgType('pre-release')}
            />
            <Radio
              name="custom"
              label="Custom Login URL"
              value="custom"
              checked={orgType === 'custom'}
              onChange={() => setOrgType('custom')}
            />
          </RadioGroup>

          {orgType === 'custom' && (
            <Input
              label="Custom Salesforce Url"
              isRequired={false}
              hasError={false}
              errorMessageId="Error"
              errorMessage="This is not valid"
              leftAddon={CUSTOM_LOGIN_PROTOCOL}
              rightAddon={CUSTOM_LOGIN_SUFFIX}
              helpText={customUrl ? getFQDN(customUrl) : null}
            >
              <input
                id="org-custom-url"
                className="slds-input"
                placeholder="org-domain"
                value={customUrl}
                onChange={(event) =>
                  setCustomUrl((prevValue) => (event.target.value || '').replaceAll(/(https:\/\/)|(\.my\.salesforce\.com)/g, ''))
                }
              />
            </Input>
          )}
          <div className="slds-m-top_small">
            <CheckboxToggle
              id="advanced-settings-toggle"
              checked={advancedOptionsEnabled}
              label="Advanced"
              labelPosition="right"
              onChange={setAdvancedOptionsEnabled}
            />
            {advancedOptionsEnabled && (
              <Checkbox
                id="advanced-settings-login-true"
                label={`Add "login=true" to url`}
                labelHelp="Allows bypassing SSO if your admin has enabled this option."
                checked={addLoginTrue}
                onChange={setAddLoginTrue}
              />
            )}
          </div>
        </div>
      }
      footer={
        <footer className="slds-popover__footer">
          <Grid verticalAlign="center">
            <GridCol bump="left">
              <button className="slds-button slds-button_brand" onClick={handleAddOrg}>
                Continue
              </button>
            </GridCol>
          </Grid>
        </footer>
      }
      buttonProps={{
        className: classNames('slds-button', className),
        disabled: disabled,
      }}
    >
      <Icon type="utility" icon="add" className="slds-button__icon slds-button__icon_left" omitContainer />
      {label}
    </Popover>
  );
};

export default AddOrg;
