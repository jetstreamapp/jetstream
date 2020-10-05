import React, { FunctionComponent } from 'react';

export interface FeatureWithIconProps {
  title: string;
  icon: React.ReactNode;
}

export const FeatureWithIcon: FunctionComponent<FeatureWithIconProps> = ({ title, icon, children }) => (
  <div className="flex">
    <div className="flex-shrink-0 h-12 w-12 bg-blue-700 rounded-md flex items-center justify-center">{icon}</div>
    <div className="ml-4">
      <dt className="text-lg leading-6 font-medium text-gray-900">{title}</dt>
      <dd className="mt-2 text-base leading-6 text-gray-500">{children}</dd>
    </div>
  </div>
);

export default FeatureWithIcon;
