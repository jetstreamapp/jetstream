import {
  ArrowDownTrayIcon,
  CloudArrowDownIcon,
  CpuChipIcon,
  DevicePhoneMobileIcon,
  ExclamationTriangleIcon,
  LockClosedIcon,
  ShieldCheckIcon,
  StarIcon,
} from '@heroicons/react/24/outline';
import Link from 'next/link';
import Layout from '../../components/layouts/Layout';
import { useUserProfile } from '../../hooks/auth.hooks';
import { useDesktopDownloads, useDetectPlatform } from '../../hooks/desktop-download.hooks';
import { ROUTES } from '../../utils/environment';

export default function DesktopDownloadPage() {
  const userProfile = useUserProfile();
  const { windows, macosX64, macosArm64, isLoading, error } = useDesktopDownloads();
  const detectedPlatform = useDetectPlatform();

  return (
    <div className="bg-gray-900 py-24 sm:pt-16 sm:pb-64">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <div className="mx-auto max-w-4xl text-center">
          <p className="mt-2 text-balance text-5xl font-semibold tracking-tight text-white sm:text-6xl">Jetstream for Desktop</p>
        </div>
        <p className="mx-auto mt-6 max-w-2xl text-pretty text-center text-lg font-medium text-gray-400 sm:text-xl/8">
          Your Salesforce data stays secure with our desktop application
        </p>

        {/* Professional Plan Callout */}
        <div className="mt-8 mx-auto max-w-2xl">
          <div className="rounded-lg bg-gradient-to-r from-cyan-900/20 to-blue-900/20 border border-cyan-500/20 p-6">
            <div className="flex items-center justify-center">
              <StarIcon className="h-5 w-5 text-cyan-400 mr-2" />
              <p className="text-sm font-medium text-cyan-300">The Desktop application is available for Professional and higher plans.</p>
              <Link href={ROUTES.PRICING} className="ml-2 text-sm text-cyan-400 hover:text-cyan-300 underline">
                View pricing
              </Link>
            </div>
          </div>
        </div>

        {/* Beta Notice */}
        <div className="mt-6 mx-auto max-w-2xl">
          <div className="rounded-lg bg-gradient-to-r from-amber-900/20 to-orange-900/20 border border-amber-500/20 p-6">
            <div className="flex items-start">
              <ExclamationTriangleIcon className="h-5 w-5 text-amber-400 mr-3 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-sm font-medium text-amber-300 mb-2">Early Release</p>
                <p className="text-sm text-amber-200 mb-3">This feature is in early release. You may encounter bugs or missing features.</p>
                <div className="flex flex-wrap gap-4 text-sm">
                  <div className="flex flex-wrap gap-4 text-sm">
                    <a
                      href={ROUTES.EXTERNAL.GITHUB_ISSUE}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-amber-300 hover:text-amber-200 underline"
                    >
                      Report issues on GitHub
                    </a>
                    <a
                      href={ROUTES.EXTERNAL.DISCORD}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-amber-300 hover:text-amber-200 underline"
                    >
                      Share feedback on Discord
                    </a>
                    <a href={ROUTES.EXTERNAL.SUPPORT_EMAIL} className="text-amber-300 hover:text-amber-200 underline">
                      Email support
                    </a>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Content section with consistent height to prevent layout shift */}
        <div className="mt-16" style={{ minHeight: '600px' }}>
          {!userProfile.isLoggedIn ? (
            <div className="text-center">
              <div className="max-w-md mx-auto rounded-lg bg-gradient-to-r from-gray-800/50 to-gray-700/50 border border-gray-600 p-8">
                <LockClosedIcon className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-xl font-semibold text-white mb-4">Login to view download options</h3>
                <p className="text-gray-300 mb-6">Sign in to access the desktop app for your platform</p>
                <Link
                  href={ROUTES.AUTH.login}
                  className="inline-flex items-center px-6 py-3 text-lg font-semibold text-white bg-cyan-500 rounded-lg shadow-lg hover:bg-cyan-400 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:ring-offset-2 focus:ring-offset-gray-900"
                >
                  Login
                </Link>
              </div>
            </div>
          ) : error ? (
            <div className="max-w-md mx-auto">
              <div className="rounded-md bg-red-900 p-4">
                <p className="text-sm text-red-200">{error}</p>
              </div>
            </div>
          ) : isLoading ? (
            <div className="text-center">
              <p className="text-gray-400">Loading download options...</p>
            </div>
          ) : (
            <div>
              {/* Recommended Download Button */}
              <div className="text-center">
                {(() => {
                  // Get the recommended download based on platform detection
                  let recommendedDownload: typeof windows | null = null;
                  let platformName = '';

                  if (detectedPlatform.os === 'windows' && windows) {
                    recommendedDownload = windows;
                    platformName = 'Windows';
                  } else if (detectedPlatform.os === 'macos' && detectedPlatform.arch === 'arm64' && macosArm64) {
                    recommendedDownload = macosArm64;
                    platformName = 'Mac (Apple Silicon)';
                  } else if (detectedPlatform.os === 'macos' && detectedPlatform.arch === 'x64' && macosX64) {
                    recommendedDownload = macosX64;
                    platformName = 'Mac (Intel)';
                  } else {
                    // Fallback to first available download
                    if (windows) {
                      recommendedDownload = windows;
                      platformName = 'Windows';
                    } else if (macosArm64) {
                      recommendedDownload = macosArm64;
                      platformName = 'Mac (Apple Silicon)';
                    } else if (macosX64) {
                      recommendedDownload = macosX64;
                      platformName = 'Mac (Intel)';
                    }
                  }

                  return recommendedDownload ? (
                    <div className="mb-16">
                      <p className="text-sm font-semibold text-cyan-400 mb-4">Recommended for your device</p>
                      <a
                        href={recommendedDownload.downloadUrl}
                        className="inline-flex items-center px-8 py-4 text-lg font-semibold text-white bg-cyan-500 rounded-lg shadow-lg hover:bg-cyan-400 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:ring-offset-2 focus:ring-offset-gray-900"
                        download
                      >
                        <ArrowDownTrayIcon className="h-6 w-6 mr-3" />
                        Download for {platformName}
                      </a>
                    </div>
                  ) : null;
                })()}
              </div>

              {/* Other Download Options */}
              <div className="max-w-2xl mx-auto">
                <h3 className="text-xl font-semibold text-white text-center mb-8">Other Download Options</h3>
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-4 rounded-lg border border-gray-700 bg-white/5">
                    <div>
                      <h4 className="text-white font-medium">Windows</h4>
                      <p className="text-sm text-gray-400">64-bit installer</p>
                    </div>
                    {windows ? (
                      <a
                        href={windows.downloadUrl}
                        className="inline-flex items-center px-4 py-2 text-sm font-medium text-white bg-white/10 rounded-md hover:bg-white/20 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                        download
                      >
                        <ArrowDownTrayIcon className="h-4 w-4 mr-2" />
                        Download
                      </a>
                    ) : (
                      <span className="text-sm text-gray-500">Not available</span>
                    )}
                  </div>

                  <div className="flex items-center justify-between p-4 rounded-lg border border-gray-700 bg-white/5">
                    <div>
                      <h4 className="text-white font-medium">macOS (Intel)</h4>
                      <p className="text-sm text-gray-400">For Intel-based Macs</p>
                    </div>
                    {macosX64 ? (
                      <a
                        href={macosX64.downloadUrl}
                        className="inline-flex items-center px-4 py-2 text-sm font-medium text-white bg-white/10 rounded-md hover:bg-white/20 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                        download
                      >
                        <ArrowDownTrayIcon className="h-4 w-4 mr-2" />
                        Download
                      </a>
                    ) : (
                      <span className="text-sm text-gray-500">Not available</span>
                    )}
                  </div>

                  <div className="flex items-center justify-between p-4 rounded-lg border border-gray-700 bg-white/5">
                    <div>
                      <h4 className="text-white font-medium">macOS (Apple Silicon)</h4>
                      <p className="text-sm text-gray-400">For M Series Macs</p>
                    </div>
                    {macosArm64 ? (
                      <a
                        href={macosArm64.downloadUrl}
                        className="inline-flex items-center px-4 py-2 text-sm font-medium text-white bg-white/10 rounded-md hover:bg-white/20 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                        download
                      >
                        <ArrowDownTrayIcon className="h-4 w-4 mr-2" />
                        Download
                      </a>
                    ) : (
                      <span className="text-sm text-gray-500">Not available</span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
          {/* Key Features */}
          <div className="mt-16 mx-auto max-w-4xl">
            <div className="mx-auto max-w-2xl text-center">
              <h2 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">Your Data Stays Secure</h2>
              <p className="mt-6 text-lg leading-8 text-gray-300">
                None of your Salesforce data is stored on our servers. The only exception is if you opt-in to history sync, where we store
                metadata to synchronize across your devices.
              </p>
            </div>

            <div className="mx-auto mt-16 max-w-2xl sm:mt-20 lg:mt-24 lg:max-w-none">
              <dl className="grid max-w-xl grid-cols-1 gap-x-8 gap-y-16 lg:max-w-none lg:grid-cols-2">
                <div className="flex flex-col">
                  <dt className="flex items-center gap-x-3 text-base font-semibold leading-7 text-white">
                    <ShieldCheckIcon className="h-5 w-5 flex-none text-cyan-400" aria-hidden="true" />
                    Privacy First
                  </dt>
                  <dd className="mt-4 flex flex-auto flex-col text-base leading-7 text-gray-300">
                    <p className="flex-auto">*Your Salesforce data is not stored and does not pass through our servers.</p>
                  </dd>
                </div>
                <div className="flex flex-col">
                  <dt className="flex items-center gap-x-3 text-base font-semibold leading-7 text-white">
                    <DevicePhoneMobileIcon className="h-5 w-5 flex-none text-cyan-400" aria-hidden="true" />
                    Cross-Device Sync
                  </dt>
                  <dd className="mt-4 flex flex-auto flex-col text-base leading-7 text-gray-300">
                    <p className="flex-auto">
                      Optionally sync your query history and preferences across desktop, web, and browser extension.
                    </p>
                  </dd>
                </div>
                <div className="flex flex-col">
                  <dt className="flex items-center gap-x-3 text-base font-semibold leading-7 text-white">
                    <CloudArrowDownIcon className="h-5 w-5 flex-none text-cyan-400" aria-hidden="true" />
                    Automatic Updates
                  </dt>
                  <dd className="mt-4 flex flex-auto flex-col text-base leading-7 text-gray-300">
                    <p className="flex-auto">
                      Stay up-to-date with the latest features and security improvements through automatic updates.
                    </p>
                  </dd>
                </div>
                <div className="flex flex-col">
                  <dt className="flex items-center gap-x-3 text-base font-semibold leading-7 text-white">
                    <CpuChipIcon className="h-5 w-5 flex-none text-cyan-400" aria-hidden="true" />
                    Native Performance
                  </dt>
                  <dd className="mt-4 flex flex-auto flex-col text-base leading-7 text-gray-300">
                    <p className="flex-auto">Desktop-class performance with direct file system access for faster imports and exports.</p>
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
        </div>
      </div>
    </div>
  );
}

DesktopDownloadPage.getLayout = function getLayout(page: React.ReactElement) {
  return (
    <Layout title="Download Desktop App | Jetstream" isInverse>
      {page}
    </Layout>
  );
};
