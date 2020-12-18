import { CodeEditor, Grid, GridCol, Icon, Popover, Spinner, Textarea } from '@jetstream/ui';
import React, { Fragment, FunctionComponent, useEffect, useRef, useState } from 'react';
import { Link, useRouteMatch } from 'react-router-dom';
import { isQueryValid } from 'soql-parser-js';
import RestoreQuery from '../QueryBuilder/RestoreQuery';

// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface ManualSoqlProps {}

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
      <span className="slds-text-color_weak"></span>Query is valid
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

export const ManualSoql: FunctionComponent<ManualSoqlProps> = () => {
  const isMounted = useRef(null);
  const match = useRouteMatch();
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [soql, setSoql] = useState<string>('');
  const [isRestoring, setIsRestoring] = useState(false);
  const [queryIsValid, setQueryIsValid] = useState(false);

  useEffect(() => {
    isMounted.current = true;
    return () => (isMounted.current = false);
  }, []);

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
        setIsOpen(false);
      }
    }
  }

  return (
    <div className="slds-m-top_small">
      <Popover
        isOpen={isOpen}
        containerClassName=""
        content={
          <Fragment>
            {isRestoring && <Spinner />}
            <Textarea id="soql-manual" label="SOQL Query">
              <CodeEditor className="CodeMirror-textarea" value={soql} onChange={setSoql} />
            </Textarea>
            {!soql && <NoQuery />}
            {queryIsValid && <ValidQuery />}
            {soql && !queryIsValid && <InvalidQuery />}
          </Fragment>
        }
        footer={
          <footer className="slds-popover__footer">
            <Grid verticalAlign="center">
              <GridCol bump="left">
                <RestoreQuery
                  soql={soql}
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
                    to={{
                      pathname: `${match.url}/results`,
                      state: {
                        soql,
                      },
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
      >
        <button className="slds-button slds-button_neutral" onClick={() => setIsOpen(true)}>
          Manual Query
        </button>
      </Popover>
    </div>
  );
};

export default ManualSoql;
