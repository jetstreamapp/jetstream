import React, { FunctionComponent } from 'react';
import classNames from 'classnames';

export interface FeatureWithIconProps {
  title: string;
  icon: React.ReactNode;
  bgColorClass?: string;
}

export const FeatureWithIcon: FunctionComponent<FeatureWithIconProps> = ({ title, icon, bgColorClass = 'bg-blue-700', children }) => (
  <div className="flex">
    <div className={classNames('flex-shrink-0 h-12 w-12 rounded-md flex items-center justify-center', bgColorClass)}>{icon}</div>
    <div className="ml-4">
      <dt className="text-lg leading-6 font-medium text-gray-900">{title}</dt>
      <dd className="mt-2 text-base leading-6 text-gray-500">{children}</dd>
    </div>
  </div>
);

export default FeatureWithIcon;
