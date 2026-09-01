import { css } from '@emotion/react';
import { ANALYTICS_KEYS } from '@jetstream/shared/constants';
import { Checkbox, Grid, Icon, Input, ScopedNotification, Spinner } from '@jetstream/ui';
import { useAmplitude } from '@jetstream/ui-core';
import { FunctionComponent, useCallback } from 'react';
import type { useApexTestRunLauncher } from '../useApexTestRunLauncher';
import TestClassSelection from './TestClassSelection';

export interface RunTestsTabProps {
  launcher: ReturnType<typeof useApexTestRunLauncher>;
}

export const RunTestsTab: FunctionComponent<RunTestsTabProps> = ({ launcher }) => {
  const { trackEvent } = useAmplitude();
  const {
    classesState: { testClasses, unknownClasses, loading, progressText, errorMessage, refresh },
    selectedClasses,
    selectedMethodCount,
    launching,
    maxFailedTests,
    setMaxFailedTests,
    skipCodeCoverage,
    setSkipCodeCoverage,
    toggleClass,
    toggleMethod,
    selectAllVisible,
    clearSelection,
  } = launcher;

  const handleRefresh = useCallback(() => {
    refresh();
    trackEvent(ANALYTICS_KEYS.apex_tests_class_refresh);
  }, [refresh, trackEvent]);

  return (
    <div className="slds-is-relative">
      <Grid verticalAlign="center" className="slds-m-vertical_x-small">
        {!!selectedClasses.size && (
          <span>
            {selectedClasses.size} {selectedClasses.size === 1 ? 'class' : 'classes'}
            {selectedMethodCount ? ` / ${selectedMethodCount} ${selectedMethodCount === 1 ? 'method' : 'methods'}` : ''} selected
          </span>
        )}
        {!!selectedClasses.size && (
          <button className="slds-button slds-m-left_small" onClick={clearSelection}>
            Clear Selection
          </button>
        )}
        <div className="slds-col_bump-left">
          <button
            className="slds-button slds-button_neutral"
            disabled={loading}
            onClick={handleRefresh}
            title="Re-check the org for new or changed test classes"
          >
            <Icon type="utility" icon="refresh" className="slds-button__icon slds-button__icon_left" omitContainer />
            Refresh Test Classes
          </button>
        </div>
      </Grid>
      <Grid verticalAlign="end" className="slds-m-bottom_x-small">
        <Input
          label="Stop After Failures"
          labelHelp="Stop executing new tests after this many failures. Leave blank for no limit. Applies to class and suite runs."
          css={css`
            width: 170px;
          `}
        >
          <input
            id="max-failed-tests"
            className="slds-input"
            type="number"
            min={0}
            step={1}
            placeholder="No limit"
            disabled={launching}
            value={maxFailedTests}
            onChange={(event) => setMaxFailedTests(event.target.value)}
          />
        </Input>
        <Checkbox
          id="skip-code-coverage"
          className="slds-m-left_small slds-m-bottom_xx-small"
          checked={skipCodeCoverage}
          disabled={launching}
          label="Skip code coverage"
          labelHelp="Runs faster, but coverage results are not collected. Applies to class and suite runs."
          onChange={setSkipCodeCoverage}
        />
      </Grid>
      {errorMessage && (
        <ScopedNotification theme="error" className="slds-m-vertical_x-small">
          {errorMessage}
        </ScopedNotification>
      )}
      {loading && (
        <div className="slds-is-relative slds-m-vertical_large">
          <Spinner size="small" />
          {progressText && <p className="slds-text-align_center slds-p-top_x-large">{progressText}</p>}
        </div>
      )}
      {!loading && (
        <TestClassSelection
          testClasses={testClasses}
          unknownClasses={unknownClasses}
          selectedClasses={selectedClasses}
          onToggleClass={toggleClass}
          onToggleMethod={toggleMethod}
          onSelectAllVisible={selectAllVisible}
        />
      )}
    </div>
  );
};

export default RunTestsTab;
