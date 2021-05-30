import { Grid, GridCol, Textarea } from '@jetstream/ui';
import Editor from '@monaco-editor/react';
import React, { Fragment, FunctionComponent } from 'react';
import IncludeDeletedRecordsToggle from './IncludeDeletedRecords';
import ManualSoql from './ManualSoql';

export interface SoqlTextareaProps {
  soql: string;
  isTooling: boolean;
}

export const SoqlTextarea: FunctionComponent<SoqlTextareaProps> = React.memo(({ soql, isTooling }) => {
  return (
    <Fragment>
      <Textarea id="soql-textarea" label="Generated SOQL">
        <Editor
          className="slds-border_top slds-border_right slds-border_bottom slds-border_left"
          height="300px"
          language="sql"
          value={soql}
          options={{
            readOnly: true,
            minimap: { enabled: false },
            contextmenu: false,
            lineNumbers: 'off',
            glyphMargin: false,
            folding: false,
            selectionHighlight: false,
            renderLineHighlight: 'none',
            scrollBeyondLastLine: false,
          }}
        />
      </Textarea>
      <Grid verticalAlign="center">
        <ManualSoql isTooling={isTooling} generatedSoql={soql} />
        <GridCol extraProps={{ dir: 'rtl' }} bump="left">
          <IncludeDeletedRecordsToggle containerClassname="slds-p-top_small" />
        </GridCol>
      </Grid>
    </Fragment>
  );
});

export default SoqlTextarea;
