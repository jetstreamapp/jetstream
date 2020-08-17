import { addOrg } from '@jetstream/shared/ui-utils';
import { SalesforceOrgUi } from '@jetstream/types';
import { Icon, Input, Popover, Radio, RadioGroup } from '@jetstream/ui';
import React, { Fragment, FunctionComponent, useEffect, useState } from 'react';
import { useRecoilState } from 'recoil';
import { applicationCookieState } from '../../app-state';

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
  onAddOrg: (org: SalesforceOrgUi) => void;
}

export const AddOrg: FunctionComponent<AddOrgProps> = ({ onAddOrg }) => {
  const [orgType, setOrgType] = useState<OrgType>('prod');
  const [customUrl, setCustomUrl] = useState<string>('');
  const [loginUrl, setLoginUrl] = useState<string>(null);
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

  // FIXME: we should have a way to know what org was being "fixed" and always replace it in the DB and here
  function handleAddOrg() {
    addOrg({ serverUrl: applicationState.serverUrl, loginUrl }, (addedOrg: SalesforceOrgUi) => {
      // TODO: send event to parent with fixed org or something
      onAddOrg(addedOrg);
    });
  }

  return (
    // TODO: figure out way to close this once an org is added - this was fixed, but it caused the component to fully re-render each time!
    <Popover
      placement="bottom-end"
      header={
        <header className="slds-popover__header">
          <h2 className="slds-truncate slds-text-heading_small" title="Add New Org">
            Add New Org
          </h2>
        </header>
      }
      content={
        <Fragment>
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
                onChange={(event) => setCustomUrl(event.target.value)}
              />
            </Input>
          )}
        </Fragment>
      }
      footer={
        <footer className="slds-popover__footer">
          <div className="slds-grid slds-grid_vertical-align-center">
            <button className="slds-button slds-button_brand slds-col_bump-left" onClick={handleAddOrg}>
              Continue
            </button>
          </div>
        </footer>
      }
    >
      <button className="slds-button">
        <Icon type="utility" icon="add" className="slds-button__icon slds-button__icon_left" omitContainer />
        Add Org
      </button>
    </Popover>
  );
};

export default AddOrg;
