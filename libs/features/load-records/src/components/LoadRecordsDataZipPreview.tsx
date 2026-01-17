import { css } from '@emotion/react';
import { findInvisibleUnicode } from '@jetstream/shared/utils';
import { Maybe } from '@jetstream/types';
import { DataTable, Icon } from '@jetstream/ui';
import JSZip from 'jszip';
import { ReactNode, useEffect, useState } from 'react';
import { Column } from 'react-data-grid';

const NUM_COLUMN = '_num';
const DEFAULT_ROW_HEIGHT = 35;

interface Row {
  [NUM_COLUMN]: number;
  name: string;
  invisibleChars: ReturnType<typeof findInvisibleUnicode>;
  hasMatchingRow: boolean;
}

const getRowId = (row: Row) => row.name;
const getRowHeight = (row: Row): number => {
  let height = DEFAULT_ROW_HEIGHT;
  if (row.invisibleChars.length > 0) {
    height += 30;
  }
  if (!row.hasMatchingRow) {
    height += 30;
  }
  return height;
};

const ZIP_COLUMNS: Column<Row>[] = [
  {
    key: NUM_COLUMN,
    name: '#',
    width: 75,
    resizable: false,
  },
  {
    name: 'Name',
    key: 'name',
    renderCell: ({ row }) => {
      const { invisibleChars, hasMatchingRow } = row;
      const errors: ReactNode[] = [];
      if (invisibleChars.length > 0) {
        errors.push(
          <span>
            <strong className="text-color_warning">
              <Icon icon="warning" type="utility" className="slds-icon slds-icon_x-small slds-icon-text-warning" /> Invisible characters
              detected in file name
            </strong>
            <div
              css={css`
                font-family: monospace;
                background-color: #f3f3f3;
                padding: 4px;
                display: inline-block;
                margin-top: 4px;
              `}
            >
              {invisibleChars.map((char, i) => (
                <span key={i} className="slds-m-left_x-small">
                  {char.codePoint}
                </span>
              ))}
            </div>
          </span>,
        );
      }
      if (!hasMatchingRow) {
        errors.push(
          <strong className="text-color_warning">
            <Icon icon="warning" type="utility" className="slds-icon slds-icon_x-small slds-icon-text-warning" /> Filename not found in your
            input file
          </strong>,
        );
      }
      return (
        <div>
          <p className="slds-truncate">{row.name}</p>
          {errors.map((error, index) => (
            <div key={index}>{error}</div>
          ))}
        </div>
      );
    },
  },
];

interface LoadRecordsDataZipPreviewProps {
  inputZipFileData: ArrayBuffer;
  rows: any[];
  binaryAttachmentBodyField: Maybe<string>;
  onWarnings: (hasWarnings: boolean) => void;
}

export function LoadRecordsDataZipPreview({
  inputZipFileData,
  rows,
  binaryAttachmentBodyField,
  onWarnings,
}: LoadRecordsDataZipPreviewProps) {
  const [files, setFiles] = useState<Row[] | null>(null);

  useEffect(() => {
    JSZip.loadAsync(inputZipFileData)
      .then((file) => {
        const files = Object.values(
          file.filter((path, file) => !path.startsWith('__MACOSX') && !file.name.includes('.DS_Store') && !file.dir),
        )
          .map((file) => file.name)
          .sort((a, b) => a.localeCompare(b))
          .map((name, i) => ({
            [NUM_COLUMN]: i + 1,
            name,
            invisibleChars: findInvisibleUnicode(name),
            hasMatchingRow: Object.values(rows).some((row) => {
              if (!row) {
                return false;
              }
              if (binaryAttachmentBodyField && row[binaryAttachmentBodyField] && row[binaryAttachmentBodyField] === name) {
                return true;
              }
              return Object.values(row).some((value) => value === name);
            }),
          }));
        onWarnings(files.some((file) => !file.hasMatchingRow || file.invisibleChars.length > 0));
        setFiles(files);
      })
      .catch((err) => setFiles([]));
  }, [binaryAttachmentBodyField, inputZipFileData, onWarnings, rows]);

  if (!files) {
    return null;
  }

  return <DataTable columns={ZIP_COLUMNS} data={files} rowHeight={getRowHeight} getRowKey={getRowId} />;
}
