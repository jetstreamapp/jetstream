import { queryAll } from '@jetstream/shared/data';
import { getApexLogsToDeleteQuery } from '@jetstream/shared/ui-utils';
import { AsyncJobNew, SalesforceOrgUi } from '@jetstream/types';
import { Modal, RadioButton, RadioGroup, ScopedNotification, Spinner } from '@jetstream/ui';
import { fromJetstreamEvents } from '@jetstream/ui-core';
import { Fragment, FunctionComponent, useEffect, useRef, useState } from 'react';

type WhichUsers = 'ALL' | 'CURRENT';
type Status = 'NOT_STARTED' | 'LOADING' | 'ERROR';
// type WhichTimeFrame = 'ALL' | 'SPECIFIED';

export interface PurgeLogsModalProps {
  selectedOrg: SalesforceOrgUi;
  onModalClose: () => void;
}

export const PurgeLogsModal: FunctionComponent<PurgeLogsModalProps> = ({ selectedOrg, onModalClose }) => {
  const isMounted = useRef(true);
  const [status, setStatus] = useState<Status>('NOT_STARTED');
  const [whichUsers, setWhichUsers] = useState<WhichUsers>('ALL');

  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);

  async function deleteLogs() {
    try {
      setStatus('LOADING');
      const records = await queryAll<{ Id: string }>(
        selectedOrg,
        getApexLogsToDeleteQuery(whichUsers === 'CURRENT' ? selectedOrg.userId : undefined)
      );
      if (isMounted.current) {
        if (!records.queryResults.records.length) {
          onModalClose();
        }
        const jobs: AsyncJobNew[] = [
          {
            type: 'BulkDelete',
            title: `Delete Logs`,
            org: selectedOrg,
            meta: { records: records.queryResults.records },
          },
        ];
        fromJetstreamEvents.emit({ type: 'newJob', payload: jobs });
        onModalClose();
      }
    } catch (ex) {
      setStatus('ERROR');
    }
  }

  return (
    <Modal
      header="Delete Logs"
      footer={
        <Fragment>
          <button className="slds-button slds-button_neutral" onClick={() => onModalClose()} disabled={status === 'LOADING'}>
            Cancel
          </button>
          <button className="slds-button slds-button_brand" onClick={deleteLogs} disabled={status === 'LOADING'}>
            Delete Logs
          </button>
        </Fragment>
      }
      onClose={() => {
        if (status !== 'LOADING') {
          onModalClose();
        }
      }}
    >
      <div className="slds-is-relative">
        {status === 'LOADING' && <Spinner />}

        {status === 'ERROR' && (
          <ScopedNotification theme="error" className="slds-m-top_medium">
            There was a problem deleting your logs, try again.
          </ScopedNotification>
        )}

        <p className="slds-text-align_center">
          Salesforce limits the cumulative size of logs in a given 24 hour window. By deleting logs, you can free up space so logs will
          continue to be generated.
        </p>

        <div className="slds-align_absolute-center">
          <RadioGroup label="Which users" isButtonGroup>
            <RadioButton
              id="all-users-all"
              name="all-users"
              label="All Users"
              value="ALL"
              checked={whichUsers === 'ALL'}
              onChange={(value) => setWhichUsers(value as WhichUsers)}
              disabled={status === 'LOADING'}
            />
            <RadioButton
              id="all-users-current"
              name="all-users"
              label="Just Me"
              value="CURRENT"
              checked={whichUsers === 'CURRENT'}
              onChange={(value) => setWhichUsers(value as WhichUsers)}
              disabled={status === 'LOADING'}
            />
          </RadioGroup>
        </div>
      </div>
    </Modal>
  );
};

export default PurgeLogsModal;
