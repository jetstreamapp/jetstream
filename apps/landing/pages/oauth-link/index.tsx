import { useEffect, useState } from 'react';
import Layout from '../../components/layouts/Layout';
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
 * clientUrl=allowed domain to send back to (e.x. new URL(ENV.JETSTREAM_CLIENT_URL).origin)
 *
 * If Error:
 * - error=any truthy string
 * - message=any error message (fallback to STATUS_MAP[type].genericError || STATUS_MAP.type.genericError)
 *
 * If no error:
 * - data=anything to send back to the server (no processing at all, this should be pre-stringified data)
 */
export default function Page() {
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
    <main className="grow flex flex-col justify-center max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 sm:my-12 md:my-24">
      <div className="py-16">
        <div className="text-center">
          <p className="text-sm font-semibold text-cyan-600 uppercase tracking-wide">Authentication</p>
          {errorHeading && <p className="mt-2 text-xl">{errorHeading}</p>}
          <p className="mt-2 text-base">{status}</p>
          {hasError && (
            <div className="mt-8 text-base text-gray-500">
              <p className="mb-2">
                For help resolving this issue,{' '}
                <a
                  href="https://docs.getjetstream.app/troubleshooting"
                  className="text-cyan-600 hover:text-cyan-500 hover:underline mb-1"
                  target="_blank"
                  rel="noreferrer"
                >
                  refer to the documentation
                </a>
                for troubleshooting tips.
              </p>
              <p>
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
            </div>
          )}
        </div>
      </div>
    </main>
  );
}

Page.getLayout = function getLayout(page) {
  return <Layout userHeaderWithoutNavigation>{page}</Layout>;
};
