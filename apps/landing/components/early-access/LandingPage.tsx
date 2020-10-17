import React from 'react';
import CallToActionFooter from './CallToActionFooter';
import CallToActionHeader from './CallToActionHeader';
// import Faq from './FrequentlyAskedQuestions';
import SplitBrandPricing from './SplitBrandPricing';

export const LandingPage = () => (
  <div>
    <CallToActionHeader />
    <SplitBrandPricing />
    {/* TODO: ADD CALLOUT HERE */}

    {/* <div className="bg-teal-200 bg-opacity-25">
    <div className="max-w-screen-xl mx-auto py-16 px-4 sm:py-24 sm:px-6 lg:px-8">
      <div className="lg:grid lg:grid-cols-2 lg:gap-8">
        <h2 className="max-w-md mx-auto text-3xl leading-9 font-extrabold text-teal-900 text-center lg:max-w-xl lg:text-left">
          The world's most innovative companies use Workflow
        </h2>
        <div className="mt-8 flow-root lg:mt-0 self-center">
          <div className="-mt-4 -ml-8 flex flex-wrap justify-between lg:-ml-4">
            <div className="mt-4 ml-8 flex flex-grow flex-shrink-0 justify-center lg:flex-grow-0 lg:ml-4">
              <img className="h-12" src="https://tailwindui.com/img/logos/workcation-logo-teal-900.svg" alt="Workcation">
            </div>
            <div className="mt-4 ml-8 flex flex-grow flex-shrink-0 justify-center lg:flex-grow-0 lg:ml-4">
              <img className="h-12" src="https://tailwindui.com/img/logos/tuple-logo-teal-900.svg" alt="Tuple">
            </div>
            <div className="mt-4 ml-8 flex flex-grow flex-shrink-0 justify-center lg:flex-grow-0 lg:ml-4">
              <img className="h-12" src="https://tailwindui.com/img/logos/level-logo-teal-900.svg" alt="Level">
            </div>
          </div>
        </div>
      </div>
    </div>
  </div> */}

    {/* END CALLOUT */}
    {/* <Faq /> */}
    <CallToActionFooter />
  </div>
);

export default LandingPage;
