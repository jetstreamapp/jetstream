/* eslint-disable no-restricted-globals */
import { css } from '@emotion/react';
import { JetstreamIcon, JetstreamLogo } from '@jetstream/core/ui';
import { Maybe } from '@jetstream/types';
import { Grid, GridCol, Icon } from '@jetstream/ui';
import { useEffect, useState } from 'react';
import { sendMessage } from '../utils';

export function Button() {
  const [isOnSalesforcePage] = useState(
    () => !!document.querySelector('body.sfdcBody, body.ApexCSIPage, #auraLoadingBox') || location.host.endsWith('visualforce.com')
  );
  /**
   * TODO: Should we make the user sign in instead of using cookies?
   * increases friction, but more secure
   */
  const [sfHost, setSfHost] = useState<Maybe<string>>(null);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    if (isOnSalesforcePage) {
      sendMessage({
        message: 'GET_SF_HOST',
        data: { url: location.href },
      })
        .then((salesforceHost) => {
          setSfHost(salesforceHost);
        })
        .catch((err) => {
          console.log(err);
        });
    }
  }, [isOnSalesforcePage]);

  // async function handleClick() {
  //   console.log('click');

  //   if (sfHost) {
  //     getSession(sfHost).then(async (session) => {
  //       console.log('session', session);
  //       // split by `!` to get the org id
  //       if (session) {
  //         const conn = new Connection({
  //           instanceUrl: `https://${session.hostname}`,
  //           accessToken: session.key,
  //         });
  //         console.log(conn);
  //         const results = await conn.identity();
  //         console.log(results);
  //       }
  //     });
  //   }
  // }

  if (!isOnSalesforcePage || !sfHost) {
    return null;
  }

  return (
    <>
      <button
        css={css`
        z-index: 1000;
        display: block;
        position: fixed;
        vertical-align: middle;
        pointer: cursor;
        top: 160px;
        right: ${isOpen ? '0px;' : '-5px;'};
        opacity: ${isOpen ? '1;' : '0.25;'};
        width: 25px;
        transition: transform 0.3s ease;
        transform: ${isOpen ? 'scale(1.5);' : 'scale(1);'}
        transform-origin: top right;

        background: none;
        border: none;
        padding: 0;
        margin: 0;
        cursor: pointer;
        outline: none;
        text-align: center;

        &:hover {
          opacity: 1;
          right: 0px;
          transform: scale(1.5);
        }
      `}
        onClick={() => setIsOpen(true)}
      >
        {/* href={`${chrome.runtime.getURL('app.html')}?host=${sfHost}`} */}
        <JetstreamIcon />
      </button>
      {isOpen && (
        <section
          css={css`
            z-index: 1000;
            display: block;
            position: fixed;
            top: 160px;
            right: 0;
            width: 250px;
          `}
          className="slds-popover"
        >
          <button
            className="slds-button slds-button_icon slds-button_icon-small slds-float_right slds-popover__close"
            title="Close dialog"
            onClick={() => setIsOpen(false)}
          >
            <Icon type="utility" icon="close" className="slds-button__icon" omitContainer />
            <span className="slds-assistive-text">Close dialog</span>
          </button>
          <header className="slds-p-horizontal_x-small slds-grid">
            <JetstreamLogo />
          </header>
          <div className="slds-popover__body slds-p-around_small slds-is-relative">
            <Grid vertical gutters>
              <GridCol>
                <a
                  href={`${chrome.runtime.getURL('app.html')}?host=${sfHost}&page=query`}
                  className="slds-button slds-button_neutral slds-button_stretch"
                  target="_blank"
                  rel="noreferrer"
                >
                  View Current Record
                </a>
              </GridCol>
              <GridCol>
                <a
                  href={`${chrome.runtime.getURL('app.html')}?host=${sfHost}&page=view-record&recordId=123TODO`}
                  className="slds-button slds-button_neutral slds-button_stretch"
                  target="_blank"
                  rel="noreferrer"
                >
                  Query Builder
                </a>
              </GridCol>
            </Grid>
          </div>
        </section>
      )}
    </>
  );
}

export default Button;
