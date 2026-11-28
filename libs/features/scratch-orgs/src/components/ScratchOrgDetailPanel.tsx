import { css } from '@emotion/react';
import type { SalesforceOrgUi } from '@jetstream/types';
import { CopyToClipboard, DisabledReasonButton, Grid, Icon, Panel, SalesforceLogin, ScopedNotification, Spinner } from '@jetstream/ui';
import { FunctionComponent, ReactNode } from 'react';
import type { ScratchOrgRow } from '../scratch-org.types';
import { formatDateValue, getExpirationLabel, getSignupErrorMessage } from '../scratch-org.utils';
import type { PendingScratchOrgStep } from '../useScratchOrgActions';
import ScratchOrgStatusBadge from './ScratchOrgStatusBadge';
import ScratchOrgUsers from './ScratchOrgUsers';

export interface ScratchOrgDetailPanelProps {
  row: ScratchOrgRow | null;
  serverUrl: string;
  pendingStep?: PendingScratchOrgStep;
  isConnecting: boolean;
  isDeleting: boolean;
  connectDeniedReason?: string;
  deleteDeniedReason?: string;
  writeDeniedReason?: string;
  onConnect: (row: ScratchOrgRow) => void;
  onConnectWithPassword: (row: ScratchOrgRow) => void;
  onDelete: (row: ScratchOrgRow) => void;
  onSwitchToOrg: (org: SalesforceOrgUi) => void;
  onClose: () => void;
}

function getGeneratePasswordCommand(username: string): string {
  return `sf org generate password --target-org ${username}`;
}

/** Labels are the same size as their value, the weight and muted color are what tell them apart */
const DETAIL_LABEL_CLASS_NAME = 'slds-text-title slds-text-color_weak text-bold';

const DetailItem: FunctionComponent<{ label: string; copyValue?: string | null; children?: ReactNode }> = ({
  label,
  copyValue,
  children,
}) => {
  if (children === null || children === undefined || children === '') {
    return null;
  }
  return (
    <div
      className="slds-m-bottom_x-small"
      css={css`
        min-width: 0;
      `}
    >
      <dt className={`${DETAIL_LABEL_CLASS_NAME} slds-truncate`}>{label}</dt>
      <dd>
        <Grid verticalAlign="center" noWrap>
          <span className="slds-truncate" title={typeof children === 'string' ? children : undefined}>
            {children}
          </span>
          {copyValue && <CopyToClipboard className="slds-m-left_xx-small" content={copyValue} size="small" />}
        </Grid>
      </dd>
    </div>
  );
};

export const ScratchOrgDetailPanel: FunctionComponent<ScratchOrgDetailPanelProps> = ({
  row,
  serverUrl,
  pendingStep,
  isConnecting,
  isDeleting,
  connectDeniedReason,
  deleteDeniedReason,
  writeDeniedReason,
  onConnect,
  onConnectWithPassword,
  onDelete,
  onSwitchToOrg,
  onClose,
}) => {
  const name = row?.OrgName || row?.SignupUsername || 'Scratch Org';

  return (
    <Panel heading={name} isOpen={!!row} position="right" size="xl" fullHeight onClosed={onClose}>
      {row && (
        <div className="slds-p-around_medium" data-testid="scratch-org-detail">
          <Grid verticalAlign="center" className="slds-m-bottom_small">
            <ScratchOrgStatusBadge row={row} pendingStep={pendingStep} />
            {(row.displayStatus === 'Active' || row.displayStatus === 'Expired') && row.daysRemaining !== null && (
              <span className="slds-m-left_small slds-text-color_weak">{getExpirationLabel(row.daysRemaining)}</span>
            )}
          </Grid>

          {row.displayStatus === 'Error' && (
            <ScopedNotification theme="error" className="slds-m-bottom_small">
              {getSignupErrorMessage(row.ErrorCode)}
            </ScopedNotification>
          )}

          {(row.displayStatus === 'Active' || row.displayStatus === 'Expired' || row.displayStatus === 'Error') && !pendingStep && (
            <Grid
              className="slds-m-bottom_medium"
              wrap
              css={css`
                gap: 0.5rem;
                /* The gap spaces the buttons, including when they wrap */
                .slds-button + .slds-button {
                  margin-left: 0;
                }
              `}
            >
              {row.connectedOrg && (
                <>
                  {/* Always through the frontdoor: nobody knows the password of a scratch org */}
                  <SalesforceLogin
                    className="slds-button slds-button_brand"
                    serverUrl={serverUrl}
                    org={row.connectedOrg}
                    skipFrontDoorAuth={false}
                    returnUrl="/"
                    omitIcon
                  >
                    <Icon type="utility" icon="new_window" className="slds-button__icon slds-button__icon_left" omitContainer />
                    Open in Salesforce
                  </SalesforceLogin>
                  <button
                    className="slds-button slds-button_neutral"
                    title="Make this the active org in Jetstream"
                    onClick={() => row.connectedOrg && onSwitchToOrg(row.connectedOrg)}
                  >
                    <Icon type="utility" icon="change_record_type" className="slds-button__icon slds-button__icon_left" omitContainer />
                    Switch to This Org
                  </button>
                </>
              )}
              {!row.connectedOrg && row.displayStatus === 'Active' && (
                <DisabledReasonButton
                  className="slds-button slds-button_brand slds-is-relative"
                  disabled={!!connectDeniedReason || isConnecting}
                  disabledReason={connectDeniedReason}
                  onClick={() => (row.createdWithJetstream ? onConnect(row) : onConnectWithPassword(row))}
                >
                  {isConnecting && <Spinner size="x-small" />}
                  {row.createdWithJetstream ? 'Connect to Jetstream' : 'Connect with Password'}
                </DisabledReasonButton>
              )}
              <DisabledReasonButton
                className="slds-button slds-button_text-destructive slds-is-relative"
                disabled={!!deleteDeniedReason || isDeleting}
                disabledReason={deleteDeniedReason}
                onClick={() => onDelete(row)}
              >
                {isDeleting && <Spinner size="x-small" />}
                {row.displayStatus === 'Error' ? 'Remove Failed Request' : 'Delete Scratch Org'}
              </DisabledReasonButton>
            </Grid>
          )}

          {row.displayStatus === 'Active' && !row.connectedOrg && !pendingStep && row.createdWithJetstream && (
            <p className="slds-text-color_weak slds-m-bottom_medium">
              This scratch org was created with Jetstream, so it can be connected without a password. Once it is connected you can open it
              in Salesforce, manage its users and generate passwords.
            </p>
          )}
          {row.displayStatus === 'Active' && !row.connectedOrg && !pendingStep && !row.createdWithJetstream && (
            <div className="slds-box slds-box_x-small slds-theme_shade slds-m-bottom_medium">
              <p>
                This scratch org was created outside of Jetstream, and Salesforce only lets the tool that created a scratch org log in to it
                without a password. To connect it, log in with its username and password.
              </p>
              {row.SignupUsername && (
                <>
                  <p className="slds-m-top_x-small">
                    No password? Generate one with the Salesforce CLI on the computer the scratch org was created from:
                  </p>
                  <Grid verticalAlign="center" noWrap className="slds-m-top_xx-small">
                    <code className="slds-truncate" title={getGeneratePasswordCommand(row.SignupUsername)}>
                      {getGeneratePasswordCommand(row.SignupUsername)}
                    </code>
                    <CopyToClipboard
                      className="slds-m-left_xx-small"
                      content={getGeneratePasswordCommand(row.SignupUsername)}
                      size="small"
                    />
                  </Grid>
                </>
              )}
            </div>
          )}

          <dl
            css={css`
              display: grid;
              grid-template-columns: repeat(2, minmax(0, 1fr));
              column-gap: 1rem;
            `}
          >
            <DetailItem label="Username" copyValue={row.SignupUsername}>
              {row.SignupUsername}
            </DetailItem>
            <DetailItem label="Org Id" copyValue={row.ScratchOrg}>
              {row.ScratchOrg}
            </DetailItem>
            <DetailItem label="Login URL" copyValue={row.LoginUrl}>
              {row.LoginUrl}
            </DetailItem>
            <DetailItem label="Instance">{row.SignupInstance}</DetailItem>
            <DetailItem label="Edition">{row.Edition}</DetailItem>
            <DetailItem label="Release">{row.Release}</DetailItem>
            <DetailItem label="Expires">{formatDateValue(row.ExpirationDate, 'MMM d, yyyy')}</DetailItem>
            <DetailItem label="Duration">{row.DurationDays ? `${row.DurationDays} days` : null}</DetailItem>
            <DetailItem label="Created">{formatDateValue(row.CreatedDate, 'MMM d, yyyy h:mm a')}</DetailItem>
            <DetailItem label="Created By">{row.createdByName}</DetailItem>
            <DetailItem label="Admin Email">{row.SignupEmail}</DetailItem>
            <DetailItem label="Last Login">{formatDateValue(row.LastLoginDate, 'MMM d, yyyy h:mm a')}</DetailItem>
            <DetailItem label="Namespace">{row.Namespace}</DetailItem>
            <DetailItem label="Sample Data">{row.HasSampleData ? 'Yes' : null}</DetailItem>
            <DetailItem label="Source Org">{row.SourceOrg}</DetailItem>
            <DetailItem label="Snapshot">{row.Snapshot}</DetailItem>
            <DetailItem label="Request Id" copyValue={row.Id}>
              {row.Name ? `${row.Name} (${row.Id})` : row.Id}
            </DetailItem>
          </dl>

          {row.Features && (
            <div className="slds-m-bottom_x-small">
              <div className={DETAIL_LABEL_CLASS_NAME}>Features</div>
              <div>{row.Features.split(';').join(', ')}</div>
            </div>
          )}
          {row.Description && (
            <div className="slds-m-bottom_x-small">
              <div className={DETAIL_LABEL_CLASS_NAME}>Description</div>
              <div>{row.Description}</div>
            </div>
          )}

          {row.connectedOrg && row.displayStatus === 'Active' && (
            <>
              <hr className="slds-m-vertical_medium" />
              <ScratchOrgUsers key={row.connectedOrg.uniqueId} scratchOrg={row.connectedOrg} writeDeniedReason={writeDeniedReason} />
            </>
          )}
        </div>
      )}
    </Panel>
  );
};

export default ScratchOrgDetailPanel;
