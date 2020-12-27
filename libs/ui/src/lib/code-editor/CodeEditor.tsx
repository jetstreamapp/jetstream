/** @jsx jsx */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { jsx } from '@emotion/react';
import 'codemirror/lib/codemirror.css';
import { FunctionComponent, useEffect, useState } from 'react';
import { Controlled as CodeMirror } from 'react-codemirror2';
import { EditorConfiguration, Editor, EditorChange } from 'codemirror';
require('codemirror/mode/sql/sql');

export interface CodeEditorProps {
  className?: string;
  value?: string;
  readOnly?: boolean | 'nocursor';
  lineNumbers?: boolean;
  // Size in pixels or relative units (rem, %, etc..)
  size?: { width?: number | string; height?: number | string };
  // if this changes from false to true, then a refresh will occur
  // Required if surrounding DOM is not fully rendered when the text-editor is rendered (e.x. modal)
  shouldRefresh?: boolean;
  onChange?: (value: string) => void;
}

export const CodeEditor: FunctionComponent<CodeEditorProps> = ({
  className,
  value,
  readOnly = false,
  lineNumbers = false,
  size,
  shouldRefresh,
  onChange,
}) => {
  const [currValue, setValue] = useState<string>(value || '');
  const [codeEditorInstance, setCodeEditorInstance] = useState<Editor>();
  const [shouldRefreshPriorValue, setShouldRefreshPriorValue] = useState<boolean>(shouldRefresh);

  useEffect(() => {
    if (value !== currValue) {
      setValue(value);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  useEffect(() => {
    if (size && codeEditorInstance) {
      setSize(codeEditorInstance);
    }
  }, [size]);

  useEffect(() => {
    if (codeEditorInstance && shouldRefresh !== !shouldRefreshPriorValue) {
      setShouldRefreshPriorValue(shouldRefresh);
      codeEditorInstance.refresh();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shouldRefresh, codeEditorInstance]);

  function setSize(editor: Editor) {
    if (size) {
      editor.setSize(size.width || null, size.height || null);
    }
  }

  const options: EditorConfiguration = {
    theme: 'default',
    readOnly,
    lineNumbers,
  };

  return (
    <CodeMirror
      className={className}
      value={currValue}
      options={options}
      editorDidMount={(editor: Editor, next) => {
        setCodeEditorInstance(editor);
        setSize(editor);
      }}
      onBeforeChange={(editor: Editor, data: EditorChange, value: string) => {
        setValue(value);
      }}
      onChange={(editor: Editor, data: EditorChange, value: string) => {
        onChange && onChange(value);
      }}
    />
  );
};

export default CodeEditor;
