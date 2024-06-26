import { css } from '@emotion/react';
import { DescribeGlobalSObjectResult, SalesforceOrgUi } from '@jetstream/types';
import { Grid, GridCol, Textarea } from '@jetstream/ui';
import { fromQueryHistoryState } from '@jetstream/ui-core';
import Editor, { OnMount } from '@monaco-editor/react';
import type { editor } from 'monaco-editor';
import { Fragment, FunctionComponent, memo, useCallback, useRef } from 'react';
import { useResizeDetector } from 'react-resize-detector';
import IncludeDeletedRecordsToggle from './IncludeDeletedRecords';
import ManualSoql from './ManualSoql';
import SaveFavoriteSoql from './SaveFavoriteSoql';

export interface SoqlTextareaProps {
  soql: string;
  isTooling: boolean;
  selectedOrg: SalesforceOrgUi;
  selectedSObject: DescribeGlobalSObjectResult;
  onOpenHistory: (type: fromQueryHistoryState.QueryHistoryType) => void;
}

export const SoqlTextarea: FunctionComponent<SoqlTextareaProps> = memo(
  ({ soql, isTooling, selectedOrg, selectedSObject, onOpenHistory }) => {
    const editorRef = useRef<editor.IStandaloneCodeEditor>();

    const handleEditorMount: OnMount = (currEditor, monaco) => {
      editorRef.current = currEditor;
      editorRef.current.layout();
    };

    const handleResize = useCallback(() => {
      editorRef.current?.layout();
    }, []);

    const { height, ref } = useResizeDetector({
      handleHeight: true,
      handleWidth: false,
      refreshMode: 'throttle',
      refreshRate: 50,
      refreshOptions: { leading: true, trailing: true },
      onResize: handleResize,
    });

    return (
      <Fragment>
        <Textarea id="soql-textarea" label="Generated SOQL">
          <div
            ref={ref}
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
        </Textarea>
        <Grid verticalAlign="center" wrap>
          <ManualSoql isTooling={isTooling} generatedSoql={soql} />
          <SaveFavoriteSoql
            className="slds-m-left_x-small"
            isTooling={isTooling}
            selectedOrg={selectedOrg}
            sObject={selectedSObject.name}
            sObjectLabel={selectedSObject.label}
            soql={soql}
            onOpenHistory={onOpenHistory}
          />
          <GridCol extraProps={{ dir: 'rtl' }} bump="left">
            <IncludeDeletedRecordsToggle containerClassname="slds-p-top_small" />
          </GridCol>
        </Grid>
      </Fragment>
    );
  }
);

export default SoqlTextarea;
