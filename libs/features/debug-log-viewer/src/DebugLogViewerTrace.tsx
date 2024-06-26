import { css } from '@emotion/react';
import { useSetTraceFlag } from '@jetstream/connected-ui';
import { DebugLevel, SalesforceOrgUi } from '@jetstream/types';
import { Grid, PopoverErrorButton, Popover, PopoverRef, Spinner } from '@jetstream/ui';
import { Fragment, FunctionComponent, useEffect, useRef } from 'react';

export interface DebugLogViewerTraceProps {
  org: SalesforceOrgUi;
}

export const DebugLogViewerTrace: FunctionComponent<DebugLogViewerTraceProps> = ({ org }) => {
  const isMounted = useRef(true);
  const popoverRef = useRef<PopoverRef>(null);
  const { changeLogLevel, loading, errorMessage, activeDebugLevel, debugLevels } = useSetTraceFlag(org);

  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);

  function handleChangeLogLevel(debugLevel: DebugLevel) {
    popoverRef.current?.close();
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
      {errorMessage && <PopoverErrorButton errors={errorMessage} />}
      <div>
        <Popover
          ref={popoverRef}
          header={
            <header className="slds-popover__header">
              <h2 className="slds-text-heading_small" title="Debug Levels">
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
                      {debugLevel.Id === activeDebugLevel?.Id && (
                        <li className="slds-item">
                          <div className="slds-truncate" title={debugLevel.DeveloperName}>
                            {debugLevel.DeveloperName}
                          </div>
                        </li>
                      )}
                      {debugLevel.Id !== activeDebugLevel?.Id && (
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
          buttonProps={{
            className: 'slds-button slds-button_neutral',
            title: 'Log Level',
          }}
        >
          {activeDebugLevel ? `${activeDebugLevel?.DeveloperName}` : 'Loading log levels'}
        </Popover>
      </div>
    </Grid>
  );
};

export default DebugLogViewerTrace;
