import { FieldMapping, InsertUpdateUpsertDelete, Maybe } from '@jetstream/types';
import { Alert, AutoFullHeightContainer, DataTable, Modal, RowWithKey, getColumnsForGenericTable } from '@jetstream/ui';
import { checkForDuplicateRecords } from '@jetstream/ui-core';
import { FunctionComponent, useEffect, useRef, useState } from 'react';
import { Column } from 'react-data-grid';

const DUPE_COLUMN = '_DUPLICATE';

const getRowId = ({ _key }: any) => _key;

function getColumnDefinitions(headers: string[], duplicateKey: string): Column<RowWithKey>[] {
  return getColumnsForGenericTable([
    { key: DUPE_COLUMN, label: `Duplicate Value (${duplicateKey})`, columnProps: { width: 200, filters: [] } },
    ...headers.map((header) => ({ key: header, label: header })),
  ]);
}

export interface LoadRecordsDuplicateWarningProps {
  className?: string;
  inputFileHeader: string[] | null;
  fieldMapping: FieldMapping;
  inputFileData: any[];
  loadType: InsertUpdateUpsertDelete;
  isCustomMetadata?: boolean;
  externalId?: string;
}

export const LoadRecordsDuplicateWarning: FunctionComponent<LoadRecordsDuplicateWarningProps> = ({
  className,
  inputFileHeader,
  fieldMapping,
  inputFileData,
  loadType,
  isCustomMetadata = false,
  externalId,
}) => {
  const isMounted = useRef(true);
  const modalRef = useRef();
  const [columns, setColumns] = useState<Maybe<Column<RowWithKey>[]>>(null);
  const [rows, setRows] = useState<Maybe<RowWithKey[]>>(null);
  const [isOpen, setIsOpen] = useState(false);

  const [duplicates] = useState(() => checkForDuplicateRecords(fieldMapping, inputFileData, loadType, isCustomMetadata, externalId));

  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);

  useEffect(() => {
    if (duplicates && inputFileHeader) {
      setRows(
        duplicates.duplicateRecords
          .flatMap(([key, value]) =>
            value.map((row) => ({
              [DUPE_COLUMN]: key,
              ...row,
            }))
          )
          .map((row, i) => ({ ...row, _key: i }))
      );
      setColumns(getColumnDefinitions(inputFileHeader, duplicates.duplicateKey));
    } else {
      setColumns(null);
      setRows(null);
    }
  }, [duplicates, inputFileHeader]);

  if (!duplicates?.duplicateRecords.length) {
    return null;
  }

  return (
    <div className={className}>
      {duplicates.duplicateRecords?.length && (
        <Alert type="warning" leadingIcon="info">
          <span>You have duplicate rows in your spreadsheet.</span>
          <button className="slds-button slds-m-left_x-small" onClick={() => setIsOpen(true)}>
            View Duplicates
          </button>
          .
        </Alert>
      )}

      {isOpen && (
        <Modal
          ref={modalRef}
          size="lg"
          header="Duplicate Records"
          closeOnBackdropClick
          tagline={
            isCustomMetadata
              ? 'You can still load your file, but only one of each set of duplicate records will be loaded.'
              : 'You can still load your file, but you may get an error for these records.'
          }
          footer={
            <div>
              <button className="slds-button slds-button_neutral" onClick={() => setIsOpen(false)}>
                Close
              </button>
            </div>
          }
          onClose={() => setIsOpen(false)}
        >
          <div className="slds-is-relative slds-scrollable_x">
            <AutoFullHeightContainer fillHeight setHeightAttr bottomBuffer={300}>
              {rows && columns && <DataTable columns={columns} data={rows} getRowKey={getRowId} />}
            </AutoFullHeightContainer>
          </div>
        </Modal>
      )}
    </div>
  );
};

export default LoadRecordsDuplicateWarning;
