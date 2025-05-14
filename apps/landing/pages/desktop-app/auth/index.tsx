import Layout from '../../../components/layouts/Layout';
import { useDesktopAuthState } from '../../../hooks/desktop-auth.hooks';

const email = 'support@getjetstream.app';

const STATE_DISPLAY = {
  idle: 'Authentication in progress...',
  loading: 'Authentication in progress...',
  success: 'You are successfully authenticated, you can close this tab.',
  error: null,
};

export default function Page() {
  const { status, errorMessage } = useDesktopAuthState();

  return (
    <main className="flex-grow flex flex-col justify-center max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 sm:my-12 md:my-24">
      <div className="py-16">
        <div className="text-center">
          <p className="text-sm font-semibold text-cyan-600 uppercase tracking-wide">Authentication</p>
          {!!errorMessage && <p className="mt-2 text-xl">Error</p>}
          <p className="mt-2 text-base">{STATE_DISPLAY[status] ?? errorMessage}</p>
          {!!errorMessage && (
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
  );
}

Page.getLayout = function getLayout(page) {
  return <Layout title="Desktop App Authentication | Jetstream">{page}</Layout>;
};
