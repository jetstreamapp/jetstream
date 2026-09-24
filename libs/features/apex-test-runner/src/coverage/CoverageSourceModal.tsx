import { css, Global } from '@emotion/react';
import { getErrorMessage } from '@jetstream/shared/utils';
import type { ApexCodeCoverageAggregateRecord, SalesforceOrgUi } from '@jetstream/types';
import { Grid, Modal, ScopedNotification, Spinner } from '@jetstream/ui';
import { MonacoEditor } from '@jetstream/ui-core';
import { FunctionComponent, useEffect, useState } from 'react';
import { fetchApexClassOrTriggerBody, fetchCoverageDetail } from '../apex-test-runner-data.utils';
import { getCoveragePercentage } from './coverage-utils';
import {
  COVERAGE_COVERED_CLASS,
  COVERAGE_COVERED_GLYPH_CLASS,
  COVERAGE_COVERED_GUTTER_CLASS,
  COVERAGE_UNCOVERED_CLASS,
  COVERAGE_UNCOVERED_GLYPH_CLASS,
  COVERAGE_UNCOVERED_GUTTER_CLASS,
  useCoverageDecorations,
} from './useCoverageDecorations';

const COVERED_GLYPH = '✓';
const UNCOVERED_GLYPH = '✗';

/**
 * Light styles on the bare selector, dark overrides scoped to the explicit dark scheme class and to
 * system preference when the scheme is "system" — the same body-class convention MonacoEditor's
 * theme handling keys off.
 */
const coverageStyles = css`
  .${COVERAGE_COVERED_CLASS} {
    background: rgba(45, 200, 64, 0.15);
  }
  .${COVERAGE_UNCOVERED_CLASS} {
    background: rgba(234, 0, 30, 0.18);
  }
  .${COVERAGE_COVERED_GUTTER_CLASS} {
    border-left: 3px solid rgb(45, 200, 64);
  }
  .${COVERAGE_UNCOVERED_GUTTER_CLASS} {
    border-left: 3px solid rgb(234, 0, 30);
  }
  /* Glyph-margin marks give a non-colour cue for each line's coverage (WCAG 1.4.1) */
  .${COVERAGE_COVERED_GLYPH_CLASS}::before,
  .${COVERAGE_UNCOVERED_GLYPH_CLASS}::before {
    display: block;
    text-align: center;
    font-size: 0.75rem;
    font-weight: 700;
  }
  .${COVERAGE_COVERED_GLYPH_CLASS}::before {
    content: '${COVERED_GLYPH}';
    color: rgb(45, 200, 64);
  }
  .${COVERAGE_UNCOVERED_GLYPH_CLASS}::before {
    content: '${UNCOVERED_GLYPH}';
    color: rgb(234, 0, 30);
  }
  body.slds-color-scheme--dark {
    .${COVERAGE_COVERED_CLASS} {
      background: rgba(69, 198, 90, 0.2);
    }
    .${COVERAGE_UNCOVERED_CLASS} {
      background: rgba(254, 92, 76, 0.25);
    }
  }
  @media (prefers-color-scheme: dark) {
    body.slds-color-scheme--system {
      .${COVERAGE_COVERED_CLASS} {
        background: rgba(69, 198, 90, 0.2);
      }
      .${COVERAGE_UNCOVERED_CLASS} {
        background: rgba(254, 92, 76, 0.25);
      }
    }
  }
`;

export interface CoverageSourceModalProps {
  selectedOrg: SalesforceOrgUi;
  coverageRecord: ApexCodeCoverageAggregateRecord;
  onClose: () => void;
}

export const CoverageSourceModal: FunctionComponent<CoverageSourceModalProps> = ({ selectedOrg, coverageRecord, onClose }) => {
  const { onEditorMount, setCoverage } = useCoverageDecorations();
  const [body, setBody] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [lineDetailUnavailable, setLineDetailUnavailable] = useState(false);
  /** Freshly fetched aggregate — the table row's counts can lag behind (e.g. tests ran since the table loaded) */
  const [freshCoverageRecord, setFreshCoverageRecord] = useState<ApexCodeCoverageAggregateRecord | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        const [detail, classOrTrigger] = await Promise.all([
          fetchCoverageDetail(selectedOrg, coverageRecord.ApexClassOrTriggerId),
          fetchApexClassOrTriggerBody(selectedOrg, coverageRecord.ApexClassOrTriggerId),
        ]);
        if (cancelled) {
          return;
        }
        setBody(classOrTrigger?.Body ?? null);
        setCoverage(detail?.Coverage ?? null);
        setFreshCoverageRecord(detail);
        // Salesforce leaves the line arrays empty on stale aggregate rows (e.g. class changed since tests last ran)
        const hasLineDetail = !!detail?.Coverage && (detail.Coverage.coveredLines.length > 0 || detail.Coverage.uncoveredLines.length > 0);
        setLineDetailUnavailable(!hasLineDetail && detail !== null && detail.NumLinesCovered + detail.NumLinesUncovered > 0);
        setLoading(false);
      } catch (ex) {
        if (!cancelled) {
          setErrorMessage(getErrorMessage(ex));
          setLoading(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [selectedOrg, coverageRecord, setCoverage]);

  const displayRecord = freshCoverageRecord ?? coverageRecord;
  const percentage = getCoveragePercentage(displayRecord);

  return (
    <Modal
      size="lg"
      header={coverageRecord.ApexClassOrTrigger?.Name ?? 'Code Coverage'}
      tagline={
        <Grid verticalAlign="center">
          <span>
            {percentage === null ? 'No coverable lines' : `${percentage}% covered`} — {displayRecord.NumLinesCovered} covered /{' '}
            {displayRecord.NumLinesUncovered} uncovered
          </span>
          <span
            className="slds-m-left_small"
            css={css`
              border-left: 3px solid rgb(45, 200, 64);
              padding-left: 4px;
            `}
          >
            {COVERED_GLYPH} Covered
          </span>
          <span
            className="slds-m-left_small"
            css={css`
              border-left: 3px solid rgb(234, 0, 30);
              padding-left: 4px;
            `}
          >
            {UNCOVERED_GLYPH} Uncovered
          </span>
        </Grid>
      }
      onClose={onClose}
      footer={
        <button className="slds-button slds-button_neutral" onClick={onClose}>
          Close
        </button>
      }
    >
      <Global styles={coverageStyles} />
      <div
        className="slds-is-relative slds-p-around_x-small"
        css={css`
          min-height: 70vh;
        `}
      >
        {loading && <Spinner size="small" />}
        {errorMessage && (
          <ScopedNotification theme="error" className="slds-m-bottom_x-small">
            {errorMessage}
          </ScopedNotification>
        )}
        {!loading && lineDetailUnavailable && (
          <ScopedNotification theme="info" className="slds-m-bottom_x-small">
            Line-level coverage detail is not available for this class — run tests that cover it to refresh the data.
          </ScopedNotification>
        )}
        {!loading && body !== null && (
          <MonacoEditor
            height="68vh"
            language="apex"
            value={body}
            options={{ readOnly: true, minimap: { enabled: false }, contextmenu: false, glyphMargin: true }}
            onMount={onEditorMount}
          />
        )}
        {!loading && body === null && !errorMessage && <p>The source for this class or trigger could not be loaded.</p>}
      </div>
    </Modal>
  );
};

export default CoverageSourceModal;
