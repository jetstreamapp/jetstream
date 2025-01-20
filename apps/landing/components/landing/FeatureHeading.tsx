import React, { ReactNode } from 'react';

interface FeatureHeadingProps {
  title: string;
  heading: string;
  description: ReactNode;
}

export const FeatureHeading = ({ title, heading, description }: FeatureHeadingProps) => (
  <div>
    <h2 className="text-base font-semibold tracking-wider text-cyan-600 uppercase">{title}</h2>
    <p className="mt-2 text-3xl font-extrabold text-gray-900 tracking-tight sm:text-4xl">{heading}</p>
    <p className="mt-5 max-w-prose mx-auto text-xl text-gray-500">{description}</p>
  </div>
);

export default FeatureHeading;
