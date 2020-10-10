/** @jsx jsx */
import { jsx } from '@emotion/core';
import startCase from 'lodash/startCase';
import { ChangeEvent, FunctionComponent, useEffect, useState } from 'react';
import { InsertUpdateUpsertDelete, SalesforceOrgUi } from '@jetstream/types';
import { ApiMode, FieldMapping } from '../load-records-types';
import { transformData } from '../utils/load-records-utils';
import { Checkbox, Grid, GridCol, Input, Radio, RadioButton, RadioGroup, Select } from '@jetstream/ui';
import { isNumber } from 'lodash';
import { DATE_FORMATS } from '@jetstream/shared/constants';

export interface LoadRecordsLoadRecordsResultsProps {
  selectedOrg: SalesforceOrgUi;
  sObjectName: string;
  fieldMapping: FieldMapping;
  fileData: any[];
  apiMode: ApiMode;
  batchSize: number;
  batchSizeError: string;
  insertNulls: boolean;
  serialMode: boolean;
  dateFormat: string;
  onFinish: (status: string) => void; // TODO: add types
}

export const LoadRecordsLoadRecordsResults: FunctionComponent<LoadRecordsLoadRecordsResultsProps> = ({
  selectedOrg,
  sObjectName,
  fieldMapping,
  fileData,
  apiMode,
  batchSize,
  batchSizeError,
  insertNulls,
  serialMode,
  dateFormat,
}) => {
  // TODO: MOVE THIS TO WORKER (maybe parent does this first and then passes in?)
  const [data] = useState(() =>
    transformData(fileData, fieldMapping, {
      sObjectName,
      insertNulls,
      dateFormat,
      apiMode,
    })
  );

  /**
   * TODO:
   * transform data
   * - remove unmapped fields
   * - ensure fields are in correct data type (might only apply to dat)
   * submit data to salesforce
   * show results
   */

  return <div></div>;
};

export default LoadRecordsLoadRecordsResults;
