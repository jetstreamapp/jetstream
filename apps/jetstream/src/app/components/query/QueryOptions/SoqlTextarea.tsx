import { CodeEditor, Grid, GridCol, Textarea } from '@jetstream/ui';
import React, { Fragment, FunctionComponent } from 'react';
import IncludeDeletedRecordsToggle from './IncludeDeletedRecords';
import ManualSoql from './ManualSoql';

// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface SoqlTextareaProps {
  soql: string;
  isTooling: boolean;
}

export const SoqlTextarea: FunctionComponent<SoqlTextareaProps> = React.memo(({ soql, isTooling }) => {
  return (
    <Fragment>
      <Textarea id="soql-textarea" label="Generated SOQL">
        <CodeEditor className="CodeMirror-textarea" options={{ tabSize: 2 }} value={soql} readOnly />
      </Textarea>
      <Grid verticalAlign="center">
        <ManualSoql isTooling={isTooling} />
        <GridCol extraProps={{ dir: 'rtl' }} bump="left">
          <IncludeDeletedRecordsToggle containerClassname="slds-p-top_small" />
        </GridCol>
      </Grid>
    </Fragment>
  );
});

export default SoqlTextarea;
