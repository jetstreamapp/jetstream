import { GoogleApiClientConfig, useGoogleApi } from '@jetstream/shared/ui-utils';
import classNames from 'classnames';
import { FunctionComponent, ReactNode, useEffect, useState } from 'react';
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
  children?: ReactNode;
}

export const GoogleSignIn: FunctionComponent<GoogleSignInProps> = ({
  apiConfig,
  className,
  disabled,
  children,
  onError,
  onSignInChanged,
}) => {
  const { getToken, error, loading, isTokenValid } = useGoogleApi(apiConfig);
  const [isLoginValid, setIsLoginValid] = useState(isTokenValid());

  useEffect(() => {
    if (error) {
      onError && onError(error);
    }
  }, [error, onError]);

  useEffect(() => {
    onSignInChanged && onSignInChanged(isTokenValid());
  }, [isTokenValid, onSignInChanged]);

  async function handleSignIn() {
    try {
      await getToken();
      setIsLoginValid(true);
      onSignInChanged && onSignInChanged(true);
    } catch (ex) {
      onSignInChanged && onSignInChanged(false);
    }
  }

  return (
    <div className={className}>
      {!isLoginValid && (
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
      {isLoginValid && children}
    </div>
  );
};

export default GoogleSignIn;
