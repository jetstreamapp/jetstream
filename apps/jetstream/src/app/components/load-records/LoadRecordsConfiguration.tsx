/** @jsx jsx */
import { jsx } from '@emotion/core';
import { SalesforceOrgUi } from '@jetstream/types';
import { DescribeGlobalSObjectResult } from 'jsforce';
import { FunctionComponent, useState } from 'react';
import { INPUT_ACCEPT_FILETYPES } from '@jetstream/shared/constants';
import { FileSelector, Grid, GridCol, Icon, ProgressIndicator, RadioButton, RadioGroup } from '@jetstream/ui';
import { isString } from 'lodash';
import { parse as parseCsv } from 'papaparse';
import * as XLSX from 'xlsx';

const HEIGHT_BUFFER = 170;

// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface LoadRecordsConfigurationProps {
  selectedOrg: SalesforceOrgUi;
  selectedSObject: DescribeGlobalSObjectResult;
}

export const LoadRecordsConfiguration: FunctionComponent<LoadRecordsConfigurationProps> = () => {
  const [loading, setLoading] = useState<boolean>(false);
  const [fileData, setFileData] = useState<any[]>();
  const [errorMessage, setErrorMessage] = useState<string>(null);

  function handleFile({ filename, extension, content }: { filename: string; extension: string; content: string | ArrayBuffer }) {
    if (isString(content)) {
      // csv - read from papaparse
      const csvResult = parseCsv(content, {
        delimiter: ',', // FIXME: support other delimiters based on locale
        header: true,
        skipEmptyLines: true,
        preview: 0, // TODO: should we parse entire file now (could be slow), or use worker, or just get preview?
      });
      setFileData(csvResult.data);
    } else {
      // ArrayBuffer - xlsx file
      const data = XLSX.utils.sheet_to_json(XLSX.read(content, { cellText: false, cellDates: true, type: 'array' }), {
        dateNF: 'yyyy"-"mm"-"dd"T"hh:mm:ss',
        defval: '',
        blankrows: false,
      });
      setFileData(data);
    }
  }

  return (
    <div>
      <Grid vertical>
        <GridCol>
          <ProgressIndicator totalSteps={5} currentStep={3} readOnly></ProgressIndicator>
        </GridCol>
        <GridCol>
          <Grid>
            <GridCol growNone>
              <FileSelector
                id="load-record-file"
                label="File to Load"
                accept={[INPUT_ACCEPT_FILETYPES.CSV, INPUT_ACCEPT_FILETYPES.EXCEL]}
                userHelpText="Choose CSV or XLSX file to upload"
                onReadFile={handleFile}
              ></FileSelector>
            </GridCol>
            <GridCol grow className="slds-m-top_large slds-p-top_xx-small">
              <button className="slds-button slds-button_brand">
                <Icon type="utility" icon="data_mapping" className="slds-button__icon slds-button__icon_left" />
                Map Fields
              </button>
            </GridCol>
          </Grid>
        </GridCol>
        <GridCol>
          <RadioGroup label="Type of Data Load" required isButtonGroup>
            <RadioButton
              name="INSERT"
              label="Insert"
              value="INSERT"
              checked={true}
              disabled={false}
              // checked={false}
              onChange={() => {}}
            />
            <RadioButton
              name="UPDATE"
              label="Update"
              value="UPDATE"
              checked={false}
              disabled={false}
              // checked={false}
              onChange={() => {}}
            />
            <RadioButton
              name="UPSERT"
              label="Upsert"
              value="UPSERT"
              checked={false}
              disabled={false}
              // checked={false}
              onChange={() => {}}
            />
            <RadioButton
              className="slds-button_destructive"
              name="DELETE"
              label="Delete"
              value="DELETE"
              checked={false}
              disabled={false}
              // checked={false}
              onChange={() => {}}
            />
          </RadioGroup>
        </GridCol>
      </Grid>
    </div>
  );
};

export default LoadRecordsConfiguration;
