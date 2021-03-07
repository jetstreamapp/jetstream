import React, { FunctionComponent } from 'react';
import classNames from 'classnames';

export interface PricingTableItemProps {
  text: string;
  topBorder?: boolean;
  omitTopBoarderOnSmall?: boolean;
  leftBorder?: boolean;
}

export const PricingTableItem: FunctionComponent<PricingTableItemProps> = ({ text, topBorder, omitTopBoarderOnSmall, leftBorder }) => (
  <li
    className={classNames('py-4 px-4 flex items-center space-x-3 text-base leading-6 text-white', {
      'border-t border-blue-100 border-opacity-75': topBorder,
      'sm:border-t-0': omitTopBoarderOnSmall,
      'sm:border-l': leftBorder,
    })}
  >
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
