/* eslint-disable react/jsx-no-useless-fragment */
import { css } from '@emotion/react';
import { Fragment, FunctionComponent, useState } from 'react';
import { InstanceProps, create } from 'react-modal-promise';
import Picklist from '../form/picklist/Picklist';
import Modal from './Modal';

export interface XlsxSheetSelectionModalPromiseProps extends InstanceProps<string, never> {
  isOpen: boolean;
  worksheets: string[];
  instanceId: any;
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
              onChange={(items) => items?.length && setWorksheet(items[0].id)}
              selectedItemIds={[worksheet]}
            ></Picklist>
          </div>
        </Modal>
      )}
    </Fragment>
  );
};

export const XlsxSheetSelectionModalPromise = create<XlsxSheetSelectionModalPromiseProps, string>(XlsxSheetSelectionModalPromiseModal);

export const onParsedMultipleWorkbooks = async (worksheets: string[]): Promise<string> => {
  return await XlsxSheetSelectionModalPromise({ worksheets });
};
