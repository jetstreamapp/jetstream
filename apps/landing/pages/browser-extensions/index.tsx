import { BoltIcon, ExclamationTriangleIcon, GlobeAltIcon, LockClosedIcon, ShieldCheckIcon, StarIcon } from '@heroicons/react/24/outline';
import Link from 'next/link';
import Layout from '../../components/layouts/Layout';
import { ROUTES } from '../../utils/environment';

export default function Page() {
  return (
    <div className="bg-gray-900 py-24 sm:pt-16 sm:pb-64">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <div className="mx-auto max-w-4xl text-center">
          <p className="mt-2 text-balance text-5xl font-semibold tracking-tight text-white sm:text-6xl">Browser Extensions</p>
        </div>
        <p className="mx-auto mt-6 max-w-2xl text-pretty text-center text-lg font-medium text-gray-400 sm:text-xl/8">
          Gain instant access to Jetstream just by logging in to Salesforce.
        </p>

        {/* Professional Plan Callout */}
        <div className="mt-8 mx-auto max-w-2xl">
          <div className="rounded-lg bg-gradient-to-r from-cyan-900/20 to-blue-900/20 border border-cyan-500/20 p-6">
            <div className="flex items-center justify-center">
              <StarIcon className="h-5 w-5 text-cyan-400 mr-2" />
              <p className="text-sm font-medium text-cyan-300">Browser extensions are available for Professional and higher plans.</p>
              <Link href={ROUTES.PRICING} className="ml-2 text-sm text-cyan-400 hover:text-cyan-300 underline">
                View pricing
              </Link>
            </div>
          </div>
        </div>

        {/* Download Extensions */}
        <div className="mt-16 text-center">
          <h3 className="text-2xl font-semibold text-white mb-8">Download Extensions</h3>
          <div className="max-w-2xl mx-auto space-y-4">
            <div className="flex items-center justify-between p-4 rounded-lg border border-gray-700 bg-white/5">
              <div className="flex items-center">
                <div className="text-left">
                  <h4 className="text-white font-medium">Chrome Extension</h4>
                  <p className="text-sm text-gray-400">For Google Chrome and Chromium-based browsers</p>
                </div>
              </div>
              <a
                href={ROUTES.EXTERNAL.CHROME_EXTENSION}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center px-4 py-2 text-sm font-medium text-white bg-white/10 rounded-md hover:bg-white/20 focus:outline-none focus:ring-2 focus:ring-cyan-500"
              >
                Get Extension
              </a>
            </div>

            <div className="flex items-center justify-between p-4 rounded-lg border border-gray-700 bg-white/5">
              <div className="flex items-center">
                <div>
                  <h4 className="text-white font-medium">Firefox Extension</h4>
                  <p className="text-sm text-gray-400">For Mozilla Firefox</p>
                </div>
              </div>
              <a
                href={ROUTES.EXTERNAL.FIREFOX_EXTENSION}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center px-4 py-2 text-sm font-medium text-white bg-white/10 rounded-md hover:bg-white/20 focus:outline-none focus:ring-2 focus:ring-cyan-500"
              >
                Get Extension
              </a>
            </div>
          </div>
        </div>

        {/* Key Features */}
        <div className="mt-16 mx-auto max-w-4xl">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">Enhanced Privacy & Direct Access</h2>
            <p className="mt-6 text-lg leading-8 text-gray-300">
              Access your Salesforce orgs directly from your browser without sending any data through Jetstream servers.
            </p>
          </div>

          <div className="mx-auto mt-16 max-w-2xl sm:mt-20 lg:mt-24 lg:max-w-none">
            <dl className="grid max-w-xl grid-cols-1 gap-x-8 gap-y-16 lg:max-w-none lg:grid-cols-2">
              <div className="flex flex-col">
                <dt className="flex items-center gap-x-3 text-base font-semibold leading-7 text-white">
                  <ShieldCheckIcon className="h-5 w-5 flex-none text-cyan-400" aria-hidden="true" />
                  Maximum Privacy
                </dt>
                <dd className="mt-4 flex flex-auto flex-col text-base leading-7 text-gray-300">
                  <p className="flex-auto">
                    *No data processed or stored by Jetstream servers. Direct browser-to-Salesforce API communication only.
                  </p>
                </dd>
              </div>
              <div className="flex flex-col">
                <dt className="flex items-center gap-x-3 text-base font-semibold leading-7 text-white">
                  <GlobeAltIcon className="h-5 w-5 flex-none text-cyan-400" aria-hidden="true" />
                  Universal Access
                </dt>
                <dd className="mt-4 flex flex-auto flex-col text-base leading-7 text-gray-300">
                  <p className="flex-auto">
                    Access any Salesforce org without connecting them in Jetstream. Work on any environment instantly.
                  </p>
                </dd>
              </div>
              <div className="flex flex-col">
                <dt className="flex items-center gap-x-3 text-base font-semibold leading-7 text-white">
                  <BoltIcon className="h-5 w-5 flex-none text-cyan-400" aria-hidden="true" />
                  Standalone Tool
                </dt>
                <dd className="mt-4 flex flex-auto flex-col text-base leading-7 text-gray-300">
                  <p className="flex-auto">
                    Works independently in your browser. *Zero server communication except for initial authentication.
                  </p>
                </dd>
              </div>
              <div className="flex flex-col">
                <dt className="flex items-center gap-x-3 text-base font-semibold leading-7 text-white">
                  <LockClosedIcon className="h-5 w-5 flex-none text-cyan-400" aria-hidden="true" />
                  Secure by Design
                </dt>
                <dd className="mt-4 flex flex-auto flex-col text-base leading-7 text-gray-300">
                  <p className="flex-auto">
                    Built with security best practices. Your Salesforce credentials and data never leave your browser.
                  </p>
                </dd>
              </div>
            </dl>
          </div>
        </div>

        <div className="mt-16 mx-auto max-w-4xl">
          <p className="text-gray-300 text-sm">
            *You can opt-in to syncing your history data with Jetstream so it is available across devices.
          </p>
        </div>

        {/* Current Limitations */}
        <div className="mt-16 mx-auto max-w-4xl">
          <div className="mx-auto max-w-2xl text-center mb-12">
            <h2 className="text-2xl font-bold tracking-tight text-white">Current Limitations</h2>
            <p className="mt-4 text-lg leading-8 text-gray-300">
              Some features are not yet available in the browser extension. We're working to add these soon.
            </p>
          </div>

          <div className="max-w-2xl mx-auto space-y-4">
            <div className="flex items-start gap-x-3 p-4 rounded-lg border border-yellow-500/20 bg-yellow-500/5">
              <ExclamationTriangleIcon className="h-5 w-5 flex-none text-yellow-500 mt-1" />
              <div>
                <p className="text-white font-medium">Platform Events</p>
                <p className="text-sm text-gray-400">Real-time platform events are not available</p>
              </div>
            </div>
            <div className="flex items-start gap-x-3 p-4 rounded-lg border border-yellow-500/20 bg-yellow-500/5">
              <ExclamationTriangleIcon className="h-5 w-5 flex-none text-yellow-500 mt-1" />
              <div>
                <p className="text-white font-medium">Google Drive Integration</p>
                <p className="text-sm text-gray-400">Save to and load from Google Drive is not available</p>
              </div>
            </div>
            <div className="flex items-start gap-x-3 p-4 rounded-lg border border-yellow-500/20 bg-yellow-500/5">
              <ExclamationTriangleIcon className="h-5 w-5 flex-none text-yellow-500 mt-1" />
              <div>
                <p className="text-white font-medium">Two-Org Features</p>
                <p className="text-sm text-gray-400">
                  Deploy/compare between orgs not available. You can manually download from org 1 and upload to org 2.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

Page.getLayout = function getLayout(page: React.ReactElement) {
  return (
    <Layout title="Browser Extensions | Jetstream" isInverse>
      {page}
    </Layout>
  );
};
