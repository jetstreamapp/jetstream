import { logger } from '@jetstream/shared/client-logger';
import { ANALYTICS_KEYS } from '@jetstream/shared/constants';
import { InputReadFileContent, SalesforceOrgUi } from '@jetstream/types';
import { FileSelector, Modal, Spinner, fireToast } from '@jetstream/ui';
import { FunctionComponent, useState } from 'react';
import { useSetRecoilState } from 'recoil';
import { apexHistoryState } from '../../anonymous-apex/apex.state';
import { useAmplitude } from '../../core/analytics';
import { queryHistoryState } from '../../query/QueryHistory/query-history.state';
import { processHistoryFile } from './org-list.utils';

export interface OrgImportHistoryModalProps {
  org: SalesforceOrgUi;
  onClose: () => void;
}

export const OrgImportHistoryModal: FunctionComponent<OrgImportHistoryModalProps> = ({ org, onClose }) => {
  const { trackEvent } = useAmplitude();
  const [loading, setLoading] = useState(false);

  const setQueryHistory = useSetRecoilState(queryHistoryState);
  const setApexHistory = useSetRecoilState(apexHistoryState);

  async function handleAddAttachment(fileContent: InputReadFileContent<ArrayBuffer>) {
    try {
      setLoading(true);
      const { apexHistory, queryHistory } = await processHistoryFile(org, fileContent.content);

      setQueryHistory((prevItem) => {
        const newItems = { ...prevItem };
        queryHistory.forEach((item) => {
          newItems[item.key] = item;
        });
        return newItems;
      });

      setApexHistory((prevItem) => {
        const newItems = { ...prevItem };
        apexHistory.forEach((item) => {
          newItems[item.key] = item;
        });
        return newItems;
      });

      trackEvent(ANALYTICS_KEYS.org_list_imported_history, { success: true });

      onClose();

      fireToast({
        message: 'History imported successfully',
        type: 'success',
      });
    } catch (ex) {
      fireToast({
        message: 'There was a problem importing your history',
        type: 'error',
      });
      logger.warn('Error importing history', ex);
      trackEvent(ANALYTICS_KEYS.org_list_imported_history, { success: false, message: ex.message });
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal
      header="Export your org's history"
      footer={
        <button className="slds-button slds-button_brand" onClick={() => onClose()}>
          Close
        </button>
      }
      size="md"
      onClose={onClose}
    >
      <div className="slds-is-relative">
        {loading && <Spinner />}
        <FileSelector
          id="history-import"
          label="Upload zip file"
          onReadFile={handleAddAttachment}
          disabled={loading}
          accept={['.zip']}
          buttonLabel="Upload zip file"
          isRequired
          // labelHelp="The zip file should be in the format exported from the 'Export your org's history' modal. There should be a file named 'all-apex.json and all-queries.json' and this is what will be imported."
        />
        <p>The zip file should be in the format exported from the "Export your org's history" modal.</p>
        <p>There should be a file named "all-apex.json" and "all-queries.json" which is the source for the import.</p>
      </div>
    </Modal>
  );
};
