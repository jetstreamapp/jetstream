import { css } from '@emotion/react';
import { UserSessionWithLocationAndUser } from '@jetstream/auth/types';
import { getTeamUserSessions } from '@jetstream/shared/data';
import { getBrowserInfo } from '@jetstream/shared/ui-utils';
import { Modal, ScopedNotification, SessionLocationDisplay, Spinner } from '@jetstream/ui';
import { parseISO } from 'date-fns/parseISO';
import startCase from 'lodash/startCase';
import { useEffect, useMemo, useState } from 'react';

export interface TeamMemberSessionModalProps {
  teamId: string;
  onClose: () => void;
}

export function TeamMemberSessionModal({ teamId, onClose }: TeamMemberSessionModalProps) {
  const [loading, setLoading] = useState(true);
  const [sessions, setSessions] = useState<UserSessionWithLocationAndUser[]>([]);
  const [loadingError, setLoadingError] = useState<string | null>(null);

  useEffect(() => {
    getTeamUserSessions(teamId)
      .then((team) => {
        setSessions(team);
      })
      .catch((error) => {
        setLoadingError(error.message);
      })
      .finally(() => {
        setLoading(false);
      });
  }, [teamId]);

  return (
    <Modal
      header="User Sessions"
      size="lg"
      // footer={
      //   <>
      //     <button className="slds-button slds-button_brand" >
      //       Download
      //     </button>
      //   </>
      // }
      onClose={onClose}
    >
      {loading && <Spinner />}
      {loadingError && (
        <ScopedNotification theme="error" className="slds-m-vertical_medium">
          There was a problem getting your team's sessions. File a support ticket if you need additional assistance.
        </ScopedNotification>
      )}
      <table aria-describedby="team-members-heading" className="slds-table slds-table_cell-buffer slds-table_bordered">
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
          </tr>
        </thead>
        <tbody>
          {sessions.map((session) => (
            <Row key={session.sessionId} session={session} />
          ))}
        </tbody>
      </table>
    </Modal>
  );
}

const Row = ({ session }: { session: UserSessionWithLocationAndUser }) => {
  const { expires, ipAddress, loginTime, provider, user, userAgent, location } = session;

  const { browserName, browserVersion, osName } = useMemo(() => getBrowserInfo(userAgent), [userAgent]);

  return (
    <tr>
      <td role="gridcell">
        {/* Revoke */}
        {/* <UserActionCell isCurrentUser={isCurrentUser} member={member} onUserAction={onUserAction} /> */}
      </td>
      <th scope="row">
        <div title={user.name}>
          <div>{user.name}</div>
          <div>{user.email}</div>
        </div>
      </th>
      <td role="gridcell">
        {browserName && (
          <>
            <p>{osName}</p>
            <p>
              {browserName} {browserVersion}
            </p>
          </>
        )}
      </td>
      <td role="gridcell">
        {ipAddress}
        {location && (
          <div>
            <SessionLocationDisplay location={location} />
          </div>
        )}
      </td>
      <td role="gridcell">{parseISO(loginTime).toLocaleString()}</td>
      <td role="gridcell">{parseISO(expires).toLocaleString()}</td>
      <td role="gridcell">
        {provider && (
          <p className="slds-text-color_weak">Logged in via {provider === 'credentials' ? 'Email & Password' : startCase(provider)}</p>
        )}
      </td>
    </tr>
  );
};
