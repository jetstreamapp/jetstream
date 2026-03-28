import { css } from '@emotion/react';
import { Maybe } from '@jetstream/types';
import { Grid } from '@jetstream/ui';
import { JetstreamLogoInverse } from '@jetstream/ui-core';
import { useCallback } from 'react';

const Sfdc = window.Sfdc;

let windowRef: Maybe<Window>;

interface LoginProps {
  children: (props: {}) => React.ReactNode;
}

export function Login({ children }: LoginProps) {
  if (sr.client) {
    try {
      Sfdc.canvas.oauth.token(sr.client.oauthToken);
    } catch (ex) {
      console.error('Error setting oauth token for canvas client', ex);
    }
  }

  const loggedIn = Sfdc.canvas.oauth.loggedin();

  const handleWindowEvent = useCallback((event: MessageEvent) => {
    try {
      // Validate the message came from our OAuth popup window
      if (event.source !== windowRef) {
        return;
      }
      if (event.data === 'oauth:success') {
        if (windowRef) {
          windowRef.close();
          // eslint-disable-next-line react-hooks/immutability
          window.removeEventListener('message', handleWindowEvent);
        }
        Sfdc.canvas.client.repost(true);
      }
    } catch {
      // TODO: tell user there was a problem
    }
  }, []);

  function handleLogin() {
    const loginParams = window.sr.loginParams;
    if (!loginParams) {
      return;
    }
    const strWindowFeatures = 'toolbar=no, menubar=no, width=1025, height=700';
    const url = new URL(Sfdc.canvas.oauth.loginUrl());

    Object.entries(loginParams).forEach(([key, value]) => {
      url.searchParams.set(key, String(value));
    });

    window.removeEventListener('message', handleWindowEvent);
    windowRef = window.open(url, 'Salesforce Authentication', strWindowFeatures);
    window.addEventListener('message', handleWindowEvent, false);
    // Sfdc.canvas.oauth.login({
    //   uri: Sfdc.canvas.oauth.loginUrl(),
    //   params: window.sr.loginParams,
    // });
  }

  /**
   * Logged in children renderer
   */
  if (loggedIn) {
    return children({});
  }

  /**
   * Not logged in
   */
  return (
    <div
      css={css`
        height: 100vh;
        width: 100vw;
        display: flex;
        justify-content: center;
        align-items: center;
        background-color: #111827;
        app-region: drag;
      `}
    >
      <Grid
        vertical
        css={css`
          width: 500px;
        `}
      >
        <JetstreamLogoInverse className="slds-m-bottom_xx-large" />
        <p
          css={css`
            color: #9ca3af;
            text-align: center;
            font-size: 0.875rem;
            line-height: 1.5;
            margin-bottom: 1.5rem;
          `}
        >
          You need to authorize Jetstream to access your Salesforce org. Your administrator can skip this step by enabling "Admin approved
          users are pre-authorized" on the connected app.{' '}
          <a
            href="https://docs.getjetstream.app/canvas/canvas-app"
            target="_blank"
            rel="noopener noreferrer"
            css={css`
              color: #14b8a6;
              text-decoration: underline;
              :hover {
                color: #0d9488;
              }
              app-region: no-drag;
            `}
          >
            Learn more
          </a>
        </p>
        {/* TODO: window.sr.loginParams - should show error if this is not defined */}
        <button
          css={css`
            background-image: linear-gradient(to right, #14b8a6, #0891b2);
            color: rgba(255, 255, 255);
            border-color: transparent;
            text-wrap-mode: nowrap;
            :hover {
              background-image: linear-gradient(to right, #0d9488, #0e7490);
            }
            app-region: no-drag;
          `}
          className="slds-button slds-button_brand"
          onClick={handleLogin}
        >
          Authorize Salesforce
        </button>
      </Grid>
    </div>
  );
}
