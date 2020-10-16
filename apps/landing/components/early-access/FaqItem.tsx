import React, { FunctionComponent } from 'react';
export interface FaqItemProps {
  title: string;
  text: string;
}

export const FaqItem: FunctionComponent<FaqItemProps> = ({ title, text }) => (
  <div className="space-y-2">
    <dt className="text-lg leading-6 font-medium text-gray-900">{title}</dt>
    <dd className="text-base leading-6 text-gray-500">{text}</dd>
  </div>
);

export default FaqItem;
