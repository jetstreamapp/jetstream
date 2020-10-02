/** @jsx jsx */
import { css, jsx } from '@emotion/core';
import { DescribeGlobalSObjectResult } from 'jsforce';
import { FunctionComponent } from 'react';
import Split from 'react-split';
import { InsertUpdateUpsertDelete, SalesforceOrgUi, InputReadFileContent } from '@jetstream/types';
import LoadRecordsSObjects from '../LoadRecordsSObjects';
import { FileSelector, Grid, GridCol } from '@jetstream/ui';
import { INPUT_ACCEPT_FILETYPES } from '@jetstream/shared/constants';
import LoadRecordsLoadTypeButtons from '../LoadRecordsLoadTypeButtons';
import { parseFile } from '@jetstream/shared/ui-utils';
import { EntityParticleRecordWithRelatedExtIds } from '../load-records-types';

// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface LoadRecordsObjectAndFileProps {
  selectedOrg: SalesforceOrgUi;
  sobjects: DescribeGlobalSObjectResult[];
  selectedSObject: DescribeGlobalSObjectResult;
  loadType: InsertUpdateUpsertDelete;
  externalIdFields: EntityParticleRecordWithRelatedExtIds[];
  externalId: string;
  loadingFields: boolean;
  onSobjects: (sobjects: DescribeGlobalSObjectResult[]) => void;
  onSelectedSobject: (selectedSObject: DescribeGlobalSObjectResult) => void;
  onFileChange: (data: any[], headers: string[]) => void;
  onLoadTypeChange: (type: InsertUpdateUpsertDelete) => void;
  onExternalIdChange: (externalId?: string) => void;
}

export const LoadRecordsObjectAndFile: FunctionComponent<LoadRecordsObjectAndFileProps> = ({
  selectedOrg,
  selectedSObject,
  sobjects,
  loadType,
  externalIdFields,
  externalId,
  loadingFields,
  onSobjects,
  onSelectedSobject,
  onFileChange,
  onLoadTypeChange,
  onExternalIdChange,
}) => {
  function handleFile({ content }: InputReadFileContent) {
    const { data, headers } = parseFile(content);
    onFileChange(data, headers);
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
        <h2 className="slds-text-heading_medium slds-text-align_center">Objects</h2>
        <LoadRecordsSObjects
          selectedOrg={selectedOrg}
          sobjects={sobjects}
          onSobjects={onSobjects}
          selectedSObject={selectedSObject}
          onSelectedSobject={onSelectedSobject}
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
        </Grid>
      </div>
    </Split>
  );
};

export default LoadRecordsObjectAndFile;
