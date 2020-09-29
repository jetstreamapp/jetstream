/** @jsx jsx */
import { jsx } from '@emotion/core';
import { SalesforceOrgUi } from '@jetstream/types';
import { Modal } from '@jetstream/ui';
import { DescribeGlobalSObjectResult, Field } from 'jsforce';
import { Fragment, FunctionComponent, useState } from 'react';

export interface LoadRecordsFieldMappingProps {
  selectedOrg: SalesforceOrgUi;
  selectedSObject: DescribeGlobalSObjectResult;
  fields: Field[]; // TODO: ensure these are sorted etc.. and we need a way to get related field data and show that as well
  // TODO: existing mapping could be passed in
  // TODO: what about related objects for external id mapping
  fileData: any[]; // first row will be used to obtain header
  onClose: () => void; // TODO: pass data to parent to be saved
}

export const LoadRecordsFieldMapping: FunctionComponent<LoadRecordsFieldMappingProps> = ({
  selectedOrg,
  selectedSObject,
  fields,
  fileData,
  onClose,
}) => {
  const [headers] = useState<string[]>(Object.keys(fileData[0]));
  const [firstRow] = useState<string[]>(fileData[0]);

  function handleSave() {
    onClose(); // FIXME:
  }

  return (
    <Modal
      header="Map fields"
      tagline={selectedSObject.label}
      footer={
        <Fragment>
          <button className="slds-button slds-button_neutral" onClick={() => onClose()}>
            Cancel
          </button>
          <button className="slds-button slds-button_brand" onClick={handleSave}>
            Save
          </button>
        </Fragment>
      }
      size="lg"
      onClose={() => onClose()}
    >
      <div className="slds-grid slds-grid_vertical">
        <div className="slds-scrollable slds-grow">
          <table className="slds-table slds-table_bordered">
            <thead>
              <tr className="slds-line-height_reset">
                <th scope="col">
                  <div className="slds-truncate" title="Example Data">
                    Example Data
                  </div>
                </th>
                <th scope="col">
                  <div className="slds-truncate" title="Field from File">
                    Field from File
                  </div>
                </th>
                <th scope="col">
                  <div className="slds-truncate" title="Salesforce Field">
                    Salesforce Field
                  </div>
                </th>
                <th scope="col"></th>
                <th scope="col"></th>
              </tr>
            </thead>
            <tbody>
              {headers.map((header, i) => (
                <tr key={i}>
                  <td>
                    <div className="slds-truncate" title={`${firstRow[header] || ''}`}>
                      {firstRow[header]}
                    </div>
                  </td>
                  <th scope="row">
                    <div className="slds-truncate" title={header}>
                      {header}
                    </div>
                  </th>
                  <td>TODO: drop-down</td>
                  <td>show rel fields external id</td>
                  <td>del</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </Modal>
  );
};

export default LoadRecordsFieldMapping;
