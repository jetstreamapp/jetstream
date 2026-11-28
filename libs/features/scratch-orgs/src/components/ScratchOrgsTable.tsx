import { css } from '@emotion/react';
import { Badge, DisabledReasonButton, Icon, SalesforceLogin, Spinner } from '@jetstream/ui';
import classNames from 'classnames';
import { FunctionComponent, MouseEvent } from 'react';
import type { ScratchOrgRow } from '../scratch-org.types';
import { EXPIRING_SOON_DAYS, formatDateValue, getExpirationLabel } from '../scratch-org.utils';
import type { PendingScratchOrgStep } from '../useScratchOrgActions';
import ScratchOrgStatusBadge from './ScratchOrgStatusBadge';

export interface ScratchOrgsTableProps {
  rows: ScratchOrgRow[];
  selectedId: string | null;
  serverUrl: string;
  pendingSteps: Record<string, PendingScratchOrgStep>;
  connectingIds: Set<string>;
  deletingIds: Set<string>;
  connectDeniedReason?: string;
  deleteDeniedReason?: string;
  onSelect: (row: ScratchOrgRow) => void;
  onConnect: (row: ScratchOrgRow) => void;
  onConnectWithPassword: (row: ScratchOrgRow) => void;
  onDelete: (row: ScratchOrgRow) => void;
}

const ROW_STYLES = css`
  cursor: pointer;
`;

/**
 * Whether a click on a row is meant for the row itself, rather than for one of the controls in it.
 * The name stays a button so that the details can be opened with the keyboard, the row click is a larger target for the mouse.
 */
function isRowClick(event: MouseEvent<HTMLTableRowElement>): boolean {
  const target = event.target as Element;
  // Tooltips and menus are rendered in a portal, their clicks bubble here through React without being inside of the row
  if (!event.currentTarget.contains(target)) {
    return false;
  }
  if (target.closest('button, a, input, select, textarea, [role="button"], [role="menuitem"]')) {
    return false;
  }
  // Dragging over a row to select its text ends with a click as well
  return !window.getSelection()?.toString();
}

export const ScratchOrgsTable: FunctionComponent<ScratchOrgsTableProps> = ({
  rows,
  selectedId,
  serverUrl,
  pendingSteps,
  connectingIds,
  deletingIds,
  connectDeniedReason,
  deleteDeniedReason,
  onSelect,
  onConnect,
  onConnectWithPassword,
  onDelete,
}) => {
  return (
    <table
      className="slds-table slds-table_cell-buffer slds-table_bordered slds-table_fixed-layout"
      aria-label="Scratch orgs"
      css={css`
        thead th {
          position: sticky;
          top: 0;
          z-index: 1;
        }
      `}
    >
      <thead>
        <tr className="slds-line-height_reset">
          <th scope="col" css={{ width: '26%' }}>
            <div className="slds-truncate">Scratch Org</div>
          </th>
          <th scope="col" css={{ width: '13%' }}>
            <div className="slds-truncate">Status</div>
          </th>
          <th scope="col" css={{ width: '13%' }}>
            <div className="slds-truncate">Expires</div>
          </th>
          <th scope="col" css={{ width: '10%' }}>
            <div className="slds-truncate">Edition</div>
          </th>
          <th scope="col" css={{ width: '14%' }}>
            <div className="slds-truncate">Created</div>
          </th>
          <th scope="col" css={{ width: '18%' }}>
            <div className="slds-truncate">Jetstream</div>
          </th>
          <th scope="col" css={{ width: '6%' }}>
            <span className="slds-assistive-text">Actions</span>
          </th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => {
          const { Id, OrgName, SignupUsername, Edition, ExpirationDate, CreatedDate, displayStatus, daysRemaining, connectedOrg } = row;
          const name = OrgName || SignupUsername || Id;
          const isConnecting = connectingIds.has(Id);
          const isDeleting = deletingIds.has(Id);
          const isExpiringSoon = displayStatus === 'Active' && daysRemaining !== null && daysRemaining <= EXPIRING_SOON_DAYS;
          return (
            <tr
              key={Id}
              className={classNames('slds-hint-parent', { 'slds-is-selected': selectedId === Id })}
              aria-current={selectedId === Id ? 'true' : undefined}
              data-testid={`scratch-org-${Id}`}
              css={ROW_STYLES}
              onClick={(event) => isRowClick(event) && onSelect(row)}
            >
              <th scope="row">
                <button
                  className="slds-button slds-text-align_left slds-truncate"
                  css={css`
                    max-width: 100%;
                    display: block;
                  `}
                  title={`View details for ${name}`}
                  onClick={() => onSelect(row)}
                >
                  {name}
                </button>
                {SignupUsername && (
                  <div className="slds-truncate slds-text-body_small slds-text-color_weak" title={SignupUsername}>
                    {SignupUsername}
                  </div>
                )}
              </th>
              <td>
                <ScratchOrgStatusBadge row={row} pendingStep={pendingSteps[Id]} />
              </td>
              <td>
                {(displayStatus === 'Active' || displayStatus === 'Expired') && (
                  <>
                    <div className="slds-truncate">{formatDateValue(ExpirationDate, 'MMM d, yyyy')}</div>
                    <div
                      className={classNames('slds-truncate slds-text-body_small', {
                        'slds-text-color_error': isExpiringSoon || displayStatus === 'Expired',
                        'slds-text-color_weak': !isExpiringSoon && displayStatus !== 'Expired',
                      })}
                    >
                      {getExpirationLabel(daysRemaining)}
                    </div>
                  </>
                )}
              </td>
              <td>
                <div className="slds-truncate" title={Edition ?? undefined}>
                  {Edition}
                </div>
              </td>
              <td>
                <div className="slds-truncate">{formatDateValue(CreatedDate, 'MMM d, yyyy')}</div>
                {row.createdByName && (
                  <div className="slds-truncate slds-text-body_small slds-text-color_weak" title={row.createdByName}>
                    {row.createdByName}
                  </div>
                )}
              </td>
              <td>
                {connectedOrg && (
                  <>
                    <Badge type="success" className="slds-m-right_x-small">
                      Connected
                    </Badge>
                    {/* Always through the frontdoor: nobody knows the password of a scratch org */}
                    <SalesforceLogin
                      serverUrl={serverUrl}
                      org={connectedOrg}
                      skipFrontDoorAuth={false}
                      returnUrl="/"
                      title={`Open ${name} in Salesforce`}
                    >
                      Open
                    </SalesforceLogin>
                  </>
                )}
                {!connectedOrg && displayStatus === 'Active' && !pendingSteps[Id] && (
                  <DisabledReasonButton
                    className="slds-button slds-button_neutral"
                    disabled={!!connectDeniedReason || isConnecting}
                    disabledReason={connectDeniedReason}
                    tooltip={
                      row.createdWithJetstream
                        ? 'Connect this scratch org to Jetstream, no password required'
                        : 'This scratch org was created outside of Jetstream, log in with its username and password to connect it'
                    }
                    tooltipOpenDelay={500}
                    onClick={() => (row.createdWithJetstream ? onConnect(row) : onConnectWithPassword(row))}
                  >
                    {isConnecting && <Spinner size="x-small" />}
                    {row.createdWithJetstream ? 'Connect' : 'Connect with Password'}
                  </DisabledReasonButton>
                )}
              </td>
              <td className="slds-text-align_right">
                {displayStatus !== 'Deleted' && displayStatus !== 'Creating' && !pendingSteps[Id] && (
                  <DisabledReasonButton
                    className="slds-button slds-button_icon slds-button_icon-border-filled slds-is-relative"
                    disabled={!!deleteDeniedReason || isDeleting}
                    disabledReason={deleteDeniedReason}
                    tooltip="Delete scratch org"
                    tooltipOpenDelay={500}
                    aria-label={`Delete scratch org ${name}`}
                    onClick={() => onDelete(row)}
                  >
                    {isDeleting ? (
                      <Spinner size="x-small" />
                    ) : (
                      <Icon type="utility" icon="delete" className="slds-button__icon" omitContainer />
                    )}
                  </DisabledReasonButton>
                )}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
};

export default ScratchOrgsTable;
