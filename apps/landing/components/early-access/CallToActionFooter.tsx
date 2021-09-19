import React from 'react';

export const CallToActionFooter = () => (
  <div className="bg-gradient-to-b from-blue-500 via-blue-700 bg-blue-900 relative">
    <div
      style={{
        position: 'absolute',
        width: 100,
        height: 100,
        pointerEvents: 'none',
      }}
    ></div>
    <div className="max-w-2xl mx-auto text-center py-16 px-4 sm:py-20 sm:px-6 lg:px-8">
      <h2 className="text-3xl font-extrabold text-white sm:text-4xl">
        <span className="block">Boost your productivity.</span>
        <span className="block">Start using Jetstream today.</span>
      </h2>
      <p className="mt-4 text-lg leading-6 text-blue-100">Get early access for free.</p>
      <a
        href="/oauth/signup"
        className="mt-8 w-full inline-flex items-center justify-center px-5 py-3 border border-transparent text-base font-medium rounded-md text-blue-600 bg-white hover:bg-blue-50 sm:w-auto"
      >
        Sign up for free
      </a>
    </div>
  </div>
);

export default CallToActionFooter;
