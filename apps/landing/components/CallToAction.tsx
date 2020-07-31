import React from 'react';
import NotifyMe from './NotifyMe';

export const CallToAction = () => (
  <div className="mt-10 mx-auto max-w-screen-xl px-4 sm:mt-12 sm:px-6 md:mt-16 lg:mt-20 lg:px-8 xl:mt-28">
    <div className="text-center lg:text-left">
      <h2 className="text-4xl tracking-tight leading-10 font-extrabold text-gray-900 sm:text-5xl sm:leading-none md:text-6xl">
        Supercharge your administration
        <div className="text-blue-600">of Salesforce.com</div>
      </h2>
      <p className="mt-3 text-base text-gray-500 sm:mt-5 sm:text-lg sm:max-w-xl sm:mx-auto md:mt-5 md:text-xl lg:mx-0">
        Jetstream is designed to help you quickly view your data, make changes to your org, and compare your changes across your
        environments.
      </p>
      <p className="text-base text-gray-500 sm:text-lg sm:max-w-xl sm:mx-auto md:text-xl lg:mx-0">Reclaim your day by using Jetstream!</p>
      <NotifyMe />
    </div>
  </div>
);

export default CallToAction;
