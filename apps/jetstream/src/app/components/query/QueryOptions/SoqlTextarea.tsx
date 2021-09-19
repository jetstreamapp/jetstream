import { css } from '@emotion/react';
import { Grid, GridCol, Textarea } from '@jetstream/ui';
import Editor, { OnMount } from '@monaco-editor/react';
import { Fragment, FunctionComponent, memo, RefObject, useCallback, useRef } from 'react';
import IncludeDeletedRecordsToggle from './IncludeDeletedRecords';
import ManualSoql from './ManualSoql';
import ResizeObserver from 'react-resize-detector';
import type { editor } from 'monaco-editor';

export interface SoqlTextareaProps {
  soql: string;
  isTooling: boolean;
}

export const SoqlTextarea: FunctionComponent<SoqlTextareaProps> = memo(({ soql, isTooling }) => {
  const divRef = useRef<HTMLDivElement>();
  const editorRef = useRef<editor.IStandaloneCodeEditor>(null);

  const handleEditorMount: OnMount = (currEditor, monaco) => {
    editorRef.current = currEditor;
    editorRef.current.layout();
  };

  const handleResize = useCallback(() => {
    editorRef.current?.layout();
  }, []);

  return (
    <Fragment>
      <Textarea id="soql-textarea" label="Generated SOQL">
        <ResizeObserver handleHeight targetRef={divRef} onResize={handleResize}>
          {({ height }) => (
            <div
              ref={divRef}
              className="slds-border_top slds-border_right slds-border_bottom slds-border_left"
              css={css`
                resize: vertical;
                overflow: auto;
                min-height: 150px;
              `}
            >
              <Editor
                height={height}
                language="soql"
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
                onMount={handleEditorMount}
              />
            </div>
          )}
        </ResizeObserver>
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
