/** @jsx jsx */
import { css, jsx } from '@emotion/react';
import { useSetTraceFlag } from '@jetstream/connected-ui';
import { DebugLevel, SalesforceOrgUi } from '@jetstream/types';
import { Grid, Popover, PopoverErrorButton, Spinner } from '@jetstream/ui';
import { Fragment, FunctionComponent, useEffect, useRef, useState } from 'react';

export interface DebugLogViewerTraceProps {
  org: SalesforceOrgUi;
}

export const DebugLogViewerTrace: FunctionComponent<DebugLogViewerTraceProps> = ({ org }) => {
  const isMounted = useRef(null);
  const [isOpen, setIsOpen] = useState(false);
  const { changeLogLevel, loading, errorMessage, activeDebugLevel, debugLevels } = useSetTraceFlag(org);

  useEffect(() => {
    isMounted.current = true;
    return () => (isMounted.current = false);
  }, []);

  function toggleOpen() {
    setIsOpen(!isOpen);
  }

  function handleChangeLogLevel(debugLevel: DebugLevel) {
    setIsOpen(false);
    changeLogLevel(debugLevel);
  }

  return (
    <Grid
      className="slds-is-relative"
      css={css`
        min-height: 19px;
      `}
    >
      <div className="slds-m-left_small">{loading && <Spinner size="x-small" />}</div>
      {errorMessage && <PopoverErrorButton listHeader={null} errors={errorMessage} />}
      <div>
        <Popover
          placement="bottom-end"
          isOpen={isOpen}
          header={
            <header className="slds-popover__header">
              <h2 className="slds-text-heading_small" title="Refresh Metadata">
                Debug Levels
              </h2>
            </header>
          }
          content={
            <div>
              {debugLevels && (
                <ul className="slds-has-dividers_top-space slds-dropdown_length-10">
                  {debugLevels.map((debugLevel) => (
                    <Fragment key={debugLevel.Id}>
                      {debugLevel.Id === activeDebugLevel.Id && (
                        <li className="slds-item">
                          <div className="slds-truncate" title={debugLevel.DeveloperName}>
                            {debugLevel.DeveloperName}
                          </div>
                        </li>
                      )}
                      {debugLevel.Id !== activeDebugLevel.Id && (
                        <li className="slds-item slds-text-link" onClick={() => handleChangeLogLevel(debugLevel)}>
                          <div className="slds-truncate" title={debugLevel.DeveloperName}>
                            {debugLevel.DeveloperName}
                          </div>
                        </li>
                      )}
                    </Fragment>
                  ))}
                </ul>
              )}
            </div>
          }
        >
          <div className="slds-is-relative">
            <button className="slds-button slds-button_neutral" onClick={toggleOpen} disabled={!activeDebugLevel}>
              {activeDebugLevel ? `Active Log Level - ${activeDebugLevel?.DeveloperName}` : 'Loading log levels'}
            </button>
          </div>
        </Popover>
      </div>
    </Grid>
  );
};

export default DebugLogViewerTrace;
