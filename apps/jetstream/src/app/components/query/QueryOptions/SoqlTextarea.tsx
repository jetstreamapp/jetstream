import { CodeEditor, Grid, Textarea } from '@jetstream/ui';
import React, { Fragment, FunctionComponent } from 'react';
import { useRecoilValue } from 'recoil';
import * as fromQueryState from '../query.state';
import IncludeDeletedRecordsToggle from './IncludeDeletedRecords';

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
        <div dir="rtl" className="slds-col_bump-left">
          <IncludeDeletedRecordsToggle containerClassname="slds-p-top_small" />
        </div>
      </Grid>
    </Fragment>
  );
});

export default SoqlTextarea;
