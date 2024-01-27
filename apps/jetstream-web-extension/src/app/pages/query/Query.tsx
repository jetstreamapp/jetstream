/* eslint-disable no-restricted-globals */
import { css } from '@emotion/react';
import { Connection } from 'jsforce';
import { getSession } from '../../utils';

const args = new URLSearchParams(location.search.slice(1));
const salesforceHostWithApiAccess = args.get('host');

export function Query() {
  // const [isOnSalesforcePage] = useState(
  //   () => !!document.querySelector('body.sfdcBody, body.ApexCSIPage, #auraLoadingBox') || location.host.endsWith('visualforce.com')
  // );
  // /**
  //  * TODO: Should we make the user sign in instead of using cookies?
  //  * increases friction, but more secure
  //  */
  // const [sfHost, setsfHost] = useState<Maybe<string>>(null);

  // useEffect(() => {
  //   if (isOnSalesforcePage) {
  //     getHost(location.href).then((salesforceHost) => {
  //       setsfHost(salesforceHost);
  //     });
  //   }
  // }, [isOnSalesforcePage]);

  async function handleClick() {
    console.log('click');

    if (salesforceHostWithApiAccess) {
      getSession(salesforceHostWithApiAccess).then(async (session) => {
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
  }

  if (!salesforceHostWithApiAccess) {
    console.log('no host parameter');
    return null;
  }

  return (
    <div
      // css={css`
      //   position: fixed;
      //   top: 0;
      //   left: 0;
      //   right: 0;
      //   bottom: 0;
      //   background: rgba(0, 0, 0, 0.5);
      //   z-index: 10000;
      //   display: flex;
      //   justify-content: center;
      //   align-items: center;
      //   color: white;
      //   font-size: 20px;
      // `}
      css={css`
        z-index: 1000;
        display: block;
        position: fixed;
        top: 160px;
        right: 0px;
        vertical-align: middle;
      `}
    >
      <div
        css={css`
          box-sizing: border-box;
          width: 15px;
          height: 33px;
          background-color: rgb(34, 107, 134);
          border-top-left-radius: 5px;
          border-bottom-left-radius: 5px;
          box-shadow: rgb(160, 166, 171) -2px 0px 2px;
          opacity: 0.4;
          padding: 3px 1px 2px 0px;
          border-width: 4px;
          border-style: solid none solid solid;
          border-color: rgb(255, 255, 255);
        `}
        onClick={handleClick}
      >
        click me
      </div>
    </div>
  );
}

export default Query;
