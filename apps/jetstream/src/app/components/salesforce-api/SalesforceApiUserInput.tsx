/** @jsx jsx */
import { jsx } from '@emotion/react';
import { HttpMethod, SalesforceOrgUi } from '@jetstream/types';
import { Grid, GridCol, Input, Select } from '@jetstream/ui';
import { FunctionComponent } from 'react';
import { useRecoilState } from 'recoil';
import { applicationCookieState } from '../../app-state';

function getDefaultUrl(defaultApiVersion: string) {
  return `/services/${defaultApiVersion}`;
}

export interface SalesforceApiUserInputProps {
  selectedOrg: SalesforceOrgUi;
  url: string;
  method: HttpMethod;
  loading: boolean;
  onUrlChange: (url: string) => void;
  onMethodChange: (method: HttpMethod) => void;
}

export const SalesforceApiUserInput: FunctionComponent<SalesforceApiUserInputProps> = ({
  selectedOrg,
  url,
  method,
  loading,
  onUrlChange,
  onMethodChange,
}) => {
  const [{ defaultApiVersion }] = useRecoilState(applicationCookieState);

  return (
    <Grid guttersDirect>
      <GridCol growNone>
        <Select id="salesforce-api-method" label="Method" isRequired>
          <select
            className="slds-select"
            id="salesforce-api-http-method"
            value={method}
            onChange={(event) => onMethodChange(event.target.value as HttpMethod)}
          >
            <option value={'GET'}>GET</option>
            <option value={'POST'}>POST</option>
            <option value={'PUT'}>PUT</option>
            <option value={'PATCH'}>PATCH</option>
            <option value={'DELETE'}>DELETE</option>
          </select>
        </Select>
      </GridCol>
      <GridCol grow>
        <Input
          label="URL Endpoint"
          isRequired
          labelHelp={`The URL entered will be appended to this org instance URL ${selectedOrg.instanceUrl}.`}
        >
          <input
            id="url"
            className="slds-input"
            placeholder={getDefaultUrl(defaultApiVersion)}
            value={url}
            disabled={loading}
            onChange={(event) => onUrlChange(event.target.value)}
          />
        </Input>
      </GridCol>
    </Grid>
  );
};

export default SalesforceApiUserInput;
