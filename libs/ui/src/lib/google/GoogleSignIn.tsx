/** @jsx jsx */
import { jsx } from '@emotion/react';
import { GoogleApiClientConfig, GoogleApiData, useLoadGoogleApi } from '@jetstream/shared/ui-utils';
import Avatar from '@salesforce-ux/design-system/assets/images/profile_avatar_96.png';
import Grid from '../grid/Grid';
import { FunctionComponent, useEffect, useState } from 'react';
import Icon from '../widgets/Icon';
import Tooltip from '../widgets/Tooltip';
import classNames from 'classnames';

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
  onSignInChanged?: (apiData: GoogleApiData, profile?: GoogleProfile) => void;
}

/**
 * Shows a sign in button and only if signed in renders children
 * Shows signed in avatar and option to sign out
 * TODO: auto-sign in if token is still valid
 * TODO: maybe try to refresh sign in?
 * TODO: login hint and a bunch of stuff etc..
 */
export const GoogleSignIn: FunctionComponent<GoogleSignInProps> = ({
  apiConfig,
  className,
  disabled,
  children,
  onError,
  onSignInChanged,
}) => {
  const [profile, setProfile] = useState<GoogleProfile>(null);
  const [apiData, signIn, signOut] = useLoadGoogleApi(apiConfig);

  useEffect(() => {
    if (apiData.signedIn && apiData.authorized && apiData.gapiAuthInstance.currentUser) {
      const profile: GoogleProfile = {
        name: apiData.gapiAuthInstance.currentUser.get().getBasicProfile().getName(),
        email: apiData.gapiAuthInstance.currentUser.get().getBasicProfile().getEmail(),
        imageUrl: apiData.gapiAuthInstance.currentUser.get().getBasicProfile().getImageUrl(),
      };
      setProfile(profile);
      onSignInChanged && onSignInChanged(apiData, profile);
    }
  }, [apiData.signedIn, apiData.authorized]);

  useEffect(() => {
    if (profile && (!apiData.signedIn || !apiData.authorized)) {
      setProfile(null);
      onSignInChanged && onSignInChanged(apiData);
    }
  }, [apiData.signedIn, apiData.authorized, profile]);

  useEffect(() => {
    if (apiData.error && onError) {
      onError(apiData.error);
    }
  }, [apiData.error, onError]);

  function handleSignIn() {
    // TODO: login hint?
    // TODO: can we store data in localstorage if already signed in? (or can useLoadGoogleApi handle this part?)
    // TODO: how do we detect when expired? and how do we handle?
    signIn();
  }

  function handleSignOut() {
    signOut();
  }

  return (
    <div className={className}>
      {!profile && (
        <div className={classNames('slds-form-element', { 'slds-has-error': !!apiData.error }, className)}>
          <span className="slds-form-element__label">Google Drive</span>
          <div className="slds-form-element__control">
            <button
              className="slds-is-relative slds-button slds-button_neutral"
              onClick={handleSignIn}
              disabled={disabled || !apiData.hasApisLoaded || !apiData.gapiAuthInstance}
            >
              <Icon type="doctype" icon="gdrive" className="slds-button__icon slds-button__icon_left" omitContainer />
              Sign In
            </button>
          </div>
          {apiData.error && (
            <div className="slds-form-element__help slds-truncate" id="file-input-error">
              {apiData.error}
            </div>
          )}
        </div>
      )}
      {profile && (
        <Grid verticalAlign="center" wrap>
          <div className="slds-m-right_x-small">
            <Tooltip id={`sobject-list-refresh-tooltip`} content={`Logged in as ${profile.email}, Click to sign out.`}>
              <button className="slds-button" onClick={handleSignOut} disabled={disabled}>
                <span className="slds-avatar slds-avatar_circle slds-avatar_medium">
                  <img alt="Avatar" src={profile.imageUrl || Avatar} />
                </span>
              </button>
            </Tooltip>
          </div>
          {children}
        </Grid>
      )}
    </div>
  );
};

export default GoogleSignIn;
