import React, { FunctionComponent } from 'react';

// first item
// py-4 px-4 flex items-center space-x-3 text-base leading-6 text-white

// all remaining items
// border-t border-teal-300 border-opacity-25 py-4 px-4 flex items-center space-x-3 text-base leading-6 text-white

// first item, second column
// border-t border-teal-300 border-opacity-25 py-4 px-4 flex items-center space-x-3 text-base leading-6 text-white sm:border-t-0 sm:border-l

// remaining items in second col
// border-t border-teal-300 border-opacity-25 py-4 px-4 flex items-center space-x-3 text-base leading-6 text-white sm:border-l

export interface PricingTableItemProps {
  text: string;
}

export const PricingTableItem: FunctionComponent<PricingTableItemProps> = ({ text }) => (
  <li className="py-4 px-4 flex items-center space-x-3 text-base leading-6 text-white">
    {/* <!-- Heroicon name: check --> */}
    <svg
      className="h-6 w-6 text-blue-200"
      aria-hidden="true"
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
    >
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
    </svg>
    <span>{text}</span>
  </li>
);

export default PricingTableItem;
