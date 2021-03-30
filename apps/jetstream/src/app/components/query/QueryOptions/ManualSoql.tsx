/** @jsx jsx */
import { jsx } from '@emotion/react';
import { ANALYTICS_KEYS } from '@jetstream/shared/constants';
import { CheckboxToggle, CodeEditor, Grid, GridCol, Icon, Popover, Spinner, Textarea } from '@jetstream/ui';
import { Fragment, FunctionComponent, useEffect, useRef, useState } from 'react';
import { Link, useRouteMatch } from 'react-router-dom';
import { formatQuery, isQueryValid } from 'soql-parser-js';
import { useAmplitude } from '../../core/analytics';
import RestoreQuery from '../QueryBuilder/RestoreQuery';

export interface ManualSoqlProps {
  className?: string;
  isTooling: boolean;
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

export const ManualSoql: FunctionComponent<ManualSoqlProps> = ({ className, isTooling = false }) => {
  const isMounted = useRef(null);
  const { trackEvent } = useAmplitude();
  const match = useRouteMatch();
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [soql, setSoql] = useState<string>('');
  const [isRestoring, setIsRestoring] = useState(false);
  const [queryIsValid, setQueryIsValid] = useState(false);
  const [userTooling, setUserTooling] = useState<boolean>(isTooling);

  useEffect(() => {
    isMounted.current = true;
    return () => (isMounted.current = false);
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

  useEffect(() => {
    if (isOpen) {
      trackEvent(ANALYTICS_KEYS.query_ManualQueryOpened, { isTooling });
    }
  }, [isOpen, isTooling, trackEvent]);

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

  function handleFormat() {
    setSoql(formatQuery(soql, { fieldMaxLineLength: 80 }));
  }

  return (
    <div className={className}>
      <Popover
        isOpen={isOpen}
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
              <CodeEditor className="CodeMirror-textarea" value={soql} options={{ tabSize: 2 }} onChange={setSoql} />
            </Textarea>
            <Grid>
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
                    to={{
                      pathname: `${match.url}/results`,
                      state: {
                        isTooling: userTooling,
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
          <Icon type="utility" icon="prompt_edit" description="Manually enter query" className="slds-button__icon slds-button__icon_left" />
          Manual Query
        </button>
      </Popover>
    </div>
  );
};

export default ManualSoql;
