import { css } from '@emotion/react';
import { MIME_TYPES } from '@jetstream/shared/constants';
import { fetchActiveLog, saveFile } from '@jetstream/shared/ui-utils';
import { getErrorMessage } from '@jetstream/shared/utils';
import type { ApexTestResultRecord, SalesforceOrgUi } from '@jetstream/types';
import { Badge, CopyToClipboard, Grid, Icon, Modal, ScopedNotification, Spinner } from '@jetstream/ui';
import { MonacoEditor } from '@jetstream/ui-core';
import { FunctionComponent, useEffect, useState } from 'react';
import { fetchTestResultLogId } from '../apex-test-runner-data.utils';
import { formatTestTime, getOutcomeBadgeType } from './test-run-utils';

export interface TestResultDetailModalProps {
  selectedOrg: SalesforceOrgUi;
  testResult: ApexTestResultRecord;
  onClose: () => void;
}

export const TestResultDetailModal: FunctionComponent<TestResultDetailModalProps> = ({ selectedOrg, testResult, onClose }) => {
  const [logId, setLogId] = useState<string | null>(testResult.ApexLogId ?? null);
  const [logBody, setLogBody] = useState<string | null>(null);
  const [logLoading, setLogLoading] = useState(true);
  const [logError, setLogError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLogLoading(true);
        setLogError(null);
        // Salesforce links logs to results asynchronously, so a result queried as the run completed
        // may not have a log id yet — re-check the individual record before giving up
        let resolvedLogId = testResult.ApexLogId ?? null;
        if (!resolvedLogId) {
          resolvedLogId = await fetchTestResultLogId(selectedOrg, testResult.Id);
        }
        if (cancelled) {
          return;
        }
        setLogId(resolvedLogId);
        if (!resolvedLogId) {
          setLogLoading(false);
          return;
        }
        const body = await fetchActiveLog(selectedOrg, resolvedLogId);
        if (!cancelled) {
          setLogBody(body);
          setLogLoading(false);
        }
      } catch (ex) {
        if (!cancelled) {
          setLogError(getErrorMessage(ex));
          setLogLoading(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [selectedOrg, testResult.Id, testResult.ApexLogId]);

  function downloadLog() {
    if (logBody === null) {
      return;
    }
    const testName = testResult.ApexClass?.Name ? `${testResult.ApexClass.Name}.${testResult.MethodName}` : testResult.MethodName;
    saveFile(logBody, `log-${testName}-${logId}.log`, MIME_TYPES.PLAN_TEXT);
  }

  return (
    <Modal
      size="lg"
      header={testResult.ApexClass?.Name ? `${testResult.ApexClass.Name}.${testResult.MethodName}` : testResult.MethodName}
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
          <div className="slds-m-bottom_small">
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
        {(logLoading || logError || logId) && (
          <div className="slds-is-relative">
            <Grid verticalAlign="center" className="slds-m-bottom_x-small">
              <h3 className="slds-text-heading_small">Debug Log</h3>
              <div className="slds-col_bump-left">
                <button className="slds-button" title="Download Log" onClick={downloadLog} disabled={logBody === null || logLoading}>
                  <Icon type="utility" icon="download" className="slds-button__icon slds-button__icon_left" omitContainer />
                  Download
                </button>
                <CopyToClipboard
                  type="button"
                  buttonText="Copy debug log"
                  content={logBody ?? ''}
                  disabled={logBody === null || logLoading}
                />
              </div>
            </Grid>
            {logLoading && (
              <div
                className="slds-is-relative"
                css={css`
                  min-height: 60px;
                `}
              >
                <Spinner size="small" />
              </div>
            )}
            {logError && (
              <ScopedNotification theme="error" className="slds-m-bottom_x-small">
                {logError}
              </ScopedNotification>
            )}
            {logBody !== null && (
              <MonacoEditor
                height="50vh"
                defaultLanguage="apex-log"
                value={logBody}
                options={{ readOnly: true, minimap: { enabled: false }, contextmenu: false }}
              />
            )}
          </div>
        )}
        {!logLoading && !logError && !logId && <p>No debug log was captured for this test.</p>}
      </div>
    </Modal>
  );
};

export default TestResultDetailModal;
