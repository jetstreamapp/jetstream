import { orderObjectsBy } from '@jetstream/shared/utils';
import { DeployResult, UiTabSection } from '@jetstream/types';
import { CampingRainIllustration, EmptyState, Icon, OpenRoadIllustration, ResearchIllustration, Tabs, TabsRef } from '@jetstream/ui';
import {
  DeployMetadataResultsFailureTable,
  DeployMetadataResultsSuccessTable,
  DeployMetadataUnitTestCodeCoverageResultsTable,
  DeployMetadataUnitTestFailuresTable,
} from '@jetstream/ui-core';
import { FunctionComponent, useEffect, useRef, useState } from 'react';

const SuccessIcon = (
  <Icon
    type="utility"
    icon="success"
    description="Successful Icon"
    containerClassname="slds-icon-utility-success slds-m-right_xx-small"
    className="slds-icon slds-icon_x-small slds-icon-text-success"
  />
);

const ErrorIcon = (
  <Icon
    type="utility"
    icon="error"
    description="Error Icon"
    containerClassname="slds-icon-utility-error slds-m-right_xx-small"
    className="slds-icon slds-icon_x-small slds-icon-text-error"
  />
);

const NoItemsPlaceholder: FunctionComponent<{ done: boolean; isErrorOrWarning?: boolean }> = ({ done, isErrorOrWarning }) => {
  if (done && isErrorOrWarning) {
    return <EmptyState headline="There are no items to show" illustration={<OpenRoadIllustration />}></EmptyState>;
  } else if (done) {
    return <EmptyState headline="There are no items to show" illustration={<CampingRainIllustration />}></EmptyState>;
  }
  return <EmptyState headline="There are no items to show" illustration={<ResearchIllustration />}></EmptyState>;
};

export interface DeployMetadataResultsTablesProps {
  results: DeployResult;
}

export const DeployMetadataResultsTables: FunctionComponent<DeployMetadataResultsTablesProps> = ({ results }) => {
  const [hasErrors, setHasErrors] = useState(false);
  const tabsRef = useRef<TabsRef>();

  // remove package.xml empty placeholder
  const componentSuccesses = orderObjectsBy(
    (results?.details?.componentSuccesses || []).filter((item) => item.componentType),
    'fullName'
  );
  const componentFailures = orderObjectsBy(results?.details?.componentFailures || [], 'fullName');
  const unitTestFailures = orderObjectsBy(results?.details?.runTestResult?.failures || [], 'packageName');
  const codeCoverageWarnings = results?.details?.runTestResult?.codeCoverageWarnings || [];

  // when errors are encountered for the first time, focus the first tab the contains errors then do not auto-focus again
  useEffect(() => {
    if (!hasErrors && tabsRef.current) {
      if (componentFailures.length > 0) {
        setHasErrors(true);
        tabsRef.current.changeTab('component-errors');
      } else if (results.runTestsEnabled) {
        if (unitTestFailures.length > 0) {
          setHasErrors(true);
          tabsRef.current.changeTab('unit-test-failures');
        } else if (codeCoverageWarnings.length > 0) {
          setHasErrors(true);
          tabsRef.current.changeTab('unit-test-failures');
        }
      }
    }
  }, [hasErrors, componentFailures.length, unitTestFailures.length, results.runTestsEnabled, codeCoverageWarnings.length]);

  const tabs: UiTabSection[] = [
    {
      id: 'component-successes',
      title: (
        <span className="slds-tabs__left-icon">
          {SuccessIcon}
          <span>Successful Components ({componentSuccesses.length})</span>
        </span>
      ),
      titleText: 'Successful Components',
      content:
        Array.isArray(componentSuccesses) && !!componentSuccesses.length ? (
          <DeployMetadataResultsSuccessTable title="Successful Components" componentDetails={componentSuccesses} />
        ) : (
          <NoItemsPlaceholder done={results.done} />
        ),
    },
    {
      id: 'component-errors',
      title: (
        <span className="slds-tabs__left-icon">
          {componentFailures.length ? ErrorIcon : SuccessIcon}
          <span>Failed Components ({componentFailures.length || 0})</span>
        </span>
      ),
      titleText: 'Failed Components',
      content:
        Array.isArray(componentFailures) && !!componentFailures.length ? (
          <DeployMetadataResultsFailureTable title="Component Errors" componentDetails={componentFailures} />
        ) : (
          <NoItemsPlaceholder done={results.done} isErrorOrWarning />
        ),
    },
  ];

  if (results.runTestsEnabled) {
    tabs.push({
      id: 'unit-test-failures',
      title: (
        <span className="slds-tabs__left-icon">
          {unitTestFailures.length ? ErrorIcon : SuccessIcon}
          <span>Failed Unit Tests ({unitTestFailures.length || 0})</span>
        </span>
      ),
      titleText: 'Unit Test Failures',
      content:
        Array.isArray(unitTestFailures) && !!unitTestFailures.length ? (
          <DeployMetadataUnitTestFailuresTable failures={unitTestFailures} />
        ) : (
          <NoItemsPlaceholder done={results.done} isErrorOrWarning />
        ),
    });
    tabs.push({
      id: 'code-coverage-warnings',
      title: (
        <span className="slds-tabs__left-icon">
          {codeCoverageWarnings.length ? ErrorIcon : SuccessIcon}
          <span>Code Coverage Warnings ({codeCoverageWarnings?.length || 0})</span>
        </span>
      ),
      titleText: 'Code Coverage Warnings',
      content:
        Array.isArray(codeCoverageWarnings) && !!codeCoverageWarnings.length ? (
          <DeployMetadataUnitTestCodeCoverageResultsTable codeCoverageWarnings={codeCoverageWarnings} />
        ) : (
          <NoItemsPlaceholder done={results.done} isErrorOrWarning />
        ),
    });
  }

  return (results?.details && <Tabs ref={tabsRef} initialActiveId="component-successes" tabs={tabs} />) || null;
};

export default DeployMetadataResultsTables;
