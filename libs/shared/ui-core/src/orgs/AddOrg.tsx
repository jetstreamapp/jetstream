import { css } from '@emotion/react';
import { ANALYTICS_KEYS } from '@jetstream/shared/constants';
import { addOrg } from '@jetstream/shared/ui-utils';
import { AddOrgHandlerFn, SalesforceOrgUi } from '@jetstream/types';
import { Checkbox, CheckboxToggle, Grid, GridCol, Icon, Input, Popover, PopoverRef, Radio, RadioGroup } from '@jetstream/ui';
import { fromAppState } from '@jetstream/ui/app-state';
import classNames from 'classnames';
import { useAtomValue } from 'jotai';
import { FunctionComponent, useEffect, useRef, useState } from 'react';
import { useAmplitude } from '..';

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

export interface AddOrgProps {
  className?: string;
  label?: string;
  popoverLabel?: string;
  disabled?: boolean;
  omitIcon?: boolean;
  /**
   * If provided, the form will be pre-populated to reconnect the existing org.
   */
  existingOrg?: SalesforceOrgUi;
  onAddOrg: (org: SalesforceOrgUi, switchActiveOrg: boolean) => void;
  /**
   * If provided, this will be used instead of the default addOrg function.
   * This is used in the desktop app to open the browser for the login process.
   */
  onAddOrgHandlerFn?: AddOrgHandlerFn;
}

export const AddOrg: FunctionComponent<AddOrgProps> = ({
  className,
  label = 'Add Org',
  popoverLabel = 'Add New Org',
  disabled,
  omitIcon,
  existingOrg,
  onAddOrg,
  onAddOrgHandlerFn = addOrg,
}) => {
  const popoverRef = useRef<PopoverRef>(null);
  const { trackEvent } = useAmplitude();
  const [orgType, setOrgType] = useState<OrgType>(() => (existingOrg ? 'custom' : 'prod'));
  const [customUrl, setCustomUrl] = useState<string>(() => {
    if (!existingOrg) {
      return '';
    }
    try {
      return new URL(existingOrg.instanceUrl).hostname.replace('.my.salesforce.com', '');
    } catch {
      return '';
    }
  });
  const [loginUrl, setLoginUrl] = useState<string | null>(() => (existingOrg?.instanceUrl ? existingOrg.instanceUrl : loginUrlMap.prod));
  const [advancedOptionsEnabled, setAdvancedOptionsEnabled] = useState(false);
  const [addLoginTrue, setAddLoginTrue] = useState(false);
  const [addToActiveOrgGroup, setAddToActiveOrgGroup] = useState(true);
  const applicationState = useAtomValue(fromAppState.applicationCookieState);
  const orgGroup = useAtomValue(fromAppState.jetstreamActiveGroupSelector);

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
      onAddOrgHandlerFn(
        {
          serverUrl: applicationState.serverUrl,
          loginUrl,
          addLoginTrue: advancedOptionsEnabled && addLoginTrue,
          orgGroupId: addToActiveOrgGroup ? orgGroup?.id : null,
          loginHint: existingOrg?.username,
        },
        (addedOrg: SalesforceOrgUi) => {
          popoverRef.current?.close();
          onAddOrg(addedOrg, true);
        },
      );
    trackEvent(ANALYTICS_KEYS.sfdc_org_add_org, {
      orgType,
      advancedOptionsEnabled,
      addLoginTrue,
      addToActiveOrganization: addToActiveOrgGroup,
    });
  }

  function handleReset() {
    if (existingOrg) {
      return;
    }
    setOrgType('prod');
    setCustomUrl('');
    setLoginUrl(loginUrlMap.prod);
    setAdvancedOptionsEnabled(false);
    setAddLoginTrue(false);
    setAddToActiveOrgGroup(true);
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
            {popoverLabel}
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
              id="org-custom-url"
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
          {orgGroup && (
            <Checkbox
              id="add-to-active-group"
              className="slds-m-top_small"
              label={`Add to "${orgGroup.name}"`}
              labelHelp="Adds the new org to the currently active group, otherwise the org will not be assigned to any group."
              checked={addToActiveOrgGroup}
              onChange={setAddToActiveOrgGroup}
            />
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
            <GridCol>
              <a href="https://docs.getjetstream.app/troubleshooting" target="_blank" rel="noopener noreferrer" className="slds-text-link">
                Trouble Connecting?
              </a>
            </GridCol>
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
      {!omitIcon && <Icon type="utility" icon="add" className="slds-button__icon slds-button__icon_left" omitContainer />}
      <span
        css={css`
          text-wrap: nowrap;
        `}
      >
        {label}
      </span>
    </Popover>
  );
};
