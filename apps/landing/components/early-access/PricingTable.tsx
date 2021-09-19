import React from 'react';
import PricingTableItem from './PricingTableItem';

export const PricingTable = () => (
  <div className="bg-blue-700 py-16 px-4 sm:py-24 sm:px-6 lg:bg-none lg:flex lg:items-center lg:justify-end lg:px-0 lg:pl-8">
    <div className="max-w-lg mx-auto w-full space-y-8 lg:mx-4">
      <div>
        <h2 className="sr-only">Price</h2>
        <p className="relative grid">
          <span>
            <span className="flex flex-col text-center">
              <span className="text-5xl leading-none font-extrabold text-white tracking-tight">$0</span>
              <span className="mt-2 text-base leading-6 font-medium text-gray-200">Early access pricing</span>
            </span>
          </span>
        </p>
      </div>
      <ul className="bg-blue-400 bg-opacity-50 rounded sm:grid sm:grid-cols-2 sm:grid-rows-2 sm:grid-flow-col">
        <PricingTableItem text="Unlimited Orgs" />
        <PricingTableItem text="Unlimited Usage" topBorder />
        <PricingTableItem text="Optimized Workflows" topBorder omitTopBoarderOnSmall leftBorder />
        <PricingTableItem text="Securely Built" topBorder leftBorder />
      </ul>
      <a
        href="/oauth/signup"
        className="w-full bg-white border border-transparent rounded-md py-4 px-8 flex items-center justify-center text-lg leading-6 font-medium text-blue-600 hover:text-blue-700 transition duration-150 ease-in-out md:px-10"
      >
        Sign up for free during early access
      </a>
    </div>
  </div>
);

export default PricingTable;
