import { css } from '@emotion/react';
import { FEATURE_FLAGS, INPUT_ACCEPT_FILETYPES } from '@jetstream/shared/constants';
import { GoogleApiClientConfig, hasFeatureFlagAccess, parseFile, parseWorkbook } from '@jetstream/shared/ui-utils';
import { InputReadFileContent, InputReadGoogleSheet, InsertUpdateUpsertDelete, SalesforceOrgUi } from '@jetstream/types';
import {
  Alert,
  ConnectedSobjectList,
  FileOrGoogleSelector,
  FileSelector,
  Grid,
  GridCol,
  XlsxSheetSelectionModalPromise,
} from '@jetstream/ui';
import { DescribeGlobalSObjectResult } from 'jsforce';
import { FunctionComponent } from 'react';
import Split from 'react-split';
import LoadRecordsLoadTypeButtons from '../components/LoadRecordsLoadTypeButtons';
import { FieldWithRelatedEntities, LocalOrGoogle } from '../load-records-types';
import { filterLoadSobjects } from '../utils/load-records-utils';

export interface LoadRecordsSelectObjectAndFileProps {
  googleApiConfig: GoogleApiClientConfig;
  featureFlags: Set<string>;
  selectedOrg: SalesforceOrgUi;
  sobjects: DescribeGlobalSObjectResult[];
  selectedSObject: DescribeGlobalSObjectResult;
  isCustomMetadataObject: boolean;
  loadType: InsertUpdateUpsertDelete;
  externalIdFields: FieldWithRelatedEntities[];
  externalId: string;
  inputFileType: LocalOrGoogle;
  inputFilename: string;
  loadingFields: boolean;
  allowBinaryAttachment: boolean;
  binaryAttachmentBodyField: string;
  inputZipFilename: string;
  onSobjects: (sobjects: DescribeGlobalSObjectResult[]) => void;
  onSelectedSobject: (selectedSObject: DescribeGlobalSObjectResult) => void;
  onFileChange: (data: any[], headers: string[], filename: string, inputFileType: LocalOrGoogle) => void;
  onZipFileChange: (data: ArrayBuffer, filename: string) => void;
  onLoadTypeChange: (type: InsertUpdateUpsertDelete) => void;
  onExternalIdChange: (externalId?: string) => void;
  children?: React.ReactNode;
}

const onParsedMultipleWorkbooks = async (worksheets: string[]): Promise<string> => {
  return await XlsxSheetSelectionModalPromise({ worksheets });
};

export const LoadRecordsSelectObjectAndFile: FunctionComponent<LoadRecordsSelectObjectAndFileProps> = ({
  googleApiConfig,
  featureFlags,
  selectedOrg,
  selectedSObject,
  isCustomMetadataObject,
  sobjects,
  loadType,
  externalIdFields,
  externalId,
  inputFileType,
  inputFilename,
  loadingFields,
  allowBinaryAttachment,
  binaryAttachmentBodyField,
  inputZipFilename,
  onSobjects,
  onSelectedSobject,
  onFileChange,
  onZipFileChange,
  onLoadTypeChange,
  onExternalIdChange,
  children,
}) => {
  const hasGoogleInputConfigured = !!googleApiConfig?.apiKey && !!googleApiConfig?.appId && !!googleApiConfig?.clientId;
  async function handleFile({ content, filename }: InputReadFileContent) {
    const { data, headers } = await parseFile(content, { onParsedMultipleWorkbooks });
    onFileChange(data, headers, filename, 'local');
  }

  async function handleGoogleFile({ workbook, selectedFile }: InputReadGoogleSheet) {
    const { data, headers } = await parseWorkbook(workbook, { onParsedMultipleWorkbooks });
    onFileChange(data, headers, selectedFile.name, 'google');
  }

  async function handleZip({ content, filename }: InputReadFileContent<ArrayBuffer>) {
    onZipFileChange(content, filename);
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
              <GridCol>
                <FileOrGoogleSelector
                  omitGoogle={!hasGoogleInputConfigured || !hasFeatureFlagAccess(featureFlags, FEATURE_FLAGS.ALLOW_GOOGLE_UPLOAD)}
                  fileSelectorProps={{
                    id: 'load-record-file',
                    label: 'File to Load',
                    filename: inputFileType === 'local' ? inputFilename : undefined,
                    accept: [INPUT_ACCEPT_FILETYPES.CSV, INPUT_ACCEPT_FILETYPES.EXCEL],
                    userHelpText: 'Choose CSV or XLSX file to upload',
                    onReadFile: handleFile,
                  }}
                  googleSelectorProps={{
                    apiConfig: googleApiConfig,
                    id: 'load-google-drive-file',
                    className: 'slds-m-left_x-small',
                    label: 'Google Drive',
                    buttonLabel: 'Choose Google Sheet',
                    filename: inputFileType === 'google' ? inputFilename : undefined,
                    onReadFile: handleGoogleFile,
                  }}
                />
              </GridCol>
            </Grid>
          </GridCol>
          {allowBinaryAttachment && (
            <GridCol className="slds-m-bottom_small">
              <Grid verticalAlign="center">
                <GridCol size={6}>
                  <FileSelector
                    id={'load-record-file'}
                    label="Zip file with attachments"
                    filename={inputZipFilename}
                    accept={[INPUT_ACCEPT_FILETYPES.ZIP]}
                    userHelpText="Choose a zip file with attachments to upload"
                    maxAllowedSizeMB={100}
                    onReadFile={handleZip}
                  ></FileSelector>
                </GridCol>
                <div>
                  <p>This object supports loading attachments.</p>
                  <p>
                    In your file to load, the path to the file within your zipped file needs to be mapped to the{' '}
                    <strong>{binaryAttachmentBodyField}</strong> field.
                  </p>
                  <p>
                    <a href="https://docs.getjetstream.app/load/load-attachments" rel="noreferrer" target="_blank">
                      Refer to the documentation for more information.
                    </a>
                  </p>
                </div>
              </Grid>
            </GridCol>
          )}
          <GridCol>
            <LoadRecordsLoadTypeButtons
              selectedType={loadType}
              externalIdFields={externalIdFields}
              externalId={externalId}
              loadingFields={loadingFields}
              isCustomMetadataObject={isCustomMetadataObject}
              onChange={handleLoadTypeChange}
            />
          </GridCol>
          {isCustomMetadataObject && (
            <GridCol className="slds-m-top_small slds-m-horizontal_small">
              <Alert type="info" leadingIcon="info">
                Custom metadata will always perform an upsert based on the <strong>DeveloperName</strong>.
              </Alert>
            </GridCol>
          )}
          <GridCol className="slds-m-top_large">{children}</GridCol>
        </Grid>
      </div>
    </Split>
  );
};

export default LoadRecordsSelectObjectAndFile;
