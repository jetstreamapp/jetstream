/* eslint-disable no-restricted-globals */
import { Connection } from 'jsforce';
import { useEffect } from 'react';
import * as ReactDOM from 'react-dom/client';
import { getSession } from './utils';

const root = ReactDOM.createRoot(document.getElementById('root') as HTMLElement);
root.render(<App />);

export function App() {
  useEffect(() => {
    console.log('INIT');
    // if (document.querySelector('body.sfdcBody, body.ApexCSIPage, #auraLoadingBox') || location.host.endsWith('visualforce.com')) {
    //   // We are in a Salesforce org
    //   chrome.runtime.sendMessage({ message: 'getSfHost', url: location.href }, (sfHost) => {
    //     console.log('sfHost', sfHost);
    //     getSession(sfHost).then((session) => {
    //       console.log('session', session);
    //     });
    //   });
    // }
  }, []);

  function handleClick() {
    console.log('click');

    chrome.tabs.query({ active: true, lastFocusedWindow: true }, (tabs) => {
      console.log('tabs', tabs);
      const url = tabs?.[0]?.url;
      console.log('url', url);
      if (url) {
        getSession(new URL(url).host).then(async (session) => {
          console.log('session', session);
          // split by `!` to get the org id
          if (session) {
            const conn = new Connection({
              instanceUrl: `https://${session.hostname}`,
              accessToken: session.key,
            });
            console.log(conn);

            const results = await conn.identity();
            console.log(results);
          }
        });
      }
      // use `url` here inside the callback because it's asynchronous!
      // chrome.runtime.sendMessage({ message: 'getSfHost', url }, (sfHost) => {
      //   console.log('sfHost', sfHost);
      //   getSession(sfHost).then((session) => {
      //     console.log('session', session);
      //   });
      // });
    });
  }

  return (
    <>
      <h1>
        <span> Hello there, POPUP </span>
        Welcome jetstream-web-extension 👋
      </h1>
      <button onClick={handleClick}>click me</button>
    </>
  );
}

export default App;
