import { GoogleApiClientConfig, useGoogleApi } from '@jetstream/shared/ui-utils';
import { GoogleUserInfo, Maybe } from '@jetstream/types';
import classNames from 'classnames';
import { FunctionComponent, ReactNode, useEffect } from 'react';
import Grid from '../grid/Grid';
import Icon from '../widgets/Icon';

export interface GoogleProfile {
  name: string;
  email: string;
  imageUrl: string;
}

export interface GoogleSignInProps {
  apiConfig: GoogleApiClientConfig;
  className?: string;
  disabled?: boolean;
  onError?: (error: string) => void;
  onSignInChanged?: (signedIn: boolean) => void;
  onUserInfoChange?: (userInfo: Maybe<GoogleUserInfo>) => void;
  children?: ReactNode;
}

export const GoogleSignIn: FunctionComponent<GoogleSignInProps> = ({
  apiConfig,
  className,
  disabled,
  children,
  onError,
  onSignInChanged,
  onUserInfoChange,
}) => {
  const { getToken, error, loading, userInfo, isTokenValid, revokeToken } = useGoogleApi(apiConfig);

  useEffect(() => {
    if (error) {
      onError && onError(error);
    }
  }, [error, onError]);

  useEffect(() => {
    onSignInChanged && onSignInChanged(isTokenValid());
  }, [isTokenValid, onSignInChanged]);

  useEffect(() => {
    onUserInfoChange && onUserInfoChange(userInfo);
  }, [userInfo, onUserInfoChange]);

  async function handleSignIn() {
    try {
      await getToken();
      onSignInChanged && onSignInChanged(true);
    } catch {
      onSignInChanged && onSignInChanged(false);
    }
  }

  return (
    <div className={className}>
      {!isTokenValid() && (
        <div className={classNames('slds-form-element', { 'slds-has-error': !!error }, className)}>
          <span className="slds-form-element__label">Google Drive</span>
          <div className="slds-form-element__control">
            <button className="slds-is-relative slds-button slds-button_neutral" onClick={handleSignIn} disabled={disabled || loading}>
              <Icon type="doctype" icon="gdrive" className="slds-button__icon slds-button__icon_left" omitContainer />
              Authorize Google Drive
            </button>
          </div>
          {error && (
            <div className="slds-form-element__help slds-truncate" id="file-input-error">
              {error}
            </div>
          )}
        </div>
      )}
      {isTokenValid() && (
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
              <button type="button" className="slds-button slds-m-left_small" onClick={revokeToken}>
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

export default GoogleSignIn;
