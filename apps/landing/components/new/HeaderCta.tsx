/* eslint-disable @next/next/no-img-element */
import { HeartIcon } from '@heroicons/react/solid';

export const HeaderCta = () => (
  <div className="pt-10 bg-gray-900 sm:pt-16 lg:pt-8 lg:pb-14 lg:overflow-hidden pb-8">
    <div className="mx-auto max-w-7xl lg:px-8">
      <div className="lg:grid lg:grid-cols-2 lg:gap-8">
        <div className="mx-auto max-w-md px-4 sm:max-w-2xl sm:px-6 sm:text-center lg:px-0 lg:text-left lg:flex lg:items-center">
          <div className="lg:py-24">
            <span className="px-3 py-0.5 text-white text-xs font-semibold leading-5 uppercase tracking-wide">
              Jetstream is community supported and free to use
            </span>
            <h1 className="mt-4 text-4xl tracking-tight font-extrabold text-white sm:mt-5 sm:text-6xl lg:mt-6 xl:text-6xl">
              <span className="block">A better way to</span>
              <span className="pb-3 block bg-clip-text text-transparent bg-gradient-to-r from-teal-200 to-cyan-400 sm:pb-5">
                work on Salesforce
              </span>
            </h1>
            <p className="text-base text-gray-300 sm:text-xl lg:text-lg xl:text-xl">
              The Jetstream platform makes managing your Salesforce instances a breeze. Use Jetstream to work with your data and metadata to
              get your work done faster.
            </p>
            <div className="mt-6">
              <a
                href="/oauth/signup"
                className="py-3 px-4 rounded-md shadow bg-gradient-to-r from-teal-500 to-cyan-600 text-white font-medium hover:from-teal-600 hover:to-cyan-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-cyan-400 focus:ring-offset-gray-900"
              >
                Sign-up for a free account
              </a>
            </div>
            <div className="mt-7">
              <p className="text-base text-gray-300 sm:text-xl lg:text-lg xl:text-xl">
                Jetstream is <span className="underline">free to use</span> thanks to the support of our community.
              </p>
              <>
                <a
                  href="https://github.com/sponsors/jetstreamapp"
                  className="mt-6 inline-flex items-center py-3 px-4 rounded-md shadow bg-cyan-600 text-white font-medium hover:from-teal-600 hover:bg-cyan-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-cyan-400 focus:ring-offset-gray-900"
                  target="_blank"
                  rel="noreferrer"
                >
                  <HeartIcon className="-ml-0.5 mr-2 h-4 w-4" aria-hidden="true" />
                  Become a financial sponsor
                </a>
              </>
            </div>
          </div>
        </div>
        <div className="mt-12 -mb-16 sm:-mb-48 lg:m-0 lg:relative">
          <div className="mx-auto max-w-md px-4 sm:max-w-2xl sm:px-6 lg:max-w-none lg:px-0 hidden lg:block">
            {/* Illustration taken from Lucid Illustrations: https://lucid.pixsellz.io/ */}
            <img
              className="w-full lg:absolute lg:inset-y-0 lg:left-0 lg:h-full lg:w-auto lg:max-w-none"
              src="https://res.cloudinary.com/getjetstream/image/upload/v1634606599/public/website/cloud-illustration-teal-cyan.svg"
              alt=""
            />
          </div>
        </div>
      </div>
    </div>
  </div>
);

export default HeaderCta;
