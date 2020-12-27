/** @jsx jsx */
import { css, jsx } from '@emotion/react';
import { Fragment, FunctionComponent, useState } from 'react';
import { createModal } from 'react-modal-promise';
import Picklist from '../form/picklist/Picklist';
import Modal from './Modal';

export interface XlsxSheetSelectionModalPromiseProps /** extends ModalProps */ {
  isOpen: boolean;
  worksheets: string[];
  onResolve: (params?: string) => void;
}

const XlsxSheetSelectionModalPromiseModal: FunctionComponent<XlsxSheetSelectionModalPromiseProps> = ({ isOpen, worksheets, onResolve }) => {
  const [worksheet, setWorksheet] = useState(worksheets[0]);

  return (
    <Fragment>
      {isOpen && (
        <Modal
          header={'Select Worksheet'}
          tagline="This spreadsheet contains multiple worksheets"
          closeOnBackdropClick={false}
          footer={
            <Fragment>
              <button className="slds-button slds-button_brand" onClick={() => onResolve(worksheet)}>
                Confirm
              </button>
            </Fragment>
          }
          onClose={() => onResolve()}
        >
          <div
            css={css`
              min-height: 350px;
            `}
          >
            <Picklist
              label="Worksheet"
              multiSelection={false}
              allowDeselection={false}
              scrollLength={5}
              items={worksheets.map((value) => ({ id: value, label: value, value }))}
              onChange={(items) => setWorksheet(items[0].id)}
              selectedItemIds={[worksheet]}
            ></Picklist>
          </div>
        </Modal>
      )}
    </Fragment>
  );
};

export const XlsxSheetSelectionModalPromise = createModal<XlsxSheetSelectionModalPromiseProps, string>(XlsxSheetSelectionModalPromiseModal);
