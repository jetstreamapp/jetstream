import { SalesforceOrg } from '@jetstream/types';
import { Icon, Input, Popover, Radio, RadioGroup } from '@jetstream/ui';
import isString from 'lodash/isString';
import React, { Fragment, FunctionComponent, useEffect, useState } from 'react';
import { useRecoilState } from 'recoil';
import { applicationCookieState } from '../../app-state';
import { logger } from '@jetstream/shared/client-logger';

type OrgType = 'prod' | 'sandbox' | 'pre-release' | 'custom';

const loginUrlMap = {
  prod: 'https://login.salesforce.com',
  sandbox: 'https://test.salesforce.com',
  'pre-release': 'https://prerellogin.pre.salesforce.com',
};

let windowRef: Window | undefined;

// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface AddOrgProps {
  onAddOrg: (org: SalesforceOrg) => void;
}

export const AddOrg: FunctionComponent<AddOrgProps> = ({ onAddOrg }) => {
  const [orgType, setOrgType] = useState<OrgType>('prod');
  const [customUrl, setCustomUrl] = useState<string>('');
  const [loginUrl, setLoginUrl] = useState<string>(null);
  const [applicationState] = useRecoilState(applicationCookieState);

  useEffect(() => {
    let url: string;
    if (orgType === 'custom') {
      url = customUrl;
    } else {
      url = loginUrlMap[orgType] || 'https://login.salesforce.com';
    }
    setLoginUrl(url);
  }, [orgType, customUrl]);

  function handleAddOrg() {
    // open window, listen to events
    window.removeEventListener('message', handleWindowEvent);
    const strWindowFeatures = 'toolbar=no, menubar=no, width=1025, height=700';
    const url = `${applicationState.serverUrl}/oauth/sfdc/auth?loginUrl=${encodeURIComponent(loginUrl)}&clientUrl=${encodeURIComponent(
      document.location.origin
    )}`;
    windowRef = window.open(url, 'Add Salesforce Org', strWindowFeatures);
    window.addEventListener('message', handleWindowEvent, false);
  }

  function handleWindowEvent(event: MessageEvent) {
    if (isString(event.data)) {
      try {
        const orgInfo = JSON.parse(event.data);
        // ensure from our origin // FIXME:
        logger.log({ orgInfo });
        onAddOrg(orgInfo);
        if (windowRef) {
          windowRef.close();
        }
      } catch (ex) {
        // TODO: tell user there was a problem
      }
    }
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

          <Input
            label="Custom Salesforce Url"
            isRequired={false}
            hasError={false}
            errorMessageId="Error"
            errorMessage="This is not valid"
            leftAddon="https://"
            rightAddon=".my.salesforce.com"
          >
            <input
              id="org-custom-url"
              className="slds-input"
              placeholder="org-domain"
              disabled={orgType !== 'custom'}
              value={customUrl}
              onChange={(event) => setCustomUrl(event.target.value)}
            />
          </Input>
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
