import { css } from '@emotion/react';
import { Grid, Icon, Popover, PopoverRef, ScopedNotification, Spinner } from '@jetstream/ui';
import { FunctionComponent, useRef } from 'react';
import type { useApexTestSuites } from '../useApexTestSuites';

export interface TestSuitesPopoverProps {
  suitesState: ReturnType<typeof useApexTestSuites>;
  launching: boolean;
  onRunSuite: (suiteId: string) => void;
  onOpenManager: () => void;
}

/**
 * Secondary entry point for suite-based runs. Suites live in a popover so the page header stays focused
 * on the primary run action, while suite runs still share the run options (stop after failures / skip
 * code coverage).
 */
export const TestSuitesPopover: FunctionComponent<TestSuitesPopoverProps> = ({ suitesState, launching, onRunSuite, onOpenManager }) => {
  const popoverRef = useRef<PopoverRef>(null);
  const { suites, membershipsBySuiteId, loading, errorMessage } = suitesState;

  function handleRunSuite(suiteId: string) {
    popoverRef.current?.close();
    onRunSuite(suiteId);
  }

  function handleOpenManager() {
    popoverRef.current?.close();
    onOpenManager();
  }

  return (
    <Popover
      ref={popoverRef}
      testId="test-suites-popover"
      placement="bottom-start"
      size="medium"
      bodyStyle={css`
        max-height: 60vh;
        overflow-y: auto;
      `}
      header={
        <header className="slds-popover__header">
          <h2 className="slds-text-heading_small">Test Suites</h2>
        </header>
      }
      content={
        <>
          {errorMessage && (
            <ScopedNotification theme="error" className="slds-m-bottom_x-small">
              {errorMessage}
            </ScopedNotification>
          )}
          {loading && (
            <div className="slds-is-relative slds-m-vertical_large">
              <Spinner size="small" />
            </div>
          )}
          {!loading && !errorMessage && !suites.length && (
            <p className="slds-text-color_weak">No test suites exist in this org. Use Manage Suites to create one.</p>
          )}
          {!loading && !!suites.length && (
            <ul>
              {suites.map(({ Id, TestSuiteName }) => {
                const classCount = membershipsBySuiteId.get(Id)?.length ?? 0;
                return (
                  <li key={Id} className="slds-border_bottom">
                    <Grid verticalAlign="center" className="slds-p-vertical_xx-small">
                      <div className="slds-col slds-truncate" title={TestSuiteName}>
                        {TestSuiteName}
                        <span className="slds-m-left_x-small slds-text-body_small slds-text-color_weak">
                          {classCount} {classCount === 1 ? 'class' : 'classes'}
                        </span>
                      </div>
                      <button
                        className="slds-button slds-button_neutral slds-shrink-none"
                        disabled={launching || classCount === 0}
                        title={classCount === 0 ? 'This suite has no test classes' : undefined}
                        onClick={() => handleRunSuite(Id)}
                      >
                        <Icon type="utility" icon="play" className="slds-button__icon slds-button__icon_left" omitContainer />
                        Run
                      </button>
                    </Grid>
                  </li>
                );
              })}
            </ul>
          )}
        </>
      }
      footer={
        <footer className="slds-popover__footer">
          <Grid verticalAlign="center" align="spread">
            <span className="slds-text-body_small slds-text-color_weak">Suite runs use the run options on this page</span>
            <button className="slds-button slds-button_neutral slds-shrink-none" disabled={loading} onClick={handleOpenManager}>
              Manage Suites
            </button>
          </Grid>
        </footer>
      }
      buttonProps={{
        className: 'slds-button slds-button_neutral',
        // aria-disabled rather than native disabled: launching a suite closes this popover and returns
        // focus to the trigger — a natively disabled trigger cannot take it, so focus fell to <body>
        'aria-disabled': launching || undefined,
        // Popover runs its own toggle before any buttonProps.onClick, so the guard has to stop the
        // click in the capture phase to keep the panel closed while a run is launching
        onClickCapture: (event) => {
          if (launching) {
            event.preventDefault();
            event.stopPropagation();
          }
        },
      }}
    >
      Test Suites
      <Icon type="utility" icon="chevrondown" className="slds-button__icon slds-button__icon_right" omitContainer />
    </Popover>
  );
};

export default TestSuitesPopover;
