import { css } from '@emotion/react';
import { APP_ROUTES } from '@jetstream/shared/ui-router';
import type { ApexTestResultRecord } from '@jetstream/types';
import { Badge, Grid, Modal } from '@jetstream/ui';
import { FunctionComponent } from 'react';
import { Link } from 'react-router';
import { formatTestTime, getOutcomeBadgeType } from './test-run-utils';

export interface TestResultDetailModalProps {
  testResult: ApexTestResultRecord;
  onClose: () => void;
}

export const TestResultDetailModal: FunctionComponent<TestResultDetailModalProps> = ({ testResult, onClose }) => {
  return (
    <Modal
      size="lg"
      header={`${testResult.ApexClass?.Name ?? ''}.${testResult.MethodName}`}
      closeOnBackdropClick
      onClose={onClose}
      footer={
        <button className="slds-button slds-button_neutral" onClick={onClose}>
          Close
        </button>
      }
    >
      <div className="slds-p-around_small">
        <Grid verticalAlign="center" className="slds-m-bottom_small">
          <Badge type={getOutcomeBadgeType(testResult.Outcome)}>{testResult.Outcome}</Badge>
          {testResult.RunTime !== null && <span className="slds-m-left_small">{formatTestTime(testResult.RunTime)}</span>}
          {testResult.ApexLogId && (
            <Link
              className="slds-m-left_small"
              to={{ pathname: APP_ROUTES.DEBUG_LOG_VIEWER.ROUTE, search: APP_ROUTES.DEBUG_LOG_VIEWER.SEARCH_PARAM }}
            >
              View in Debug Logs
            </Link>
          )}
        </Grid>
        {testResult.Message && (
          <div className="slds-m-bottom_small">
            <h3 className="slds-text-heading_small">Message</h3>
            <pre
              css={css`
                white-space: pre-wrap;
                word-break: break-word;
              `}
            >
              {testResult.Message}
            </pre>
          </div>
        )}
        {testResult.StackTrace && (
          <div>
            <h3 className="slds-text-heading_small">Stack Trace</h3>
            <pre
              css={css`
                white-space: pre-wrap;
                word-break: break-word;
              `}
            >
              {testResult.StackTrace}
            </pre>
          </div>
        )}
        {!testResult.Message && !testResult.StackTrace && <p>This test passed without any failure details.</p>}
      </div>
    </Modal>
  );
};

export default TestResultDetailModal;
