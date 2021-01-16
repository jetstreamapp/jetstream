/** @jsx jsx */
import { css, jsx } from '@emotion/react';
import EinsteinFigure from '../../assets/images/einstein-figure.svg';

export const CallToActionHeader = () => (
  <div className="bg-gradient-to-b from-gray-100 from-gray-50">
    <div className="max-w-screen-xl mx-auto pt-16 md:pb-16 px-4 sm:py-24 sm:px-6 lg:px-8 flex items-center md:flex-row flex-col">
      <div className="flex-grow text-center">
        <div className="mt-1 text-4xl leading-10 font-extrabold text-gray-900 sm:text-5xl sm:leading-none sm:tracking-tight lg:text-6xl">
          Salesforce at the speed of thought
        </div>
        <p className="mt-5 text-xl leading-7 text-gray-500">
          Get early access for <strong>free</strong>.
        </p>
      </div>
      <img
        src={EinsteinFigure}
        alt="einstein"
        className="flex-wrap flex-shrink "
        css={css`
          max-width: 250px;
        `}
      />
    </div>
  </div>
);

export default CallToActionHeader;
