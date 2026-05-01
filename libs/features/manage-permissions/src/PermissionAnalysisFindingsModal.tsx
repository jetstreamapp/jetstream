import { css } from '@emotion/react';
import { Grid, Modal } from '@jetstream/ui';
import { FunctionComponent, ReactNode } from 'react';
import { getFindingCodeDisplayParts, getFindingLabelForCode, type PermissionAnalysisFinding } from './permission-export-result-view';

function severityLabelForFinding(finding: PermissionAnalysisFinding): string {
  const normalized = String(finding.severity ?? '').toLowerCase();
  if (normalized === 'error' || normalized === 'errors') {
    return 'Error';
  }
  if (normalized === 'warning' || normalized === 'warnings') {
    return 'Warning';
  }
  if (normalized.length > 0) {
    return normalized.charAt(0).toUpperCase() + normalized.slice(1);
  }
  return 'Info';
}

function primaryFindingExplanation(finding: PermissionAnalysisFinding): string {
  const message = String(finding.message ?? '').trim();
  if (message.length > 0) {
    return message;
  }
  const code = typeof finding.code === 'string' ? finding.code : '';
  return getFindingLabelForCode(code) || '—';
}

function findingBlockChrome(finding: PermissionAnalysisFinding): { accent: string; tint: string } {
  const normalized = String(finding.severity ?? '').toLowerCase();
  if (normalized === 'error' || normalized === 'errors') {
    return { accent: '#ba0517', tint: 'rgba(186, 5, 23, 0.06)' };
  }
  if (normalized === 'warning' || normalized === 'warnings') {
    return { accent: '#dd7a01', tint: 'rgba(221, 122, 1, 0.1)' };
  }
  return { accent: '#0176d3', tint: 'rgba(1, 118, 211, 0.07)' };
}

function findingDetailText(finding: PermissionAnalysisFinding, catalogSummary: string): string | null {
  const detail = primaryFindingExplanation(finding).trim();
  if (!detail) {
    return null;
  }
  if (detail === catalogSummary.trim()) {
    return null;
  }
  return detail;
}

export interface PermissionAnalysisFindingsModalProps {
  testId?: string;
  open: boolean;
  title: string;
  tagline: string;
  summaryLine: ReactNode;
  findings: PermissionAnalysisFinding[];
  onClose: () => void;
}

/**
 * Read-only modal listing structured permission export findings (shared by object tree and export grids).
 */
export const PermissionAnalysisFindingsModal: FunctionComponent<PermissionAnalysisFindingsModalProps> = ({
  testId = 'permission-analysis-findings',
  open,
  title,
  tagline,
  summaryLine,
  findings,
  onClose,
}) => {
  if (!open) {
    return null;
  }

  return (
    <Modal
      testId={testId}
      header={title}
      tagline={tagline}
      closeOnBackdropClick
      directionalFooter
      footer={
        <Grid align="end">
          <button type="button" className="slds-button slds-button_neutral" onClick={onClose}>
            Close
          </button>
        </Grid>
      }
      onClose={onClose}
      className="slds-p-around_small"
    >
      <div
        css={css`
          margin-left: auto;
          margin-right: auto;
          text-align: left;
        `}
      >
        <div className="slds-text-body_small slds-text-color_weak slds-m-bottom_small">{summaryLine}</div>
        <div
          className="slds-m-bottom_none"
          css={css`
            margin: 0;
            padding: 0;
            display: flex;
            flex-direction: column;
            align-items: stretch;
            gap: 0.65rem;
            font-family: var(--lwc-fontFamily, 'Salesforce Sans', Arial, sans-serif);
          `}
        >
          {findings.map((finding, index) => {
            const code = typeof finding.code === 'string' ? finding.code.trim() : '';
            const codeParts = getFindingCodeDisplayParts(code || undefined);
            const summaryTitle = codeParts.title.trim();
            const detailText = findingDetailText(finding, summaryTitle);
            const { accent, tint } = findingBlockChrome(finding);
            return (
              <div key={`${code || 'finding'}-${index}`}>
                <div
                  css={css`
                    border-left: 3px solid ${accent};
                    background-color: ${tint};
                    border-radius: 0.1875rem;
                    padding: 0.65rem 0.75rem 0.65rem 0.8rem;
                    line-height: 1.5;
                  `}
                >
                  <div
                    className="slds-text-body_small"
                    css={css`
                      line-height: 1.5;
                    `}
                  >
                    {code ? (
                      <>
                        <span className="slds-text-color_weak">{severityLabelForFinding(finding)}</span>
                        <strong>
                          <span aria-hidden="true"> · </span>
                        </strong>
                        {codeParts.technicalCode ? (
                          <>
                            <strong>{summaryTitle}</strong>{' '}
                            <code
                              css={css`
                                font-size: 0.8125rem;
                                padding: 0.1rem 0.3rem;
                                border-radius: 0.125rem;
                                background: var(--slds-g-color-neutral-base-95, #f3f3f3);
                              `}
                            >
                              {codeParts.technicalCode}
                            </code>
                          </>
                        ) : (
                          <code
                            css={css`
                              font-size: 0.8125rem;
                              font-weight: 600;
                              padding: 0.1rem 0.3rem;
                              border-radius: 0.125rem;
                              background: var(--slds-g-color-neutral-base-95, #f3f3f3);
                            `}
                          >
                            {summaryTitle}
                          </code>
                        )}
                      </>
                    ) : (
                      <span className="slds-text-color_weak">{severityLabelForFinding(finding)}</span>
                    )}
                  </div>
                  {detailText ? (
                    <p
                      className="slds-text-body_regular slds-text-color_weak"
                      css={css`
                        margin: 0.5rem 0 0;
                        padding-left: 0.65rem;
                        line-height: 1.55;
                        font-weight: 400;
                      `}
                    >
                      {detailText}
                    </p>
                  ) : null}
                  {typeof finding.objectApiName === 'string' && finding.objectApiName.trim().length > 0 ? (
                    <p
                      className="slds-text-body_small slds-text-color_weak"
                      css={css`
                        margin: 0.4rem 0 0;
                        padding-left: 0.65rem;
                        line-height: 1.45;
                      `}
                    >
                      Object: <code>{finding.objectApiName.trim()}</code>
                    </p>
                  ) : null}
                  {typeof finding.fieldApiName === 'string' && finding.fieldApiName.trim().length > 0 ? (
                    <p
                      className="slds-text-body_small slds-text-color_weak"
                      css={css`
                        margin: 0.4rem 0 0;
                        padding-left: 0.65rem;
                        line-height: 1.45;
                      `}
                    >
                      Field: <code>{finding.fieldApiName.trim()}</code>
                    </p>
                  ) : null}
                  {typeof finding.permissionSetId === 'string' && finding.permissionSetId.trim().length > 0 ? (
                    <p
                      className="slds-text-body_small slds-text-color_weak"
                      css={css`
                        margin: 0.4rem 0 0;
                        padding-left: 0.65rem;
                        line-height: 1.45;
                      `}
                    >
                      Permission set Id: <code>{finding.permissionSetId.trim()}</code>
                    </p>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </Modal>
  );
};
