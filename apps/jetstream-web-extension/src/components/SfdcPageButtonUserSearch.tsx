import { css } from '@emotion/react';
import { useDebounce, useNonInitialEffect } from '@jetstream/shared/ui-utils';
import type { QueryResult } from '@jetstream/types';
import { CopyToClipboard, Grid, GridCol, List, ScopedNotification, SearchInput } from '@jetstream/ui';
import { useEffect, useRef, useState } from 'react';
import browser from 'webextension-polyfill';
import '../sfdc-styles-shim.scss';
import { getApiClientFromHost } from '../utils/extension-generic-api-request.utils';
import { OrgAndSessionInfo } from '../utils/extension.types';
import { sendMessage } from '../utils/web-extension.utils';

interface SfdcPageButtonUserSearchProps {
  sfHost: string;
}

interface User {
  Id: string;
  Name: string;
  Alias: string;
  CreatedDate: string;
  Email: string;
  IsActive: boolean;
  Profile: {
    Id: string;
    Name: string;
  };
  Username: string;
  UserRole?: {
    Id: string;
    Name: string;
  };
  UserType:
    | 'Standard'
    | 'PowerPartner'
    | 'PowerCustomerSuccess'
    | 'CustomerSuccess'
    | 'Guest'
    | 'CspLitePortal'
    | 'CsnOnly'
    | 'SelfService';
}

function getUserSearchSoql(searchTerm: string) {
  const isPossibleId = /^([0-9a-zA-Z]{16}|[0-9a-zA-Z]{18})$/.test(searchTerm);
  return [
    `SELECT Id, Name, Alias, FORMAT(CreatedDate), Email, IsActive, Profile.Id, Profile.Name, Username, UserRole.Id, UserRole.Name, UserType`,
    `FROM User`,
    `WHERE Name LIKE '%${searchTerm}%' OR Email LIKE '%${searchTerm}%' OR Username LIKE '%${searchTerm}%'`,
    isPossibleId ? `OR Id = '${searchTerm}'` : '',
    `ORDER BY Name LIMIT 50`,
  ].join(' ');
}

export function SfdcPageButtonUserSearch({ sfHost }: SfdcPageButtonUserSearchProps) {
  const currentSearchRef = useRef(0);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const searchTermDebounced = useDebounce(searchTerm, 500);

  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [usersResults, setUsersResults] = useState<QueryResult<User>>();

  const [org, setOrg] = useState<OrgAndSessionInfo | null>(null);
  // const [action, setAction] = useState('view' | 'edit');

  useEffect(() => {
    if (sfHost) {
      sendMessage({
        message: 'GET_CURRENT_ORG',
        data: { sfHost },
      })
        .then((data) => setOrg(data))
        .catch((err) => {
          console.error(err);
          setErrorMessage('There was an error initializing the search');
        });
    }
  }, [sfHost]);

  useNonInitialEffect(() => {
    if (sfHost && searchTermDebounced) {
      const currentSearchValue = currentSearchRef.current;
      setLoading(true);
      setErrorMessage(null);

      getApiClientFromHost(sfHost)
        .then((apiConnection) => apiConnection.query.query<User>(getUserSearchSoql(searchTermDebounced)))
        .then(({ queryResults }) => {
          if (currentSearchRef.current === currentSearchValue) {
            setUsersResults(queryResults);
            setLoading(false);
          }
        })
        .catch((err) => {
          console.error(err);
          setErrorMessage(`There was an error searching for users. ${err.message}`);
        })
        .finally(() => setLoading(false));
    }
    return () => {
      currentSearchRef.current = currentSearchRef.current + 1;
    };
  }, [searchTermDebounced, sfHost]);

  return (
    <>
      <SearchInput
        id="user-search"
        className="w-100"
        placeholder="Id, Name, Email, or Username"
        autoFocus
        loading={loading}
        value={searchTerm}
        onChange={(value) => setSearchTerm(value.trim())}
      />
      {errorMessage && (
        <ScopedNotification theme="error" className="slds-m-vertical_medium">
          {errorMessage}
        </ScopedNotification>
      )}
      {!!usersResults && !usersResults.totalSize && (
        <p className="slds-text-align_center slds-m-vertical_x-small slds-text-heading_small">No Results</p>
      )}
      {!!usersResults?.totalSize && (
        <List
          css={css`
            max-height: 50vh;
            overflow-y: auto;
          `}
          items={usersResults.records}
          isActive={(item: User) => item.Id === searchTerm}
          // eslint-disable-next-line @typescript-eslint/no-empty-function
          onSelected={(key: string) => {}}
          getContent={(user: User) => ({
            key: user.Id,
            id: user.Id,
            heading: getListItemContent(sfHost, { user }),
            children: (
              <Grid vertical>
                <GridCol>
                  <a href={getOpenInJetstreamLink(sfHost, user.Id)} className="slds-button" onClick={handleLinkClick}>
                    Open in Jetstream
                  </a>
                </GridCol>
                {org && (
                  <GridCol>
                    <a href={getLoginAsLink(sfHost, org, user.Id)} className="slds-button" onClick={handleLinkClick}>
                      Attempt Login As User
                    </a>
                  </GridCol>
                )}
              </Grid>
            ),
          })}
          searchTerm={searchTerm}
        />
      )}
    </>
  );
}

// For some reason, links were not doing anything when clicked
function handleLinkClick(event: React.MouseEvent<HTMLAnchorElement, MouseEvent>) {
  event.preventDefault();
  window.open(event.currentTarget.href, '_blank');
}

function getOpenInJetstreamLink(sfHost: string, recordId: string) {
  return `${browser.runtime.getURL('app.html')}?host=${sfHost}&action=VIEW_RECORD&actionValue=${recordId}`;
}

function getSalesforceUserLink(sfHost: string, recordId: string) {
  return `https://${sfHost}/lightning/setup/ManageUsers/page?${new URLSearchParams({
    address: `/${recordId}?noredirect=1`,
  }).toString()}`;
}

function getSalesforceProfileLink(sfHost: string, recordId: string) {
  return `https://${sfHost}/lightning/setup/EnhancedProfiles/page?${new URLSearchParams({
    address: `/${recordId}?noredirect=1`,
  }).toString()}`;
}

function getLoginAsLink(sfHost: string, { org }: OrgAndSessionInfo, recordId: string) {
  return `https://${sfHost}/servlet/servlet.su?${new URLSearchParams({
    oid: org.organizationId,
    suorgadminid: recordId,
    retURL: window.location.pathname,
    targetURL: window.location.pathname,
  }).toString()}`;
}

function getListItemContent(sfHost: string, { user }: { user: User }) {
  const { Alias, Email, Id, IsActive, Name, Profile, Username, UserType, UserRole } = user;
  return (
    <div>
      <strong className="text-bold">
        {Name} ({Alias})
      </strong>
      <p>
        <strong title={Email}>Email:</strong> <CopyToClipboard content={Email} />
        {Email}
      </p>
      <p>
        <strong title={Username}>Username:</strong> <CopyToClipboard content={Username} />
        <a href={getSalesforceUserLink(sfHost, Id)} onClick={handleLinkClick} title="Open user in Salesforce">
          {Username}
        </a>
      </p>
      {Profile?.Name && (
        <p>
          <strong>Profile: </strong>
          <a href={getSalesforceProfileLink(sfHost, Profile.Id)} onClick={handleLinkClick} title="Open profile in Salesforce">
            {Profile.Name}
          </a>
        </p>
      )}
      {UserRole?.Name && (
        <p>
          <strong>Role: </strong>
          {UserRole.Name}
        </p>
      )}
      {!IsActive && <p className="slds-text-color_destructive">Inactive</p>}
      <p className="slds-text-body_small slds-text-color_weak slds-truncate">
        <CopyToClipboard content={Id} />
        {Id}
      </p>
      {UserType !== 'Standard' && <p>{UserType}</p>}
    </div>
  );
}
