import { css } from '@emotion/react';
import { logger } from '@jetstream/shared/client-logger';
import { INPUT_ACCEPT_FILETYPES } from '@jetstream/shared/constants';
import { GoogleApiClientConfig, filterLoadSobjects, parseFile, parseWorkbook } from '@jetstream/shared/ui-utils';
import { getErrorMessage } from '@jetstream/shared/utils';
import { SplitWrapper as Split } from '@jetstream/splitjs';
import {
  DescribeGlobalSObjectResult,
  FieldWithRelatedEntities,
  InputReadFileContent,
  InputReadGoogleSheet,
  InsertUpdateUpsertDelete,
  LocalOrGoogle,
  Maybe,
  SalesforceOrgUi,
} from '@jetstream/types';
import {
  Alert,
  ConnectedSobjectList,
  FileOrGoogleSelector,
  FileSelector,
  Grid,
  GridCol,
  XlsxSheetSelectionModalPromise,
  fireToast,
} from '@jetstream/ui';
import { FunctionComponent } from 'react';
import LoadRecordsLoadTypeButtons from '../components/LoadRecordsLoadTypeButtons';

export interface LoadRecordsSelectObjectAndFileProps {
  googleApiConfig: GoogleApiClientConfig;
  featureFlags: Set<string>;
  selectedOrg: SalesforceOrgUi;
  sobjects: Maybe<DescribeGlobalSObjectResult[]>;
  selectedSObject: Maybe<DescribeGlobalSObjectResult>;
  isCustomMetadataObject: boolean;
  loadType: InsertUpdateUpsertDelete;
  externalIdFields: FieldWithRelatedEntities[];
  externalId: string;
  inputFileType: Maybe<LocalOrGoogle>;
  inputFilename: Maybe<string>;
  loadingFields: Maybe<boolean>;
  allowBinaryAttachment: Maybe<boolean>;
  binaryAttachmentBodyField: Maybe<string>;
  inputZipFilename: Maybe<string>;
  onSobjects: (sobjects: DescribeGlobalSObjectResult[]) => void;
  onSelectedSobject: (selectedSObject: DescribeGlobalSObjectResult) => void;
  onFileChange: (data: any[], headers: string[], filename: string, inputFileType: LocalOrGoogle) => void;
  onZipFileChange: (data: ArrayBuffer, filename: string) => void;
  onLoadTypeChange: (type: InsertUpdateUpsertDelete) => void;
  onExternalIdChange: (externalId: string) => void;
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
  const hasGoogleInputConfigured =
    !globalThis.__IS_CHROME_EXTENSION__ && !!googleApiConfig?.apiKey && !!googleApiConfig?.appId && !!googleApiConfig?.clientId;
  async function handleFile({ content, filename, isPasteFromClipboard, extension }: InputReadFileContent) {
    try {
      const { data, headers, errors } = await parseFile(content, { onParsedMultipleWorkbooks, isPasteFromClipboard, extension });
      onFileChange(data, headers, filename, 'local');
      if (errors.length > 0) {
        logger.warn(errors);
        // suppress delimiter error if it is the only error and just one column of data
        if (headers.length !== 1 || errors.length !== 1 || !errors[0].includes('auto-detect delimiting character')) {
          fireToast({
            message: `There were errors parsing the file. Check the file preview to ensure the data is correct. ${errors.join()}`,
            type: 'warning',
          });
        }
      }
    } catch (ex) {
      logger.warn('Error reading file', ex);
      if (getErrorMessage(ex).includes('password-protected')) {
        fireToast({
          message: `Your file is password protected, remove the password and try again.`,
          type: 'error',
        });
      } else {
        fireToast({
          message: `There was an error reading your file. ${getErrorMessage(ex)}`,
          type: 'error',
        });
      }
    }
  }

  async function handleGoogleFile({ workbook, selectedFile }: InputReadGoogleSheet) {
    try {
      const { data, headers } = await parseWorkbook(workbook, { onParsedMultipleWorkbooks });
      onFileChange(data, headers, selectedFile.name, 'google');
    } catch (ex) {
      fireToast({
        message: `There was an error reading your file. ${getErrorMessage(ex)}`,
        type: 'error',
      });
    }
  }

  async function handleZip({ content, filename }: InputReadFileContent<ArrayBuffer>) {
    try {
      onZipFileChange(content, filename);
    } catch (ex) {
      fireToast({
        message: `There was an error reading your file. ${getErrorMessage(ex)}`,
        type: 'error',
      });
    }
  }

  function handleLoadTypeChange(type: InsertUpdateUpsertDelete, externalId?: Maybe<string>) {
    onLoadTypeChange(type);
    onExternalIdChange(externalId || '');
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
          onSobjects={(sobjects) => onSobjects(sobjects || [])}
          onSelectedSObject={(sobject) => {
            if (sobject) {
              onSelectedSobject(sobject);
            }
          }}
        />
      </div>
      <div className="slds-p-horizontal_x-small">
        <Grid vertical>
          <GridCol>
            <Grid verticalAlign="center">
              <GridCol>
                <FileOrGoogleSelector
                  omitGoogle={!hasGoogleInputConfigured}
                  initialSelectedTab={hasGoogleInputConfigured && inputFileType === 'google' && inputFilename ? 'google' : 'local'}
                  fileSelectorProps={{
                    id: 'load-record-file',
                    label: 'File to Load',
                    filename: inputFileType === 'local' ? inputFilename : undefined,
                    accept: [INPUT_ACCEPT_FILETYPES.CSV, INPUT_ACCEPT_FILETYPES.TSV, INPUT_ACCEPT_FILETYPES.EXCEL],
                    allowFromClipboard: true,
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
                    onReadFile={(fileData) => handleZip(fileData as InputReadFileContent<ArrayBuffer>)}
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
