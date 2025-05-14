import { css } from '@emotion/react';
import { UserProfileUiDesktop } from '@jetstream/desktop/types';
import { logger } from '@jetstream/shared/client-logger';
import { ANALYTICS_KEYS, TITLES } from '@jetstream/shared/constants';
import { updateUserProfile } from '@jetstream/shared/data';
import { isEscapeKey, useGlobalEventHandler, useTitle } from '@jetstream/shared/ui-utils';
import { SalesforceOrgUi } from '@jetstream/types';
import { AutoFullHeightContainer, CheckboxToggle, Grid, Icon, Page, Spinner, fireToast } from '@jetstream/ui';
import { useAmplitude } from '@jetstream/ui-core';
import { fromAppState } from '@jetstream/ui/app-state';
import { dexieDataSync, recentHistoryItemsDb } from '@jetstream/ui/db';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useRecoilState, useRecoilValue } from 'recoil';
import LoggerConfig from './LoggerConfig';

const HEIGHT_BUFFER = 170;

type ModifiedUser = Pick<UserProfileUiDesktop, 'preferences'>;

export const Settings = () => {
  useTitle(TITLES.SETTINGS);
  const isMounted = useRef(true);
  const { trackEvent } = useAmplitude();
  const navigate = useNavigate();
  const [userProfile, setUserProfile] = useRecoilState(fromAppState.userProfileState);
  const [modifiedUser, setModifiedUser] = useState<ModifiedUser>(() => ({ preferences: { ...userProfile.preferences } }));
  const selectedOrg = useRecoilValue<SalesforceOrgUi>(fromAppState.selectedOrgState);

  const [resetSyncLoading, setResetSyncLoading] = useState(false);
  const [recentRecentItemLoading, setRecentRecentItemLoading] = useState<false | 'all' | 'current'>(false);

  // TODO: Give option to disable
  const recordSyncEnabled = useRecoilValue(fromAppState.userProfileEntitlementState('recordSync'));

  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);

  const onKeydown = useCallback(
    (event: KeyboardEvent) => {
      if (isEscapeKey(event as any)) {
        event.stopPropagation();
        event.preventDefault();
        navigate(-1);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  useGlobalEventHandler('keydown', onKeydown);

  useEffect(() => {
    if (userProfile) {
      setModifiedUser({ preferences: { ...userProfile.preferences } });
    }
  }, [userProfile]);

  async function handleSave(_modifiedUser?: ModifiedUser) {
    try {
      _modifiedUser = _modifiedUser || modifiedUser;
      if (!_modifiedUser) {
        return;
      }
      const userProfile = await updateUserProfile<UserProfileUiDesktop>(_modifiedUser);
      setUserProfile(userProfile);
      trackEvent(ANALYTICS_KEYS.settings_update_user);
    } catch (ex) {
      logger.warn('Error updating user', ex);
      fireToast({
        message: 'There was a problem updating your user. Try again or file a support ticket for assistance.',
        type: 'error',
      });
    }
  }

  function handleFrontdoorLoginChange(skipFrontdoorLogin: boolean) {
    const _modifiedUser = { preferences: { ...userProfile.preferences, skipFrontdoorLogin } } as ModifiedUser;
    setModifiedUser(_modifiedUser);
    handleSave(_modifiedUser);
  }

  function handleRecordSyncChange(recordSyncEnabled: boolean) {
    const _modifiedUser = { preferences: { ...userProfile.preferences, recordSyncEnabled } } as ModifiedUser;
    setModifiedUser(_modifiedUser);
    handleSave(_modifiedUser);
  }

  async function resetSync() {
    try {
      setResetSyncLoading(true);
      await dexieDataSync.reset(recordSyncEnabled);
    } catch (ex) {
      logger.error('[DB] Error resetting sync', ex);
    } finally {
      setResetSyncLoading(false);
      fireToast({
        message: 'Sync reset successfully',
        type: 'success',
      });
    }
  }

  async function resetRecentHistoryItems(type: 'all' | 'current') {
    try {
      setRecentRecentItemLoading(type);
      if (type === 'current' && selectedOrg) {
        await recentHistoryItemsDb.clearRecentHistoryItemsForCurrentOrg(selectedOrg.uniqueId);
      } else if (type === 'all') {
        await recentHistoryItemsDb.clearRecentHistoryItemsForAllOrgs();
      }
      fireToast({
        message: 'History reset successfully',
        type: 'success',
      });
    } catch (ex) {
      logger.error('[DB] Error resetting sync', ex);
      fireToast({
        message: 'There was a problem resetting your history. Try again or file a support ticket for assistance.',
        type: 'warning',
      });
    } finally {
      setRecentRecentItemLoading(false);
    }
  }

  // TODO: animate in and out like discord
  return (
    <div
      css={css`
        position: fixed;
        width: 100%;
        top: 0;
        left: 0;
        z-index: 101;
      `}
    >
      <div
        css={css`
          min-height: 50px;
          width: 100%;
          background-color: white;
          app-region: drag;
        `}
      >
        {/* Close button */}
        <Grid align="end" verticalAlign="center">
          <button
            css={css`
              app-region: no-drag;
              margin-top: 17px;
              margin-right: 15px;
            `}
            className="slds-button slds-button_icon slds-modal__close"
            title="Close"
            disabled={false}
            onClick={() => navigate(-1)}
          >
            <Icon type="utility" icon="close" className="slds-button__icon slds-button__icon_large" omitContainer />
            <span className="slds-assistive-text">Close</span>
          </button>
        </Grid>
      </div>
      <Page testId="settings-page">
        <AutoFullHeightContainer className="slds-p-horizontal_x-small slds-scrollable_none" bufferIfNotRendered={HEIGHT_BUFFER}>
          {/* Settings */}
          <div className="slds-m-top_medium">
            <h2 className="slds-text-heading_medium slds-m-vertical_small">General Settings</h2>
            <CheckboxToggle
              id="frontdoor-toggle"
              checked={modifiedUser?.preferences?.skipFrontdoorLogin ?? false}
              label="Don't Auto-Login on Link Clicks"
              labelHelp="When enabled, Jetstream will not attempt to auto-login to Salesforce when you click a link in Jetstream. If you have issues with multi-factor authentication when clicking links, enable this."
              onChange={handleFrontdoorLoginChange}
            />

            {recordSyncEnabled && (
              <div className="slds-m-top_large">
                <h2 className="slds-text-heading_medium slds-m-vertical_small">History Data Sync</h2>
                <CheckboxToggle
                  id="enable-record-sync-button"
                  checked={modifiedUser?.preferences?.recordSyncEnabled ?? false}
                  label="Data Sync"
                  labelHelp="Enable to sync Query History with the Jetstream server."
                  onChange={handleRecordSyncChange}
                />
                <button className="slds-button slds-button_text-destructive slds-m-top_small slds-is-relative" onClick={resetSync}>
                  {resetSyncLoading && <Spinner className="slds-spinner slds-spinner_small" />}
                  Reset Sync
                </button>
                <p className=" slds-m-top_small">
                  You can reset your sync history, this will push and pull Query History data from the Jetstream server to make sure both
                  are in sync.
                </p>
              </div>
            )}

            <div className="slds-m-top_large">
              <h2 className="slds-text-heading_medium slds-m-top_x-small">Recent Objects</h2>
              <button
                className="slds-button slds-button_text-destructive slds-m-top_small slds-is-relative"
                disabled={!selectedOrg}
                onClick={() => resetRecentHistoryItems('current')}
              >
                {recentRecentItemLoading === 'current' && <Spinner className="slds-spinner slds-spinner_small" />}
                Reset for Current Org
              </button>
              <button
                className="slds-button slds-button_text-destructive slds-m-top_small slds-is-relative"
                onClick={() => resetRecentHistoryItems('all')}
              >
                {recentRecentItemLoading === 'all' && <Spinner className="slds-spinner slds-spinner_small" />}
                Reset for All Orgs
              </button>
              <p className=" slds-m-top_small">
                Reset your list of recent objects. This will clear the list of objects you have recently viewed in Jetstream.
              </p>
            </div>

            <div className="slds-m-top_large">
              <h2 className="slds-text-heading_medium slds-m-vertical_small">Logging</h2>
              <LoggerConfig />
            </div>
          </div>
        </AutoFullHeightContainer>
      </Page>
    </div>
  );
};

export default Settings;
