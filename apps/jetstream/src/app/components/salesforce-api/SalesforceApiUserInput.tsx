import { hasModifierKey, isEnterKey } from '@jetstream/shared/ui-utils';
import { HttpMethod, ListItem, SalesforceOrgUi } from '@jetstream/types';
import { ComboboxWithItems, Grid, GridCol, Input } from '@jetstream/ui';
import { applicationCookieState } from '@jetstream/ui-core';
import { FunctionComponent, KeyboardEvent } from 'react';
import { useRecoilState } from 'recoil';

function getDefaultUrl(defaultApiVersion: string) {
  return `/services/${defaultApiVersion}`;
}

const MethodListItems: ListItem<string, HttpMethod>[] = [
  { id: 'GET', value: 'GET', label: 'GET' },
  { id: 'POST', value: 'POST', label: 'POST' },
  { id: 'PUT', value: 'PUT', label: 'PUT' },
  { id: 'PATCH', value: 'PATCH', label: 'PATCH' },
  { id: 'DELETE', value: 'DELETE', label: 'DELETE' },
];

export interface SalesforceApiUserInputProps {
  selectedOrg: SalesforceOrgUi;
  url: string;
  method: HttpMethod;
  loading: boolean;
  onUrlChange: (url: string) => void;
  onMethodChange: (method: HttpMethod) => void;
  onAltEnter: () => void;
}

export const SalesforceApiUserInput: FunctionComponent<SalesforceApiUserInputProps> = ({
  selectedOrg,
  url,
  method,
  loading,
  onUrlChange,
  onMethodChange,
  onAltEnter,
}) => {
  const [{ defaultApiVersion }] = useRecoilState(applicationCookieState);

  function handleKeyUp(event: KeyboardEvent<HTMLElement>) {
    if (onAltEnter && hasModifierKey(event) && isEnterKey(event)) {
      onAltEnter();
    }
  }

  return (
    <Grid guttersDirect>
      <GridCol growNone size={3}>
        <ComboboxWithItems
          comboboxProps={{
            label: 'Method',
            itemLength: 5,
          }}
          items={MethodListItems}
          selectedItemId={method}
          onSelected={(item) => onMethodChange(item.value as HttpMethod)}
        />
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
            onKeyDown={handleKeyUp}
            onChange={(event) => onUrlChange(event.target.value)}
          />
        </Input>
      </GridCol>
    </Grid>
  );
};

export default SalesforceApiUserInput;
