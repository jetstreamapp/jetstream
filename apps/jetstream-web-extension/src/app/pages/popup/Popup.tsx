/* eslint-disable no-restricted-globals */
import { createRoot } from 'react-dom/client';

const container = document.getElementById('app-container');
const root = createRoot(container!);
root.render(<Component />);

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
    <>
      <h1>
        <span> Hello there, POPUP </span>
        Welcome jetstream-web-extension 👋
      </h1>
      <button onClick={handleClick}>click me</button>
    </>
  );
}