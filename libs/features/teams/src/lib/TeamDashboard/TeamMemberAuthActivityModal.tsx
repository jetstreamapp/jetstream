import { css } from '@emotion/react';
import { LoginActivityUserFacing } from '@jetstream/auth/types';
import { getTeamAuthActivity, PaginationCursorParams } from '@jetstream/shared/data';
import { getBrowserInfo } from '@jetstream/shared/ui-utils';
import { Modal, ScopedNotification, SessionLocationDisplay, Spinner } from '@jetstream/ui';
import { parseISO } from 'date-fns/parseISO';
import { useEffect, useMemo, useState } from 'react';

export interface TeamMemberAuthActivityModalProps {
  teamId: string;
  onClose: () => void;
}

export function TeamMemberAuthActivityModal({ teamId, onClose }: TeamMemberAuthActivityModalProps) {
  const [loading, setLoading] = useState(true);
  const [authActivity, setAuthActivity] = useState<LoginActivityUserFacing[]>([]);
  const [loadingError, setLoadingError] = useState<string | null>(null);
  const [pagination, setPagination] = useState<PaginationCursorParams>({ limit: 25 });
  const [hasMore, setHasMore] = useState(false);

  useEffect(() => {
    setLoading(true);
    getTeamAuthActivity(teamId, pagination)
      .then((authActivity) => {
        // combine all pages
        setAuthActivity((prev) => [...prev, ...authActivity]);
        setHasMore(authActivity.length === (pagination.limit || 25));
      })
      .catch((error) => {
        setLoadingError(error.message);
      })
      .finally(() => {
        setLoading(false);
      });
  }, [teamId, pagination]);

  return (
    <Modal
      testId="team-member-auth-activity-modal"
      header="Authentication Activity"
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
          There was a problem getting your team's authentication activity. File a support ticket if you need additional assistance.
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
                Action
              </span>
            </th>
            <th scope="col">
              <span className="slds-truncate" title="Status">
                Created At
              </span>
            </th>
            <th scope="col">
              <span className="slds-truncate" title="Last Logged In">
                Outcome
              </span>
            </th>
          </tr>
        </thead>
        <tbody>
          {authActivity.map((item, i) => (
            <Row key={i} item={item} />
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
                    const { id } = authActivity[authActivity.length - 1];
                    setLoading(true);
                    setPagination((prev) => ({ ...prev, cursorId: id }));
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

const Row = ({ item }: { item: LoginActivityUserFacing }) => {
  const { action, createdAt, ipAddress, userAgent, success, location, user } = item;

  const { browserName, browserVersion, osName } = useMemo(
    () => (userAgent ? getBrowserInfo(userAgent) : { browserName: '', browserVersion: '', osName: '' }),
    [userAgent],
  );

  return (
    <tr>
      <td role="gridcell" className="slds-cell-wrap">
        {/* Revoke */}
        {/* <UserActionCell isCurrentUser={isCurrentUser} member={member} onUserAction={onUserAction} /> */}
      </td>
      <th scope="row" className="slds-cell-wrap">
        {user && (
          <div title={user.name}>
            <div>{user.name}</div>
            <div>{user.email}</div>
          </div>
        )}
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
        {action}
      </td>
      <td role="gridcell" className="slds-cell-wrap">
        {parseISO(createdAt).toLocaleString()}
      </td>
      <td role="gridcell" className="slds-cell-wrap">
        {success ? <p className="slds-text-color_success">Successful</p> : <p className="slds-text-color_error">Failed</p>}
      </td>
    </tr>
  );
};
