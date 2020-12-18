import { CodeEditor, Grid, GridCol, Textarea } from '@jetstream/ui';
import React, { Fragment, FunctionComponent } from 'react';
import { useRecoilValue } from 'recoil';
import * as fromQueryState from '../query.state';
import IncludeDeletedRecordsToggle from './IncludeDeletedRecords';
import ManualSoql from './ManualSoql';

// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface SoqlTextareaProps {}

export const SoqlTextarea: FunctionComponent<SoqlTextareaProps> = React.memo(() => {
  const soql = useRecoilValue(fromQueryState.querySoqlState);

  return (
    <Fragment>
      <Textarea id="soql-textarea" label="Generated SOQL">
        <CodeEditor className="CodeMirror-textarea" value={soql} readOnly />
      </Textarea>
      <Grid>
        <ManualSoql />
        <GridCol extraProps={{ dir: 'rtl' }} bump="left">
          <IncludeDeletedRecordsToggle containerClassname="slds-p-top_small" />
        </GridCol>
      </Grid>
    </Fragment>
  );
});

export default SoqlTextarea;
