import { formatNumber } from '@jetstream/shared/ui-utils';
import { pluralizeFromNumber, pluralizeIfMultiple } from '@jetstream/shared/utils';
import { CompositeGraphRequest, CompositeRequestBody, Maybe } from '@jetstream/types';
import { Icon, Modal, Tooltip, Tree, TreeItems } from '@jetstream/ui';
import { Fragment, FunctionComponent, useEffect, useState } from 'react';
import { LoadMultiObjectRequestWithResult, RecordWithResponse } from './load-records-multi-object-types';
import classNames from 'classnames';
import isBoolean from 'lodash/isBoolean';

export interface LoadRecordsMultiObjectRecordModalProps {
  data: LoadMultiObjectRequestWithResult;
}

function getIcon(isSuccess?: Maybe<boolean>) {
  return isSuccess ? (
    <Icon type="utility" icon="success" className="slds-icon slds-icon-text-success slds-icon_xx-small" />
  ) : (
    <Icon type="utility" icon="error" className="slds-icon slds-icon-text-error slds-icon_xx-small" />
  );
}

function getParentTreeItem(item: CompositeGraphRequest, data: LoadMultiObjectRequestWithResult): TreeItems {
  /**
   * Item is finished, show icon and add text color
   */
  if (isBoolean(data.dataWithResultsByGraphId[item.graphId].isSuccess)) {
    const graphResults = data.dataWithResultsByGraphId[item.graphId];
    return {
      id: `parent-${item.graphId}`,
      label: (
        <div
          className={classNames({
            'slds-text-color_success': !!graphResults.isSuccess,
            'slds-text-color_error': !graphResults.isSuccess,
          })}
        >
          {getIcon(graphResults.isSuccess)} Record Group - {formatNumber(item.compositeRequest?.length)}{' '}
          {pluralizeFromNumber('record', item.compositeRequest?.length)}
        </div>
      ),
      treeItems: item.compositeRequest?.map((item) => getTreeItem(data.recordWithResponseByRefId[item.referenceId], item)),
    };
  }
  /**
   * Item is not yet processed
   */
  return {
    id: `parent-${item.graphId}`,
    label: `Record Group - ${formatNumber(item.compositeRequest?.length)} ${pluralizeFromNumber('record', item.compositeRequest?.length)}`,
    treeItems: item.compositeRequest?.map((item) => getTreeItem(data.recordWithResponseByRefId[item.referenceId], item)),
  };
}

function getTreeItem(record: RecordWithResponse, item?: CompositeRequestBody): TreeItems {
  if (record.response) {
    const extraContent = (
      <Tooltip
        id={`tooltip-${record.referenceId}`}
        content={
          <div>
            {record.request?.body && (
              <div>
                <div>Request:</div>
                {JSON.stringify(record.request.body).slice(0, 1000)}
              </div>
            )}
          </div>
        }
      >
        {getIcon(record.response.body.success)}
      </Tooltip>
    );

    return {
      id: record.referenceId,
      label: (
        <div
          className={classNames({
            'slds-text-color_success': !!record.response.body.success,
            'slds-text-color_error': !record.response.body.success,
          })}
        >
          {extraContent} {record.referenceId} ({record.sobject} - {record.operation})
          {record.response.body.id ? <div>Record Id: {record.response.body.id}</div> : undefined}
          {record.response.body.message ? <div>{record.response.body.message}</div> : undefined}
        </div>
      ),
    };
  }
  return {
    id: record.referenceId,
    label: `${record.referenceId} (${record.sobject} - ${record.operation})`,
  };
}

export const LoadRecordsMultiObjectRecordModal: FunctionComponent<LoadRecordsMultiObjectRecordModalProps> = ({ data }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [items, setItems] = useState<TreeItems[]>([]);

  useEffect(() => {
    if (isOpen && data) {
      setItems(
        data.data.map(
          (item, i) => getParentTreeItem(item, data)
          // item.compositeRequest.length <= 1
          // ? getTreeItem(data.recordWithResponseByRefId[item.compositeRequest[0].referenceId])
          // : getParentTreeItem(item, data)
        )
      );
    } else {
      setItems([]);
    }
  }, [isOpen, data]);

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
