/** @jsx jsx */
import { css, jsx } from '@emotion/react';
import { INPUT_ACCEPT_FILETYPES } from '@jetstream/shared/constants';
import { parseFile } from '@jetstream/shared/ui-utils';
import { InputReadFileContent, InsertUpdateUpsertDelete, SalesforceOrgUi } from '@jetstream/types';
import { ConnectedSobjectList, FileSelector, Grid, GridCol, XlsxSheetSelectionModalPromise } from '@jetstream/ui';
import { DescribeGlobalSObjectResult } from 'jsforce';
import { FunctionComponent } from 'react';
import Split from 'react-split';
import LoadRecordsLoadTypeButtons from '../components/LoadRecordsLoadTypeButtons';
import { FieldWithRelatedEntities } from '../load-records-types';
import { filterLoadSobjects } from '../utils/load-records-utils';

export interface LoadRecordsSelectObjectAndFileProps {
  selectedOrg: SalesforceOrgUi;
  sobjects: DescribeGlobalSObjectResult[];
  selectedSObject: DescribeGlobalSObjectResult;
  loadType: InsertUpdateUpsertDelete;
  externalIdFields: FieldWithRelatedEntities[];
  externalId: string;
  inputFilename: string;
  loadingFields: boolean;
  onSobjects: (sobjects: DescribeGlobalSObjectResult[]) => void;
  onSelectedSobject: (selectedSObject: DescribeGlobalSObjectResult) => void;
  onFileChange: (data: any[], headers: string[], filename: string) => void;
  onLoadTypeChange: (type: InsertUpdateUpsertDelete) => void;
  onExternalIdChange: (externalId?: string) => void;
}

export const LoadRecordsSelectObjectAndFile: FunctionComponent<LoadRecordsSelectObjectAndFileProps> = ({
  selectedOrg,
  selectedSObject,
  sobjects,
  loadType,
  externalIdFields,
  externalId,
  inputFilename,
  loadingFields,
  onSobjects,
  onSelectedSobject,
  onFileChange,
  onLoadTypeChange,
  onExternalIdChange,
  children,
}) => {
  async function handleFile({ content, filename }: InputReadFileContent) {
    const onParsedMultipleWorkbooks = async (worksheets: string[]): Promise<string> => {
      return await XlsxSheetSelectionModalPromise({ worksheets });
    };
    const { data, headers } = await parseFile(content, { onParsedMultipleWorkbooks });
    onFileChange(data, headers, filename);
  }

  function handleLoadTypeChange(type: InsertUpdateUpsertDelete, externalId?: string) {
    onLoadTypeChange(type);
    onExternalIdChange(externalId);
  }

  return (
    <Split
      sizes={[33, 77]}
      minSize={[200, 300]}
      gutterSize={sobjects?.length ? 10 : 0}
      className="slds-gutters"
      css={css`
        display: flex;
        flex-direction: row;
      `}
    >
      <div className="slds-p-horizontal_x-small">
        <ConnectedSobjectList
          selectedOrg={selectedOrg}
          sobjects={sobjects}
          selectedSObject={selectedSObject}
          filterFn={filterLoadSobjects}
          onSobjects={onSobjects}
          onSelectedSObject={onSelectedSobject}
        />
      </div>
      <div className="slds-p-horizontal_x-small">
        <Grid vertical>
          <GridCol>
            <Grid verticalAlign="center">
              <GridCol growNone>
                <FileSelector
                  id="load-record-file"
                  label="File to Load"
                  filename={inputFilename}
                  accept={[INPUT_ACCEPT_FILETYPES.CSV, INPUT_ACCEPT_FILETYPES.EXCEL]}
                  userHelpText="Choose CSV or XLSX file to upload"
                  onReadFile={handleFile}
                ></FileSelector>
              </GridCol>
            </Grid>
          </GridCol>
          <GridCol>
            <LoadRecordsLoadTypeButtons
              selectedType={loadType}
              externalIdFields={externalIdFields}
              externalId={externalId}
              loadingFields={loadingFields}
              onChange={handleLoadTypeChange}
            />
          </GridCol>
          <GridCol className="slds-m-top_large">{children}</GridCol>
        </Grid>
      </div>
    </Split>
  );
};

export default LoadRecordsSelectObjectAndFile;
