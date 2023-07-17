import Head from 'next/head';
import { Fragment, useEffect, useState } from 'react';
import Footer from '../../components/Footer';
import HeaderNoNavigation from '../../components/HeaderNoNavigation';
import { parseQueryString } from '../../utils/utils';

export interface OauthLinkParams {
  type: 'auth' | 'salesforce';
  error?: string;
  message?: string;
  clientUrl: string;
  data?: string;
}

interface StatusMap {
  fallback: StatusMapItem;
  auth: StatusMapItem;
  salesforce: StatusMapItem;
}

interface StatusMapItem {
  genericError: string;
  postMessageError: string;
}

const email = 'support@getjetstream.app';

const STATUS_MAP: StatusMap = {
  fallback: {
    genericError: 'There was a problem with the request, please try again or contact support for assistance.',
    postMessageError:
      'Your request may have been processed, but there was a problem communicating with the main window. Close this window and refresh Jetstream.',
  },
  auth: {
    genericError: 'There was a problem linking your account, please try again or contact support for assistance.',
    postMessageError:
      'Your account may have been linked, but there was a problem communicating with the main window. Close this window and refresh Jetstream.',
  },
  salesforce: {
    genericError: 'There was a problem linking your account, please try again or contact support for assistance.',
    postMessageError:
      'There was a problem communicating with the main window. Close this window and refresh Jetstream in order for your org to show up.',
  },
};

/**
 * QUERY PARAMS:
 * type=auth|salesforce
 * clientUrl=whitelisted domain to send back to (e.x. new URL(ENV.JETSTREAM_CLIENT_URL).origin)
 *
 * If Error:
 * - error=any truthy string
 * - message=any error message (fallback to STATUS_MAP[type].genericError || STATUS_MAP.type.genericError)
 *
 * If no error:
 * - data=anything to send back to the server (no processing at all, this should be pre-stringified data)
 */
function LinkAuthAccount() {
  const [hasError, setHasError] = useState(false);
  const [errorHeading, setErrorHeading] = useState<string | null>(null);
  const [status, setStatus] = useState('Your request is being processed, please wait.');

  useEffect(() => {
    const params = parseQueryString<OauthLinkParams>(window.location.search);
    const clientUrl = params.clientUrl;

    if (params.error) {
      setErrorHeading(params.error);
      setStatus(params.message || STATUS_MAP[params.type]?.genericError || STATUS_MAP.fallback.genericError);
      setHasError(true);
    } else {
      if (window.opener) {
        try {
          const data = params.data || '';
          window.opener.postMessage(decodeURIComponent(data), clientUrl);
        } catch (ex) {
          console.error(ex);
          setStatus(STATUS_MAP[params.type]?.postMessageError || STATUS_MAP.fallback.postMessageError);
          setHasError(true);
        }
      } else {
        console.error('ERROR - window.opener is not defined');
        setStatus(STATUS_MAP[params.type]?.postMessageError || STATUS_MAP.fallback.postMessageError);
        setHasError(true);
      }
    }
  }, []);

  return (
    <Fragment>
      <Head>
        <title>Jetstream Link External Connection</title>
        <meta
          name="description"
          content="Jetstream is a set of tools that supercharge your administration of Salesforce.com. Jetstream is built for administrators, developers, quality assurance, or power users that want to speed up your management of Salesforce. Jetstream comes with an advanced query builder for viewing records, a powerful data loader for making changes to your record data, and many more features!"
        />
        <link rel="icon" type="image/png" href="/images/favicon.ico"></link>
        <meta charSet="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />

        <meta name="theme-color" content="#ffffff" />

        <link rel="apple-touch-icon" sizes="57x57" href="/assets/images/apple-icon-57x57.png" />
        <link rel="apple-touch-icon" sizes="60x60" href="/assets/images/apple-icon-60x60.png" />
        <link rel="apple-touch-icon" sizes="72x72" href="/assets/images/apple-icon-72x72.png" />
        <link rel="apple-touch-icon" sizes="76x76" href="/assets/images/apple-icon-76x76.png" />
        <link rel="apple-touch-icon" sizes="114x114" href="/assets/images/apple-icon-114x114.png" />
        <link rel="apple-touch-icon" sizes="120x120" href="/assets/images/apple-icon-120x120.png" />
        <link rel="apple-touch-icon" sizes="144x144" href="/assets/images/apple-icon-144x144.png" />
        <link rel="apple-touch-icon" sizes="152x152" href="/assets/images/apple-icon-152x152.png" />
        <link rel="apple-touch-icon" sizes="180x180" href="/assets/images/apple-icon-180x180.png" />
        <link rel="icon" type="image/png" sizes="192x192" href="/assets/images/android-icon-192x192.png" />

        <link rel="manifest" href="/assets/images/manifest.json" />

        <meta name="msapplication-TileColor" content="#ffffff" />
        <meta name="msapplication-TileImage" content="/images/ms-icon-144x144.png" />

        <link rel="icon" type="image/png" sizes="32x32" href="/assets/images/favicon-32x32.png" />
        <link rel="icon" type="image/png" sizes="96x96" href="/assets/images/favicon-96x96.png" />
        <link rel="icon" type="image/png" sizes="16x16" href="/assets/images/favicon-16x16.png" />
      </Head>
      <HeaderNoNavigation />
      <main className="flex-grow flex flex-col justify-center max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 sm:my-12 md:my-24">
        <div className="py-16">
          <div className="text-center">
            <p className="text-sm font-semibold text-cyan-600 uppercase tracking-wide">Authentication</p>
            {errorHeading && <p className="mt-2 text-xl">{errorHeading}</p>}
            <p className="mt-2 text-base">{status}</p>
            {hasError && (
              <p className="mt-8 text-base text-gray-500">
                If you need more assistance, you can file a support ticket or email{' '}
                <a
                  href="mailto:support@getjetstream.app"
                  className="text-cyan-600 hover:text-cyan-500 hover:underline"
                  target="_blank"
                  rel="noreferrer"
                >
                  {email}
                </a>
                .
              </p>
            )}
          </div>
        </div>
      </main>
      <Footer />
    </Fragment>
  );
}

export default LinkAuthAccount;
