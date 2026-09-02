import { ANALYTICS_KEYS } from '@jetstream/shared/constants';
import { getErrorMessage } from '@jetstream/shared/utils';
import type { ApexCodeCoverageAggregateRecord, SalesforceOrgUi } from '@jetstream/types';
import { ariaDisabledButtonProps, Grid, Icon, ScopedNotification, SearchInput, Spinner } from '@jetstream/ui';
import { useAmplitude } from '@jetstream/ui-core';
import { FunctionComponent, useCallback, useEffect, useState } from 'react';
import { fetchCoverageAggregates, fetchOrgWideCoverage } from '../apex-test-runner-data.utils';
import CoverageSourceModal from './CoverageSourceModal';
import CoverageTable from './CoverageTable';

export interface CoverageTabProps {
  selectedOrg: SalesforceOrgUi;
}

export const CoverageTab: FunctionComponent<CoverageTabProps> = ({ selectedOrg }) => {
  const { trackEvent } = useAmplitude();
  const [coverageRecords, setCoverageRecords] = useState<ApexCodeCoverageAggregateRecord[]>([]);
  const [orgWideCoverage, setOrgWideCoverage] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedRecord, setSelectedRecord] = useState<ApexCodeCoverageAggregateRecord | null>(null);

  const loadCoverage = useCallback(async () => {
    try {
      setLoading(true);
      setErrorMessage(null);
      const [records, orgWide] = await Promise.all([fetchCoverageAggregates(selectedOrg), fetchOrgWideCoverage(selectedOrg)]);
      setCoverageRecords(records);
      setOrgWideCoverage(orgWide);
      setLoading(false);
    } catch (ex) {
      setErrorMessage(getErrorMessage(ex));
      setLoading(false);
    }
  }, [selectedOrg]);

  useEffect(() => {
    setCoverageRecords([]);
    setOrgWideCoverage(null);
    loadCoverage();
  }, [loadCoverage]);

  const handleRowSelection = useCallback(
    (record: ApexCodeCoverageAggregateRecord) => {
      setSelectedRecord(record);
      trackEvent(ANALYTICS_KEYS.apex_tests_coverage_viewed);
    },
    [trackEvent],
  );

  return (
    <div className="slds-is-relative">
      {selectedRecord && (
        <CoverageSourceModal selectedOrg={selectedOrg} coverageRecord={selectedRecord} onClose={() => setSelectedRecord(null)} />
      )}
      <Grid verticalAlign="center" className="slds-m-vertical_x-small">
        {orgWideCoverage !== null && (
          <span className="slds-m-right_small">
            Org-Wide Coverage:{' '}
            <strong className={orgWideCoverage < 75 ? 'slds-text-color_error' : 'slds-text-color_success'}>{orgWideCoverage}%</strong>
            <span className="slds-m-left_x-small slds-text-body_small slds-text-color_weak">(75% required to deploy)</span>
          </span>
        )}
        <SearchInput id="coverage-search" placeholder="Filter classes and triggers" onChange={setSearchTerm} />
        <div className="slds-col_bump-left">
          {/* Stays focusable while its own click disables it — native disabled would drop focus to <body> */}
          <button
            className="slds-button slds-button_neutral"
            title="Coverage data only changes when tests are run"
            {...ariaDisabledButtonProps(loading, () => loadCoverage())}
          >
            <Icon type="utility" icon="refresh" className="slds-button__icon slds-button__icon_left" omitContainer />
            Refresh
          </button>
        </div>
      </Grid>
      {errorMessage && (
        <ScopedNotification theme="error" className="slds-m-vertical_x-small">
          {errorMessage}
        </ScopedNotification>
      )}
      {loading && <Spinner size="small" />}
      {!loading && !coverageRecords.length && (
        <p className="slds-m-vertical_medium slds-text-align_center">
          No code coverage data exists yet — run some tests to populate coverage.
        </p>
      )}
      {!!coverageRecords.length && (
        <CoverageTable coverageRecords={coverageRecords} quickFilterText={searchTerm} onRowSelection={handleRowSelection} />
      )}
    </div>
  );
};

export default CoverageTab;
