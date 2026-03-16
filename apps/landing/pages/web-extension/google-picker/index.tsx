import Layout from '../../../components/layouts/Layout';
import { useWebExtensionGooglePickerState } from '../../../hooks/web-extension-google-picker.hooks';

const email = 'support@getjetstream.app';

const STATUS_DISPLAY: Record<string, string | null> = {
  idle: 'Initializing...',
  loading_config: 'Loading configuration...',
  loading_google: 'Loading Google Drive...',
  awaiting_auth: 'Click the button below to connect your Google account.',
  authenticating: 'Authenticating with Google...',
  picker_open: 'Select a file or folder from Google Drive.',
  success: 'Selection complete! This window will close automatically.',
  cancelled: 'Selection cancelled. This window will close automatically.',
  error: null,
};

export default function Page() {
  const { status, errorMessage, handleAuthorize } = useWebExtensionGooglePickerState();

  const isLoading = status === 'idle' || status === 'loading_google' || status === 'authenticating';

  return (
    <main className="grow flex flex-col justify-center max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 sm:my-12 md:my-24">
      <div className="py-16">
        <div className="text-center">
          <p className="text-sm font-semibold text-cyan-600 uppercase tracking-wide">Google Drive</p>

          {isLoading && (
            <div className="mt-6">
              <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-cyan-600 border-r-transparent"></div>
            </div>
          )}

          <p className="mt-4 text-base">{STATUS_DISPLAY[status] ?? errorMessage}</p>

          {status === 'awaiting_auth' && (
            <div className="mt-6">
              <button
                onClick={handleAuthorize}
                className="inline-flex items-center px-6 py-3 border border-transparent text-base font-medium rounded-md shadow-sm text-white bg-cyan-600 hover:bg-cyan-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-cyan-500"
              >
                Authorize Google Drive
              </button>
            </div>
          )}

          {status === 'error' && (
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

          {(status === 'success' || status === 'cancelled') && (
            <p className="mt-4 text-sm text-gray-500">If this window does not close automatically, you can close it now.</p>
          )}
        </div>
      </div>
    </main>
  );
}

Page.getLayout = function getLayout(page) {
  return <Layout title="Google Drive Picker | Jetstream">{page}</Layout>;
};
