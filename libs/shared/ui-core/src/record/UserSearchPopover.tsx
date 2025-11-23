import { css } from '@emotion/react';
import { logger } from '@jetstream/shared/client-logger';
import { ANALYTICS_KEYS } from '@jetstream/shared/constants';
import { query } from '@jetstream/shared/data';
import { appActionObservable, hasModifierKey, isUKey, useDebounce, useGlobalEventHandler } from '@jetstream/shared/ui-utils';
import { QueryResults } from '@jetstream/types';
import {
  CopyToClipboard,
  getModifierKey,
  Grid,
  Icon,
  KeyboardShortcut,
  List,
  Popover,
  PopoverRef,
  SalesforceLogin,
  ScopedNotification,
  SearchInput,
} from '@jetstream/ui';
import { applicationCookieState, selectedOrgState, selectSkipFrontdoorAuth } from '@jetstream/ui/app-state';
import { useAtom, useAtomValue } from 'jotai';
import { Fragment, FunctionComponent, useCallback, useEffect, useRef, useState } from 'react';
import { useAmplitude } from '../analytics';
import { getSearchUserSoql } from './record-utils';

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

export const UserSearchPopover: FunctionComponent = () => {
  const currentSearchRef = useRef<number>(0);
  const popoverRef = useRef<PopoverRef>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [{ serverUrl }] = useAtom(applicationCookieState);
  const skipFrontDoorAuth = useAtomValue(selectSkipFrontdoorAuth);
  const selectedOrg = useAtomValue(selectedOrgState);
  const { trackEvent } = useAmplitude();

  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [usersResults, setUsersResults] = useState<QueryResults<User>>();

  const [searchTerm, setSearchTerm] = useState<string>('');
  const searchTermDebounced = useDebounce(searchTerm, 500);

  useEffect(() => {
    if (!isOpen) {
      return;
    }
    setLoading(true);
    const currentSearchValue = currentSearchRef.current;
    trackEvent(ANALYTICS_KEYS.user_search_did_search);
    query<User>(selectedOrg, getSearchUserSoql(searchTermDebounced))
      .then((users) => {
        if (currentSearchRef.current === currentSearchValue) {
          setUsersResults(users);
          setLoading(false);
        }
      })
      .catch((ex) => {
        setErrorMessage('An error occurred while fetching users');
        logger.warn('[ERROR] Could not fetch users', ex);
      });
    return () => {
      currentSearchRef.current = currentSearchRef.current + 1;
    };
  }, [isOpen, searchTermDebounced, selectedOrg, trackEvent]);

  const onKeydown = useCallback((event: KeyboardEvent) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if (hasModifierKey(event as any) && isUKey(event as any)) {
      event.stopPropagation();
      event.preventDefault();
      popoverRef.current?.open();
    }
  }, []);

  function handleViewRecord(user: User) {
    if (user) {
      appActionObservable.next({ action: 'VIEW_RECORD', payload: { recordId: user.Id } });
      trackEvent(ANALYTICS_KEYS.query_RecordAction, { action: 'view', source: 'USER_SEARCH' });
    }
  }

  useGlobalEventHandler('keydown', onKeydown);

  if (!selectedOrg?.uniqueId || !!selectedOrg.connectionError) {
    return null;
  }

  return (
    <Popover
      ref={popoverRef}
      size="large"
      onChange={(isOpen) => {
        setIsOpen(isOpen);
        isOpen && trackEvent(ANALYTICS_KEYS.user_search_opened);
      }}
      header={
        <header className="slds-popover__header slds-grid">
          <h2 className="slds-text-heading_small">Search Users</h2>
          <KeyboardShortcut className="slds-m-left_x-small" keys={[getModifierKey(), 'u']} />
        </header>
      }
      content={
        <div className="slds-popover__body slds-p-around_none slds-is-relative">
          {errorMessage && (
            <div className="slds-m-around-medium">
              <ScopedNotification theme="error" className="slds-m-top_medium">
                {errorMessage}
              </ScopedNotification>
            </div>
          )}
          <Grid verticalAlign="end">
            <SearchInput
              id="user-search"
              className="w-100"
              placeholder="Id, Name, Email, or Username"
              autoFocus
              loading={loading}
              value={searchTerm}
              onChange={(value) => setSearchTerm(value.trim())}
            />
          </Grid>
          {!!usersResults && !usersResults?.queryResults.records?.length && (
            <p className="slds-text-align_center slds-m-vertical_x-small slds-text-heading_small">No Results</p>
          )}
          {!!usersResults?.queryResults.records?.length && (
            <Fragment>
              <h2 className="slds-text-heading_small slds-m-top_small" title="Users">
                Users
              </h2>
              <List
                css={css`
                  max-height: 75vh;
                  overflow-y: auto;
                `}
                items={usersResults.queryResults.records}
                isActive={(item: User) => item.Id === searchTerm}
                onSelected={(key: string) => {
                  const user = usersResults?.queryResults.records.find(({ Id }) => Id === key);
                  if (user) {
                    handleViewRecord(user);
                  }
                }}
                getContent={(user: User) => ({
                  key: user.Id,
                  id: user.Id,
                  heading: getListItemContent({ user, onCopy: (type) => trackEvent(ANALYTICS_KEYS.user_search_copy_item, { type }) }),
                  children: (
                    <Grid align="spread">
                      <SalesforceLogin
                        serverUrl={serverUrl}
                        skipFrontDoorAuth={skipFrontDoorAuth}
                        className="slds-button"
                        org={selectedOrg}
                        returnUrl={`/lightning/setup/ManageUsers/page?address=${encodeURIComponent(`/${user.Id}?noredirect=1`)}`}
                        title="View user in Salesforce"
                        onClick={(event, url) => event.stopPropagation()}
                      >
                        View in Salesforce
                      </SalesforceLogin>
                    </Grid>
                  ),
                })}
                searchTerm={searchTerm}
              />
            </Fragment>
          )}
        </div>
      }
      buttonProps={{
        className:
          'slds-button slds-button_icon slds-button_icon-container slds-button_icon-small slds-global-actions__help slds-global-actions__item-action cursor-pointer',
        title: 'View Record Details - ctrl/command + k',
        disabled: !selectedOrg || !!selectedOrg.connectionError,
      }}
    >
      <Icon type="utility" icon="people" className="slds-button__icon slds-global-header__icon" omitContainer />
    </Popover>
  );
};

function getListItemContent({ user, onCopy }: { user: User; onCopy: (type: string) => void }) {
  const { Alias, Email, Id, IsActive, Name, Profile, Username, UserType, UserRole } = user;
  return (
    <div>
      <p className="text-bold">
        {Name} ({Alias})
      </p>
      <p>
        <span className="text-bold" title={Email}>
          Email:
        </span>{' '}
        <CopyToClipboard content={Email} copied={() => onCopy('email')} />
        {Email}
      </p>
      <p>
        <span className="text-bold" title={Username}>
          Username:
        </span>{' '}
        <CopyToClipboard content={Username} copied={() => onCopy('username')} />
        {Username}
      </p>
      {Profile?.Name && (
        <p>
          <span className="text-bold">Profile: </span>
          {Profile.Name}
        </p>
      )}
      {UserRole?.Name && (
        <p>
          <span className="text-bold">Role: </span>
          {UserRole.Name}
        </p>
      )}
      {!IsActive && <p className="slds-text-color_destructive">Inactive</p>}
      <p className="slds-text-body_small slds-text-color_weak slds-truncate">
        <CopyToClipboard content={Id} copied={() => onCopy('id')} />
        {Id}
      </p>
      {UserType !== 'Standard' && <p>{UserType}</p>}
    </div>
  );
}
