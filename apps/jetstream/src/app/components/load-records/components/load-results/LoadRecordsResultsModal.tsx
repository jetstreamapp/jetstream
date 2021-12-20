import { ColDef, RowHeightParams } from '@ag-grid-community/core';
import { AutoFullHeightContainer, DataTable, Icon, Modal, Spinner } from '@jetstream/ui';
import { FunctionComponent, useEffect, useState } from 'react';

const COL_WIDTH_MAP = {
  _id: 195,
  _success: 110,
  _errors: 450,
};

const getRowHeight = (params: RowHeightParams): number | undefined | null => (params.node.data._errors ? 75 : 25);

export interface LoadRecordsResultsModalProps {
  type: 'results' | 'failures';
  loading?: boolean;
  header: string[];
  rows: any[];
  onDownload: (type: 'results' | 'failures', rows: any[]) => void;
  onClose: () => void;
}

export const LoadRecordsResultsModal: FunctionComponent<LoadRecordsResultsModalProps> = ({
  type,
  loading = false,
  header,
  rows,
  onDownload,
  onClose,
}) => {
  const [columns, setColumns] = useState<ColDef[]>(null);

  useEffect(() => {
    if (header) {
      setColumns(
        header.map((item) => ({
          headerName: item,
          colId: item,
          field: item,
          resizable: true,
          wrapText: item === '_errors', // TODO: figure out how to wrap
          cellClass: 'slds-line-clamp_small',
          // autoHeight: item === '_errors' ? true : undefined,
          width: COL_WIDTH_MAP[item],
          tooltipField: item,
        }))
      );
    }
  }, [header]);

  function handleDownload() {
    // TODO: allow user to choose filtered records to download
    onDownload(type, rows);
  }

  return (
    <div>
      <Modal
        size="lg"
        header="Load Results"
        closeOnBackdropClick
        footer={
          <div>
            <button className="slds-button slds-button_neutral" onClick={onClose}>
              Close
            </button>
            <button className="slds-button slds-button_brand" onClick={handleDownload} disabled={loading}>
              <Icon type="utility" icon="download" className="slds-button__icon slds-button__icon_left" omitContainer />
              Download
            </button>
          </div>
        }
        onClose={onClose}
      >
        <div className="slds-is-relative slds-scrollable_x">
          <AutoFullHeightContainer fillHeight setHeightAttr bottomBuffer={300}>
            {loading && <Spinner />}
            {rows && (
              <DataTable
                columns={columns}
                data={rows}
                agGridProps={{
                  getRowHeight,
                  enableCellTextSelection: true,
                }}
              />
            )}
          </AutoFullHeightContainer>
        </div>
      </Modal>
    </div>
  );
};

export default LoadRecordsResultsModal;
