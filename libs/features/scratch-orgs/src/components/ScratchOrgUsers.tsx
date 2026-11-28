import { css } from '@emotion/react';
import { getErrorMessage } from '@jetstream/shared/utils';
import type { SalesforceOrgUi } from '@jetstream/types';
import { Badge, ConfirmationModalPromise, DisabledReasonButton, Grid, Icon, ScopedNotification, Spinner } from '@jetstream/ui';
import { formatDate } from 'date-fns/format';
import { parseISO } from 'date-fns/parseISO';
import { FunctionComponent, useCallback, useEffect, useRef, useState } from 'react';
import { fetchScratchOrgUsers, setScratchOrgUserPassword } from '../scratch-org-data.utils';
import type { GeneratedCredentials, ScratchOrgUserRecord } from '../scratch-org.types';
import { generatePassword } from '../scratch-org.utils';
import CreateScratchOrgUserModal from './CreateScratchOrgUserModal';
import CredentialsModal from './CredentialsModal';

export interface ScratchOrgUsersProps {
  /** The scratch org's connection in Jetstream, users are read and changed through it */
  scratchOrg: SalesforceOrgUi;
  /** Set when the member's access profile does not allow creating users or changing passwords */
  writeDeniedReason?: string;
}

export const ScratchOrgUsers: FunctionComponent<ScratchOrgUsersProps> = ({ scratchOrg, writeDeniedReason }) => {
  const currentFetchToken = useRef(0);
  const [users, setUsers] = useState<ScratchOrgUserRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [generatingForUserId, setGeneratingForUserId] = useState<string | null>(null);
  const [credentials, setCredentials] = useState<GeneratedCredentials | null>(null);
  const [createUserOpen, setCreateUserOpen] = useState(false);

  // The org object is replaced whenever the list of orgs is refetched, only a different org should reload the users
  const scratchOrgRef = useRef(scratchOrg);
  useEffect(() => {
    scratchOrgRef.current = scratchOrg;
  }, [scratchOrg]);
  const scratchOrgId = scratchOrg.uniqueId;

  const fetchUsers = useCallback(async () => {
    const fetchToken = ++currentFetchToken.current;
    setLoading(true);
    try {
      const records = await fetchScratchOrgUsers(scratchOrgRef.current);
      if (fetchToken === currentFetchToken.current) {
        setUsers(records);
        setErrorMessage(null);
      }
    } catch (ex) {
      if (fetchToken === currentFetchToken.current) {
        setErrorMessage(getErrorMessage(ex));
      }
    } finally {
      if (fetchToken === currentFetchToken.current) {
        setLoading(false);
      }
    }
    // scratchOrgId is a dependency so that a different org gets a new function, which is what reloads the users
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scratchOrgId]);

  useEffect(() => {
    const fetchTokenRef = currentFetchToken;
    setUsers([]);
    fetchUsers();
    return () => {
      fetchTokenRef.current++;
    };
  }, [fetchUsers]);

  async function handleGeneratePassword({ Id, Name, Username }: ScratchOrgUserRecord) {
    const confirmed = await ConfirmationModalPromise({
      header: 'Generate Password',
      content: `Generate a new password for ${Name} (${Username})? Their current password will stop working.`,
      confirm: 'Generate Password',
    });
    if (!confirmed) {
      return;
    }
    setGeneratingForUserId(Id);
    setErrorMessage(null);
    try {
      const password = generatePassword();
      await setScratchOrgUserPassword(scratchOrg, Id, password);
      setCredentials({ username: Username, password, loginUrl: scratchOrg.instanceUrl });
    } catch (ex) {
      setErrorMessage(`Unable to set the password for ${Username}. ${getErrorMessage(ex)}`);
    } finally {
      setGeneratingForUserId(null);
    }
  }

  function handleUserCreated(newCredentials: GeneratedCredentials | null) {
    setCreateUserOpen(false);
    setCredentials(newCredentials);
    fetchUsers();
  }

  return (
    <div className="slds-is-relative">
      {credentials && <CredentialsModal credentials={credentials} onClose={() => setCredentials(null)} />}
      {createUserOpen && (
        <CreateScratchOrgUserModal scratchOrg={scratchOrg} onClose={() => setCreateUserOpen(false)} onCreated={handleUserCreated} />
      )}
      <Grid align="spread" verticalAlign="center" className="slds-m-bottom_x-small">
        <h3 className="slds-text-heading_small">Users</h3>
        <div>
          <button
            className="slds-button slds-button_icon slds-button_icon-border-filled"
            title="Refresh users"
            onClick={() => fetchUsers()}
          >
            <Icon type="utility" icon="refresh" className="slds-button__icon" omitContainer description="Refresh users" />
          </button>
          <DisabledReasonButton
            className="slds-button slds-button_neutral slds-m-left_x-small"
            disabled={!!writeDeniedReason}
            disabledReason={writeDeniedReason}
            onClick={() => setCreateUserOpen(true)}
          >
            <Icon type="utility" icon="add" className="slds-button__icon slds-button__icon_left" omitContainer />
            New User
          </DisabledReasonButton>
        </div>
      </Grid>
      {errorMessage && (
        <ScopedNotification theme="error" className="slds-m-bottom_x-small">
          {errorMessage}
        </ScopedNotification>
      )}
      {loading && !users.length && <Spinner size="small" />}
      {!loading && !users.length && !errorMessage && <p className="slds-text-color_weak">No users were found.</p>}
      <ul className="slds-has-dividers_around-space">
        {users.map((user) => {
          const { Id, Name, Username, IsActive, LastLoginDate, Profile } = user;
          const isGenerating = generatingForUserId === Id;
          return (
            <li key={Id} className="slds-item">
              <Grid align="spread" verticalAlign="center" noWrap>
                <div
                  className="slds-truncate slds-m-right_small"
                  css={css`
                    min-width: 0;
                  `}
                >
                  <div className="slds-truncate">
                    <span className="slds-text-title_bold">{Name}</span>
                    {!IsActive && <Badge className="slds-m-left_x-small">Inactive</Badge>}
                    {Id.slice(0, 15) === scratchOrg.userId.slice(0, 15) && (
                      <Badge type="light" className="slds-m-left_x-small" title="Jetstream is connected to the scratch org as this user">
                        Connected User
                      </Badge>
                    )}
                  </div>
                  <div className="slds-truncate slds-text-body_small" title={Username}>
                    {Username}
                  </div>
                  <div className="slds-truncate slds-text-body_small slds-text-color_weak">
                    {Profile?.Name || 'No profile'} ·{' '}
                    {LastLoginDate ? `Last login ${formatDate(parseISO(LastLoginDate), 'MMM d, yyyy h:mm a')}` : 'Never logged in'}
                  </div>
                </div>
                <DisabledReasonButton
                  className="slds-button slds-button_neutral slds-is-relative slds-no-flex"
                  css={css`
                    white-space: nowrap;
                  `}
                  disabled={!!writeDeniedReason || isGenerating || !IsActive}
                  disabledReason={writeDeniedReason ?? (!IsActive ? 'This user is inactive' : null)}
                  tooltip="Set a new random password and show it"
                  tooltipOpenDelay={500}
                  aria-label={`Generate password for ${Name}`}
                  onClick={() => handleGeneratePassword(user)}
                >
                  {isGenerating && <Spinner size="x-small" />}
                  Generate Password
                </DisabledReasonButton>
              </Grid>
            </li>
          );
        })}
      </ul>
    </div>
  );
};

export default ScratchOrgUsers;
