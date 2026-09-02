import { css } from '@emotion/react';
import { ANALYTICS_KEYS, SFDC_LOGIN_URL_PRE_RELEASE, SFDC_LOGIN_URL_PROD, SFDC_LOGIN_URL_SANDBOX } from '@jetstream/shared/constants';
import { addOrg } from '@jetstream/shared/ui-utils';
import { AddOrgHandlerFn, SalesforceOrgUi } from '@jetstream/types';
import { Checkbox, CheckboxToggle, Grid, GridCol, Icon, Input, Popover, PopoverRef, Radio, RadioGroup } from '@jetstream/ui';
import { fromAppState } from '@jetstream/ui/app-state';
import classNames from 'classnames';
import { useAtomValue } from 'jotai';
import { FunctionComponent, useMemo, useRef, useState } from 'react';
import { useAmplitude } from '..';
import { parseSalesforceLoginUrl } from './salesforce-login-url.utils';

type OrgType = 'prod' | 'sandbox' | 'pre-release' | 'custom';

const loginUrlMap = {
  prod: SFDC_LOGIN_URL_PROD,
  sandbox: SFDC_LOGIN_URL_SANDBOX,
  'pre-release': SFDC_LOGIN_URL_PRE_RELEASE,
};

/**
 * Orgs connected through login.salesforce.com store a login endpoint or a legacy instance url rather
 * than a My Domain, so reconnecting those falls back to the production login instead of prefilling a
 * custom domain that was never theirs.
 *
 * The prefill is the full host rather than the bare domain: it is what re-parsing is guaranteed to
 * round-trip on, so reconnecting always lands on the host the org actually serves.
 */
function getExistingOrgDomain(existingOrg?: SalesforceOrgUi): string | null {
  if (!existingOrg?.instanceUrl) {
    return null;
  }
  const parsed = parseSalesforceLoginUrl(existingOrg.instanceUrl);
  return parsed.success ? parsed.loginUrl.replace(/^https:\/\//, '') : null;
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
  const [orgType, setOrgType] = useState<OrgType>(() => (getExistingOrgDomain(existingOrg) ? 'custom' : 'prod'));
  const [customUrl, setCustomUrl] = useState<string>(() => getExistingOrgDomain(existingOrg) || '');
  const [advancedOptionsEnabled, setAdvancedOptionsEnabled] = useState(false);
  const [addLoginTrue, setAddLoginTrue] = useState(false);
  const [addToActiveOrgGroup, setAddToActiveOrgGroup] = useState(true);
  const applicationState = useAtomValue(fromAppState.applicationCookieState);
  const orgGroup = useAtomValue(fromAppState.jetstreamActiveGroupSelector);

  const parsedCustomUrl = useMemo(() => parseSalesforceLoginUrl(customUrl), [customUrl]);
  const showCustomUrlError = orgType === 'custom' && !!customUrl.trim() && !parsedCustomUrl.success;
  const loginUrl = orgType === 'custom' ? (parsedCustomUrl.success ? parsedCustomUrl.loginUrl : null) : loginUrlMap[orgType];
  const canContinue = !!loginUrl;

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
      isReconnect: !!existingOrg,
    });
  }

  function handleReset() {
    if (existingOrg) {
      return;
    }
    setOrgType('prod');
    setCustomUrl('');
    setAdvancedOptionsEnabled(false);
    setAddLoginTrue(false);
    setAddToActiveOrgGroup(true);
  }

  return (
    // TODO: figure out way to close this once an org is added - this was fixed, but it caused the component to fully re-render each time!
    <Popover
      ref={popoverRef}
      size="large"
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
              name="org-type"
              label="Production / Developer"
              value="prod"
              checked={orgType === 'prod'}
              onChange={() => setOrgType('prod')}
            />
            <Radio
              name="org-type"
              label="Sandbox (test.salesforce.com)"
              value="sandbox"
              checked={orgType === 'sandbox'}
              onChange={() => setOrgType('sandbox')}
            />
            <Radio
              name="org-type"
              label="Pre-release"
              value="pre-release"
              checked={orgType === 'pre-release'}
              onChange={() => setOrgType('pre-release')}
            />
            <Radio
              name="org-type"
              label="Custom Login URL"
              value="custom"
              checked={orgType === 'custom'}
              onChange={() => setOrgType('custom')}
            />
          </RadioGroup>

          {orgType === 'custom' && (
            <Input
              id="org-custom-url"
              label="Salesforce Login URL"
              labelHelp="Enter your My Domain, or paste any Salesforce URL. A domain containing -- is treated as a sandbox unless it names another environment, such as .develop."
              isRequired
              hasError={showCustomUrlError}
              errorMessageId="org-custom-url-error"
              errorMessage={!parsedCustomUrl.success ? parsedCustomUrl.error : null}
              helpText={
                parsedCustomUrl.success ? (
                  <Grid vertical>
                    <span className="slds-truncate" title={parsedCustomUrl.loginUrl}>
                      {parsedCustomUrl.loginUrl}
                    </span>
                    {parsedCustomUrl.isSandbox && (
                      <span>
                        <Icon
                          type="utility"
                          icon="success"
                          className="slds-icon slds-icon_xx-small slds-icon-text-success slds-m-right_xx-small"
                          omitContainer
                        />
                        Sandbox detected
                      </span>
                    )}
                  </Grid>
                ) : null
              }
            >
              <input
                id="org-custom-url"
                className="slds-input"
                placeholder="acme or acme--uat.sandbox"
                value={customUrl}
                aria-describedby={showCustomUrlError ? 'org-custom-url-error' : undefined}
                aria-invalid={showCustomUrlError}
                autoComplete="off"
                spellCheck={false}
                onChange={(event) => setCustomUrl(event.target.value || '')}
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
              label="Advanced options"
              labelPosition="right"
              ariaExpanded={advancedOptionsEnabled}
              ariaControls="advanced-settings"
              onChange={setAdvancedOptionsEnabled}
            />
            <div id="advanced-settings">
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
              <button className="slds-button slds-button_brand" onClick={handleAddOrg} disabled={!canContinue}>
                Continue
              </button>
            </GridCol>
          </Grid>
        </footer>
      }
      buttonProps={{
        className: classNames('slds-button', className),
        disabled,
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
