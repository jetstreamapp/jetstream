import { css } from '@emotion/react';
import { UserSessionWithLocationAndUser } from '@jetstream/auth/types';
import { getTeamUserSessions, PaginationCursorParams, revokeTeamUserSession } from '@jetstream/shared/data';
import { getBrowserInfo } from '@jetstream/shared/ui-utils';
import { DropDown, fireToast, Modal, ScopedNotification, SessionLocationDisplay, Spinner } from '@jetstream/ui';
import { abilityState } from '@jetstream/ui/app-state';
import { parseISO } from 'date-fns/parseISO';
import { useAtomValue } from 'jotai';
import startCase from 'lodash/startCase';
import { useEffect, useMemo, useState } from 'react';

export interface TeamMemberSessionModalProps {
  teamId: string;
  onClose: () => void;
}

export function TeamMemberSessionModal({ teamId, onClose }: TeamMemberSessionModalProps) {
  const ability = useAtomValue(abilityState);
  const [loading, setLoading] = useState(true);
  const [sessions, setSessions] = useState<UserSessionWithLocationAndUser[]>([]);
  const [loadingError, setLoadingError] = useState<string | null>(null);
  const [pagination, setPagination] = useState<PaginationCursorParams>({ limit: 25 });
  const [currentSessionId, setCurrentSessionId] = useState<string>();
  const [hasMore, setHasMore] = useState(false);

  const canRevokeSession = ability.can('delete', 'TeamMemberSession');

  useEffect(() => {
    getTeamUserSessions(teamId, pagination)
      .then(({ sessions, currentSessionId }) => {
        setCurrentSessionId(currentSessionId);
        setSessions((prev) => [...prev, ...sessions]);
        setHasMore(sessions.length === (pagination.limit || 25));
      })
      .catch((error) => {
        setLoadingError(error.message);
      })
      .finally(() => {
        setLoading(false);
      });
  }, [teamId, pagination]);

  function handleRevokeSession(session: UserSessionWithLocationAndUser) {
    if (!canRevokeSession) {
      return;
    }
    const priorSessions = sessions;
    // Optimistic update
    setSessions((prev) => prev.filter((s) => s.sessionId !== session.sessionId));
    revokeTeamUserSession(teamId, session.sessionId)
      .then(() => {
        fireToast({ message: 'Session revoked successfully.', type: 'success' });
      })
      .catch(() => {
        // Revert optimistic update
        setSessions(priorSessions);
        fireToast({ message: 'Failed to revoke session, please try again or contact support for assistance.', type: 'error' });
      });
  }

  return (
    <Modal
      testId="user-session-modal"
      header="User Sessions"
      size="lg"
      // TODO: revoke sessions, download sessions
      // footer={
      //   <>
      //     <button className="slds-button slds-button_brand" >
      //       Download
      //     </button>
      //   </>
      // }
      className="slds-scrollable"
      onClose={onClose}
    >
      {loading && <Spinner />}
      {loadingError && (
        <ScopedNotification theme="error" className="slds-m-vertical_medium">
          There was a problem getting your team's sessions. File a support ticket if you need additional assistance.
        </ScopedNotification>
      )}
      <table
        aria-describedby="team-members-heading"
        className="slds-table slds-table_cell-buffer slds-table_bordered slds-m-bottom_x-large"
      >
        <thead>
          <tr className="slds-line-height_reset">
            <th
              scope="col"
              css={css`
                width: 3.25rem;
              `}
            >
              <div className="slds-truncate slds-assistive-text" title="Actions">
                Actions
              </div>
            </th>
            <th scope="col">
              <span className="slds-truncate" title="Name">
                User
              </span>
            </th>
            <th scope="col">
              <span className="slds-truncate" title="Email">
                Browser
              </span>
            </th>
            <th scope="col">
              <span className="slds-truncate" title="Email">
                IP Address
              </span>
            </th>
            <th scope="col">
              <span className="slds-truncate" title="Role">
                Created At
              </span>
            </th>
            <th scope="col">
              <span className="slds-truncate" title="Status">
                Expires At
              </span>
            </th>
            <th scope="col">
              <span className="slds-truncate" title="Last Logged In">
                Provider
              </span>
            </th>
            <th
              css={css`
                max-width: 32px;
              `}
            />
          </tr>
        </thead>
        <tbody>
          {sessions.map((session) => (
            <Row
              key={session.sessionId}
              canRevokeSession={canRevokeSession && currentSessionId !== session.sessionId}
              session={session}
              onRevoke={handleRevokeSession}
            />
          ))}
        </tbody>
        <tfoot>
          {hasMore && (
            <tr>
              <td colSpan={7} css={{ textAlign: 'center' }}>
                <button
                  className="slds-button slds-button_neutral"
                  disabled={loading}
                  onClick={() => {
                    const { sessionId } = sessions[sessions.length - 1];
                    setLoading(true);
                    setPagination((prev) => ({ ...prev, cursorId: sessionId }));
                  }}
                >
                  Load More
                </button>
              </td>
            </tr>
          )}
        </tfoot>
      </table>
    </Modal>
  );
}

const Row = ({
  canRevokeSession,
  session,
  onRevoke,
}: {
  canRevokeSession: boolean;
  session: UserSessionWithLocationAndUser;
  onRevoke: (session: UserSessionWithLocationAndUser) => void;
}) => {
  const { expires, ipAddress, loginTime, provider, user, userAgent, location } = session;

  const { browserName, browserVersion, osName } = useMemo(() => getBrowserInfo(userAgent), [userAgent]);

  return (
    <tr>
      <td role="gridcell">
        {/* Revoke */}
        {/* <UserActionCell isCurrentUser={isCurrentUser} member={member} onUserAction={onUserAction} /> */}
      </td>
      <th scope="row" className="slds-cell-wrap">
        <div title={user.name}>
          <div>{user.name}</div>
          <div>{user.email}</div>
        </div>
      </th>
      <td role="gridcell" className="slds-cell-wrap">
        {browserName && (
          <>
            <p>{osName}</p>
            <p>
              {browserName} {browserVersion}
            </p>
          </>
        )}
      </td>
      <td role="gridcell" className="slds-cell-wrap">
        {ipAddress}
        {location && (
          <div>
            <SessionLocationDisplay location={location} />
          </div>
        )}
      </td>
      <td role="gridcell" className="slds-cell-wrap">
        {parseISO(loginTime).toLocaleString()}
      </td>
      <td role="gridcell" className="slds-cell-wrap">
        {parseISO(expires).toLocaleString()}
      </td>
      <td role="gridcell" className="slds-cell-wrap">
        {provider && (
          <p className="slds-text-color_weak">Logged in via {provider === 'credentials' ? 'Email & Password' : startCase(provider)}</p>
        )}
      </td>
      <td
        css={css`
          max-width: 32px;
        `}
      >
        {canRevokeSession && (
          <DropDown
            testId="user-session-row-actions"
            dropDownClassName="slds-dropdown_actions"
            buttonClassName="slds-button slds-button_icon slds-button_icon-border-filled slds-button_icon-x-small"
            position="right"
            items={[
              {
                id: 'revoke',
                value: 'Revoke Session',
                icon: { type: 'utility', icon: 'delete', description: 'Revoke Session' },
              },
            ]}
            onSelected={(id) => {
              if (id === 'revoke') {
                onRevoke(session);
              }
            }}
          />
        )}
      </td>
    </tr>
  );
};
