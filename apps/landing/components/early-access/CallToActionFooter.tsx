import React from 'react';
//
export const CallToActionFooter = () => (
  // <div className="bg-blue-700">
  <div className="bg-gradient-to-r from-indigo-600 to-blue-700">
    <div className="max-w-2xl mx-auto py-16 px-4 text-center sm:py-20 sm:px-6 lg:px-8">
      <h2 className="text-3xl leading-9 font-extrabold text-white sm:text-4xl sm:leading-10">
        <span className="block">Boost your productivity.</span>
        <span className="block text-gray-900">Start using Jetstream today.</span>
      </h2>
      <p className="mt-4 text-lg leading-6 text-blue-100">Get early access for free.</p>
      <a
        href="/oauth/signup"
        className="mt-8 w-full bg-white border border-transparent rounded-md py-3 px-5 inline-flex items-center justify-center text-base leading-6 font-medium text-blue-600 hover:text-blue-700 transition duration-150 ease-in-out sm:w-auto"
      >
        Sign up for free
      </a>
    </div>
  </div>
);

export default CallToActionFooter;
