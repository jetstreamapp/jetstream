import { useDriveExternalPicker } from '@jetstream/shared/ui-utils';
import { GoogleUserInfo, Maybe } from '@jetstream/types';
import { applicationCookieState } from '@jetstream/ui/app-state';
import classNames from 'classnames';
import { useAtomValue } from 'jotai';
import { FunctionComponent, ReactNode, useEffect } from 'react';
import Grid from '../grid/Grid';
import Icon from '../widgets/Icon';
import Spinner from '../widgets/Spinner';

export interface GoogleProfile {
  name: string;
  email: string;
  imageUrl: string;
}

export interface GoogleSignInExternalProps {
  className?: string;
  disabled?: boolean;
  onError?: (error: string) => void;
  onSignInChanged?: (signedIn: boolean) => void;
  onUserInfoChange?: (userInfo: Maybe<GoogleUserInfo>) => void;
  children?: ReactNode;
}

/**
 * Wrapper component to handle signing in to Google Drive via the external picker flow
 * (desktop app via Electron IPC, browser extension via popup window).
 */
export const GoogleSignInExternal: FunctionComponent<GoogleSignInExternalProps> = ({
  className,
  disabled,
  children,
  onError,
  onSignInChanged,
  onUserInfoChange,
}) => {
  const { serverUrl } = useAtomValue(applicationCookieState);
  const { openPicker, signOut, isAuthorized, userInfo, loading, error } = useDriveExternalPicker(serverUrl);

  useEffect(() => {
    if (error) {
      onError && onError(error);
    }
  }, [error, onError]);

  useEffect(() => {
    onUserInfoChange?.(userInfo);
  }, [userInfo, onUserInfoChange]);

  // Signal sign-in state to parent
  useEffect(() => {
    onSignInChanged?.(isAuthorized);
  }, [isAuthorized, onSignInChanged]);

  return (
    <div className={className}>
      {!isAuthorized && (
        <div className={classNames('slds-m-left_x-small slds-m-top_xx-small', className)}>
          <button
            className="slds-is-relative slds-button slds-button_neutral"
            onClick={() => openPicker('auth')}
            disabled={disabled || loading}
          >
            <Icon type="doctype" icon="gdrive" className="slds-button__icon slds-button__icon_left" omitContainer />
            Authorize Google Drive
            {loading && <Spinner size="x-small" />}
          </button>
          {error && <p className="slds-text-color_error slds-m-top_xx-small">{error}</p>}
        </div>
      )}
      {isAuthorized && (
        <div>
          {userInfo && (
            <Grid verticalAlign="center">
              {userInfo?.picture && (
                <div className="slds-m-right_x-small">
                  <span className="slds-avatar slds-avatar_circle slds-avatar_medium">
                    <img alt="Google Profile" src={userInfo.picture} title="Avatar" />
                  </span>
                </div>
              )}
              <p className="slds-text-heading_small">{userInfo.name}</p>
              <button type="button" className="slds-button slds-m-left_small" onClick={signOut}>
                Sign Out
              </button>
            </Grid>
          )}
          {children}
        </div>
      )}
    </div>
  );
};

export default GoogleSignInExternal;
