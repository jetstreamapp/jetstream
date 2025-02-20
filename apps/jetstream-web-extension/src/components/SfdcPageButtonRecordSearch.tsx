import { Grid, Input } from '@jetstream/ui';
import { useState } from 'react';
import browser from 'webextension-polyfill';
import '../sfdc-styles-shim.scss';

interface SfdcPageButtonRecordSearchProps {
  sfHost: string;
}

export function SfdcPageButtonRecordSearch({ sfHost }: SfdcPageButtonRecordSearchProps) {
  const [recordId, setRecordId] = useState('');

  const isValidRecordId = recordId.length === 15 || recordId.length === 18;

  function handleSubmit(ev: React.FormEvent<HTMLFormElement>) {
    ev.preventDefault();
    if (!isValidRecordId) {
      return;
    }
    window.open(`${browser.runtime.getURL('app.html')}?host=${sfHost}&action=VIEW_RECORD&actionValue=${recordId}`, '_blank');
  }

  function handleEditRecord() {
    if (!isValidRecordId) {
      return;
    }
    window.open(`${browser.runtime.getURL('app.html')}?host=${sfHost}&action=EDIT_RECORD&actionValue=${recordId}`, '_blank');
  }

  return (
    <form onSubmit={handleSubmit}>
      <Input label="Open record in Jetstream">
        <input
          className="slds-input"
          autoFocus
          placeholder="Enter a record id"
          minLength={15}
          maxLength={18}
          value={recordId}
          onChange={(event) => setRecordId(event.target.value)}
        />
      </Input>
      <Grid className="slds-m-top_x-small">
        <button className="slds-button slds-button_stretch slds-button_brand" type="submit" disabled={!isValidRecordId}>
          View Record
        </button>
        <button
          className="slds-button slds-button_stretch slds-button_neutral"
          type="button"
          disabled={!isValidRecordId}
          onClick={() => handleEditRecord()}
        >
          Edit Record
        </button>
      </Grid>
    </form>
  );
}
