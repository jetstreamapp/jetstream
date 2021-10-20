import React from 'react';

export const SupportCta = () => (
  <div className="relative bg-gray-900">
    <div className="relative h-56 bg-indigo-600 sm:h-72 md:absolute md:left-0 md:h-full md:w-1/2">
      <img
        className="w-full h-full object-cover"
        src="https://res.cloudinary.com/getjetstream/image/upload/v1634695304/public/website/jetstream-landing-support-cta.jpg"
        alt="Jetstream support"
      />
      <div aria-hidden="true" className="absolute inset-0 bg-gradient-to-r from-teal-500 to-cyan-600 mix-blend-multiply" />
    </div>
    <div className="relative mx-auto max-w-md px-4 py-12 sm:max-w-7xl sm:px-6 sm:py-20 md:py-28 lg:px-8 lg:py-32">
      <div className="md:ml-auto md:w-1/2 md:pl-10">
        <p className="mt-2 text-white text-3xl font-extrabold tracking-tight sm:text-4xl">We’re here to help</p>
        <p className="mt-3 text-lg text-gray-300">Have a question about Jetstream or need support?</p>
        <p className="mt-3 text-lg text-gray-300">Don't hesitate to reach out to our team.</p>
        <div className="mt-8 text-white underline"></div>
        <div className="mt-8">
          <div className="inline-flex rounded-md shadow mr-4">
            <a
              href="mailto:support@getjetstream.app"
              target="_blank"
              className="inline-flex items-center justify-center px-5 py-3 border border-transparent text-base font-medium rounded-md text-gray-900 bg-white hover:bg-gray-50"
            >
              Contact support
            </a>
          </div>
          <div className="inline-flex rounded-md shadow">
            <a
              href="https://docs.getjetstream.app"
              target="_blank"
              className="inline-flex items-center justify-center px-5 py-3 border border-transparent text-base font-medium rounded-md text-gray-900 bg-white hover:bg-gray-50"
            >
              View documentation
            </a>
          </div>
        </div>
      </div>
    </div>
  </div>
);

export default SupportCta;
