/** @jsx jsx */
import { jsx } from '@emotion/react';
import { formatNumber } from '@jetstream/shared/ui-utils';
import { pluralizeIfMultiple } from '@jetstream/shared/utils';
import { Modal, Tree, TreeItems } from '@jetstream/ui';
import { Fragment, FunctionComponent, useEffect, useState } from 'react';
import { LoadMultiObjectRequestWithResult } from './load-records-multi-object-types';

export interface LoadRecordsMultiObjectRecordModalProps {
  data: LoadMultiObjectRequestWithResult;
}

export const LoadRecordsMultiObjectRecordModal: FunctionComponent<LoadRecordsMultiObjectRecordModalProps> = ({ data }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [items, setItems] = useState<TreeItems[]>([]);

  useEffect(() => {
    if (data) {
      setItems(
        data.data.map(
          (item, i): TreeItems => {
            if (item.compositeRequest.length <= 1) {
              const record = data.recordWithResponseByRefId[item.compositeRequest[0].referenceId];
              return {
                id: record.referenceId,
                label: `${record.referenceId} (${record.sobject} - ${record.operation})`,
              };
            } else {
              return {
                id: `parent-${item.graphId}`,
                label: `Record Group - ${formatNumber(item.compositeRequest.length)} related records`,
                treeItems: item.compositeRequest.map(
                  (item): TreeItems => {
                    const record = data.recordWithResponseByRefId[item.referenceId];
                    return {
                      id: record.referenceId,
                      label: `${record.referenceId} (${record.sobject} - ${record.operation})`,
                      title: JSON.stringify(item.body, null, 2),
                    };
                  }
                ),
              };
            }
          }
        )
      );
    } else {
      setItems([]);
    }
  }, [data]);

  return (
    <Fragment>
      {isOpen && (
        <Modal
          header={`${formatNumber(data.data.length)} Record ${pluralizeIfMultiple('Group', data.data)}`}
          footer={
            <button className="slds-button slds-button_neutral" onClick={() => setIsOpen(false)}>
              Close
            </button>
          }
          closeOnEsc
          closeOnBackdropClick
          onClose={() => setIsOpen(false)}
        >
          <div>
            <Tree header="Record Groups" items={items} />
          </div>
        </Modal>
      )}
      <button className="slds-button slds-m-left_x-small" onClick={() => setIsOpen(true)}>
        View Records
      </button>
    </Fragment>
  );
};

export default LoadRecordsMultiObjectRecordModal;
