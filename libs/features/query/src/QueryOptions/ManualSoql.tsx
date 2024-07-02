import { ANALYTICS_KEYS } from '@jetstream/shared/constants';
import { CheckboxToggle, Grid, GridCol, Icon, Popover, PopoverRef, Spinner, Textarea } from '@jetstream/ui';
import { useAmplitude } from '@jetstream/ui-core';
import { formatQuery, isQueryValid } from '@jetstreamapp/soql-parser-js';
import Editor, { OnMount } from '@monaco-editor/react';
import type { editor } from 'monaco-editor';
import { Fragment, FunctionComponent, useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import RestoreQuery from '../QueryBuilder/RestoreQuery';

export interface ManualSoqlProps {
  className?: string;
  isTooling: boolean;
  generatedSoql: string;
}

const NoQuery = () => {
  return <span className="slds-text-color_weak">Provide a valid query to continue</span>;
};

const ValidQuery = () => {
  return (
    <span className="slds-text-color_weak">
      <Icon
        type="utility"
        icon="success"
        description="Valid query"
        className="slds-icon-text-success slds-icon_xx-small slds-m-right_xx-small"
      />
      <span className="slds-text-color_weak">Query is valid</span>
    </span>
  );
};

const InvalidQuery = () => {
  return (
    <span>
      <Icon
        type="utility"
        icon="error"
        description="Invalid query"
        className="slds-icon-text-error slds-icon_xx-small slds-m-right_xx-small"
      />
      <span className="slds-text-color_weak">Query is invalid</span>
    </span>
  );
};

export const ManualSoql: FunctionComponent<ManualSoqlProps> = ({ className, isTooling = false, generatedSoql }) => {
  const isMounted = useRef(true);
  const popoverRef = useRef<PopoverRef>(null);
  const editorRef = useRef<editor.IStandaloneCodeEditor>();
  const navigate = useNavigate();
  const { trackEvent } = useAmplitude();
  const [soql, setSoql] = useState<string>('');
  const [isRestoring, setIsRestoring] = useState(false);
  const [queryIsValid, setQueryIsValid] = useState(false);
  const [userTooling, setUserTooling] = useState<boolean>(isTooling);

  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);

  useEffect(() => {
    setUserTooling(isTooling);
  }, [isTooling]);

  useEffect(() => {
    if (soql && isQueryValid(soql)) {
      if (!queryIsValid) {
        setQueryIsValid(true);
      }
    } else {
      if (queryIsValid) {
        setQueryIsValid(false);
      }
    }
  }, [soql]);

  function handleStartRestore() {
    setIsRestoring(true);
  }

  function handleEndRestore(fatalError: boolean, errors?: any) {
    if (isMounted.current) {
      setIsRestoring(false);
      if (!fatalError) {
        if (popoverRef.current) {
          popoverRef.current.close();
        }
      }
    }
  }

  function handleFormat() {
    setSoql(formatQuery(soql, { fieldMaxLineLength: 80 }));
  }

  const handleEditorMount: OnMount = (currEditor, monaco) => {
    editorRef.current = currEditor;
    currEditor.focus();

    const modelRange = currEditor.getModel()?.getFullModelRange();
    modelRange && currEditor.setSelection(modelRange);

    editorRef.current.addAction({
      id: 'modifier-enter',
      label: 'Submit',
      keybindings: [monaco?.KeyMod.CtrlCmd | monaco?.KeyCode.Enter],
      run: (currEditor) => {
        navigate(`results`, {
          state: {
            isTooling: userTooling,
            soql: currEditor.getValue(),
          },
        });
      },
    });
    editorRef.current.addAction({
      id: 'format',
      label: 'Format',
      keybindings: [monaco?.KeyMod.Shift | monaco?.KeyMod.Alt | monaco?.KeyCode.KeyF],
      contextMenuGroupId: '9_cutcopypaste',
      run: (currEditor) => {
        setSoql(formatQuery(currEditor.getValue(), { fieldMaxLineLength: 80 }));
      },
    });
  };

  function handlePopoverChange(isOpen: boolean) {
    if (isOpen) {
      if (generatedSoql) {
        setSoql(generatedSoql);
      }
      trackEvent(ANALYTICS_KEYS.query_ManualQueryOpened, { isTooling });
    }
  }

  return (
    <div className={className}>
      <Popover
        ref={popoverRef}
        testId="manual-query"
        size="x-large"
        placement="auto-end"
        onChange={handlePopoverChange}
        content={
          <Fragment>
            {isRestoring && <Spinner />}
            <Textarea
              id="soql-manual"
              label={
                <Grid align="spread">
                  <div className="slds-m-right_x-small">
                    <span>SOQL Query</span>
                  </div>
                  <span>
                    <button
                      className="slds-button slds-text-link_reset slds-text-link"
                      title="Format soql query"
                      disabled={!queryIsValid}
                      onClick={handleFormat}
                    >
                      format
                    </button>
                  </span>
                </Grid>
              }
            >
              {/* Cannot be dark as it changes all other editors on screen */}
              <Editor
                className="slds-border_top slds-border_right slds-border_bottom slds-border_left"
                height="350px"
                language="soql"
                value={soql}
                options={{
                  minimap: { enabled: false },
                  lineNumbers: 'off',
                  glyphMargin: false,
                  folding: false,
                  scrollBeyondLastLine: false,
                }}
                onMount={handleEditorMount}
                onChange={(value) => setSoql(value || '')}
              />
            </Textarea>
            <Grid className="slds-m-top_xx-small">
              <div>
                {!soql && <NoQuery />}
                {queryIsValid && <ValidQuery />}
                {soql && !queryIsValid && <InvalidQuery />}
              </div>
              <GridCol extraProps={{ dir: 'rtl' }} bump="left">
                <CheckboxToggle
                  id="is-tooling-user-soql"
                  label="Query Type"
                  onText="Metadata Query"
                  offText="Object Query"
                  hideLabel
                  checked={userTooling}
                  onChange={setUserTooling}
                />
              </GridCol>
            </Grid>
          </Fragment>
        }
        footer={
          <footer className="slds-popover__footer">
            <Grid verticalAlign="center">
              <GridCol bump="left">
                <RestoreQuery
                  soql={soql}
                  isTooling={userTooling}
                  tooltip="Update the page to match this query. If the query contains SOQL features that are not supported by Jetstream, they will be removed from your query."
                  buttonProps={{ disabled: !queryIsValid || isRestoring }}
                  className="slds-button_neutral slds-m-right_x-small"
                  startRestore={handleStartRestore}
                  endRestore={handleEndRestore}
                />

                {/* ENABLED STATE */}
                {queryIsValid && !isRestoring && (
                  <Link
                    className="slds-button slds-button_brand"
                    to="results"
                    state={{
                      isTooling: userTooling,
                      soql,
                    }}
                  >
                    <Icon type="utility" icon="right" className="slds-button__icon slds-button__icon_left" />
                    Execute
                  </Link>
                )}

                {/* DISABLED STATE */}
                {(!queryIsValid || isRestoring) && (
                  <button className="slds-button slds-button_brand" disabled={true}>
                    <Icon type="utility" icon="right" className="slds-button__icon slds-button__icon_left" />
                    Execute
                  </button>
                )}
              </GridCol>
            </Grid>
          </footer>
        }
        buttonProps={{
          className: 'slds-button slds-button_neutral',
        }}
      >
        <Icon type="utility" icon="prompt_edit" description="Manually enter query" className="slds-button__icon slds-button__icon_left" />
        Manual Query
      </Popover>
    </div>
  );
};

export default ManualSoql;
