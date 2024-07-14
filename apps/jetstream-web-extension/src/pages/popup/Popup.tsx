/* eslint-disable no-restricted-globals */
import { JetstreamLogoInverse } from '@jetstream/ui-core';
import { initAndRenderReact } from '@jetstream/web-extension-utils';
import { AppWrapperNotJetstreamOwnedPage } from '../../core/AppWrapperNotJetstreamOwnedPage';

initAndRenderReact(<Component />);

export function Component() {
  function handleClick() {
    console.log('click');

    // chrome.tabs.query({ active: true, lastFocusedWindow: true }, (tabs) => {
    //   console.log('tabs', tabs);
    //   const url = tabs?.[0]?.url;
    //   console.log('url', url);
    //   if (url) {
    //     sendMessage({ message: 'GET_SESSION', data: { salesforceHost: new URL(url).host } }).then(async (session) => {
    //       console.log('session', session);
    //       // split by `!` to get the org id
    //       // if (session) {
    //       //   const result = await apiGetRest({
    //       //     method: 'GET',
    //       //     session,
    //       //     url: '/services/data',
    //       //   });
    //       //   console.log(result);
    //       //   // const conn = new Connection({
    //       //   //   instanceUrl: `https://${session.hostname}`,
    //       //   //   accessToken: session.key,
    //       //   // });
    //       //   // console.log(conn);
    //       //   // const results = await conn.identity();
    //       //   // console.log(results);
    //       // }
    //     });
    //   }
    // });
  }

  return (
    <AppWrapperNotJetstreamOwnedPage>
      <JetstreamLogoInverse className="slds-p-around_x-small" width="200px" />
      <button onClick={handleClick}>click me</button>
    </AppWrapperNotJetstreamOwnedPage>
  );
}
